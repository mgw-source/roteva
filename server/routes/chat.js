import { Router } from 'express';
import database from '../db/database.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/users', async (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
  if (!search) return response.json({ users: [] });
  const pattern = `%${search.replace(/[!%_]/g, '!$&')}%`;
  const users = await database.all(`
    SELECT id, username FROM users
    WHERE id != $1 AND username ILIKE $2 ESCAPE '!'
    ORDER BY LOWER(username) LIMIT 20
  `, [request.userId, pattern]);
  response.json({ users });
});

router.get('/conversations', async (request, response) => {
  const conversations = await database.all(`
    SELECT c.id, other.id AS "userId", other.username,
      latest.body AS "lastMessage", latest.created_at AS "lastMessageAt"
    FROM conversations c
    JOIN users other ON other.id = CASE WHEN c.user_one_id = $1 THEN c.user_two_id ELSE c.user_one_id END
    LEFT JOIN messages latest ON latest.id = (
      SELECT id FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
    )
    WHERE c.user_one_id = $1 OR c.user_two_id = $1
    ORDER BY COALESCE(latest.created_at, c.created_at) DESC, c.id DESC
  `, [request.userId]);
  response.json({ conversations });
});

router.post('/conversations', async (request, response) => {
  const otherId = Number(request.body.userId);
  if (!Number.isInteger(otherId) || otherId < 1 || otherId === request.userId) {
    return response.status(400).json({ error: 'Choose a valid user to start a conversation.' });
  }
  const other = await database.get('SELECT id, username FROM users WHERE id = $1', [otherId]);
  if (!other) return response.status(404).json({ error: 'That user could not be found.' });

  const first = Math.min(request.userId, otherId);
  const second = Math.max(request.userId, otherId);
  await database.run(`
    INSERT INTO conversations (user_one_id, user_two_id) VALUES ($1, $2)
    ON CONFLICT (user_one_id, user_two_id) DO NOTHING
  `, [first, second]);
  const conversation = await database.get('SELECT id FROM conversations WHERE user_one_id = $1 AND user_two_id = $2', [first, second]);
  response.json({ conversation: { id: conversation.id, userId: other.id, username: other.username, lastMessage: null, lastMessageAt: null } });
});

router.get('/conversations/:conversationId/messages', async (request, response) => {
  const id = Number(request.params.conversationId);
  const conversation = Number.isInteger(id) && await database.get(`
    SELECT id FROM conversations WHERE id = $1 AND (user_one_id = $2 OR user_two_id = $2)
  `, [id, request.userId]);
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' });

  const messages = await database.all(`
    SELECT id, sender_id AS "senderId", body, created_at AS "createdAt" FROM (
      SELECT id, sender_id, body, created_at FROM messages
      WHERE conversation_id = $1 ORDER BY id DESC LIMIT 100
    ) sub ORDER BY id ASC
  `, [id]);
  response.json({ messages });
});

export default router;