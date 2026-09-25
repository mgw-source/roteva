import { Router } from 'express';
import database from '../db/database.js';
import authenticate from '../middleware/authenticate.js';

const router = Router();
router.use(authenticate);

router.get('/users', (request, response) => {
  const search = typeof request.query.search === 'string' ? request.query.search.trim() : '';
  if (!search) return response.json({ users: [] });
  const pattern = `%${search.replace(/[!%_]/g, '!$&')}%`;
  const users = database.prepare(`
    SELECT id, username FROM users
    WHERE id != ? AND username LIKE ? ESCAPE '!'
    ORDER BY username COLLATE NOCASE LIMIT 20
  `).all(request.userId, pattern);
  response.json({ users });
});

router.get('/conversations', (request, response) => {
  const conversations = database.prepare(`
    SELECT c.id, other.id AS userId, other.username,
      latest.body AS lastMessage, latest.created_at AS lastMessageAt
    FROM conversations c
    JOIN users other ON other.id = CASE WHEN c.user_one_id = @userId THEN c.user_two_id ELSE c.user_one_id END
    LEFT JOIN messages latest ON latest.id = (
      SELECT id FROM messages WHERE conversation_id = c.id ORDER BY id DESC LIMIT 1
    )
    WHERE c.user_one_id = @userId OR c.user_two_id = @userId
    ORDER BY COALESCE(latest.created_at, c.created_at) DESC, c.id DESC
  `).all({ userId: request.userId });
  response.json({ conversations });
});

router.post('/conversations', (request, response) => {
  const otherId = Number(request.body.userId);
  if (!Number.isInteger(otherId) || otherId < 1 || otherId === request.userId) {
    return response.status(400).json({ error: 'Choose a valid user to start a conversation.' });
  }
  const other = database.prepare('SELECT id, username FROM users WHERE id = ?').get(otherId);
  if (!other) return response.status(404).json({ error: 'That user could not be found.' });

  const first = Math.min(request.userId, otherId);
  const second = Math.max(request.userId, otherId);
  database.prepare(`
    INSERT INTO conversations (user_one_id, user_two_id) VALUES (?, ?)
    ON CONFLICT (user_one_id, user_two_id) DO NOTHING
  `).run(first, second);
  const conversation = database.prepare('SELECT id FROM conversations WHERE user_one_id = ? AND user_two_id = ?').get(first, second);
  response.json({ conversation: { id: conversation.id, userId: other.id, username: other.username, lastMessage: null, lastMessageAt: null } });
});

router.get('/conversations/:conversationId/messages', (request, response) => {
  const id = Number(request.params.conversationId);
  const conversation = Number.isInteger(id) && database.prepare(`
    SELECT id FROM conversations WHERE id = ? AND (user_one_id = ? OR user_two_id = ?)
  `).get(id, request.userId, request.userId);
  if (!conversation) return response.status(404).json({ error: 'Conversation not found.' });

  const messages = database.prepare(`
    SELECT id, sender_id AS senderId, body, created_at AS createdAt FROM (
      SELECT id, sender_id, body, created_at FROM messages
      WHERE conversation_id = ? ORDER BY id DESC LIMIT 100
    ) ORDER BY id ASC
  `).all(id);
  response.json({ messages });
});

export default router;