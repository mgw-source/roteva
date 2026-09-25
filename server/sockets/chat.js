import database from '../db/database.js';
import { readToken } from '../auth/tokens.js';

export default function attachChatSockets(io) {
  io.use(async (socket, next) => {
    try {
      const userId = readToken(socket.handshake.auth?.token);
      const user = await database.get('SELECT id FROM users WHERE id = $1', [userId]);
      if (!user) return next(new Error('Your account could not be found.'));
      socket.data.userId = userId;
      next();
    } catch {
      next(new Error('Please log in again to connect to chat.'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    socket.on('message:send', async (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      const conversationId = Number(payload?.conversationId);
      const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
      if (!Number.isInteger(conversationId) || !body || body.length > 2000) {
        return reply({ error: 'Messages must be between 1 and 2000 characters.' });
      }
      const conversation = await database.get(`
        SELECT user_one_id AS "userOneId", user_two_id AS "userTwoId" FROM conversations WHERE id = $1
      `, [conversationId]);
      if (!conversation || ![conversation.userOneId, conversation.userTwoId].includes(userId)) {
        return reply({ error: 'You cannot send a message to this conversation.' });
      }
      try {
        const saved = await database.run(`
          INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1, $2, $3) RETURNING id
        `, [conversationId, userId, body]);
        const message = await database.get(`
          SELECT id, conversation_id AS "conversationId", sender_id AS "senderId", body,
            created_at AS "createdAt" FROM messages WHERE id = $1
        `, [saved.lastInsertRowid]);
        const sender = await database.get('SELECT username FROM users WHERE id = $1', [userId]);
        const recipientId = conversation.userOneId === userId ? conversation.userTwoId : conversation.userOneId;
        io.to(`user:${recipientId}`).emit('message:new', { ...message, senderUsername: sender.username });
        reply({ message });
      } catch (error) {
        console.error('Message could not be saved:', error);
        reply({ error: 'Message could not be sent. Please try again.' });
      }
    });
  });
}