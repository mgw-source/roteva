import database from '../db/database.js';
import { readToken } from '../auth/tokens.js';

export default function attachChatSockets(io) {
  io.use((socket, next) => {
    try {
      const userId = readToken(socket.handshake.auth?.token);
      const user = database.prepare('SELECT id FROM users WHERE id = ?').get(userId);
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
    socket.on('message:send', (payload, acknowledge) => {
      const reply = typeof acknowledge === 'function' ? acknowledge : () => {};
      const conversationId = Number(payload?.conversationId);
      const body = typeof payload?.body === 'string' ? payload.body.trim() : '';
      if (!Number.isInteger(conversationId) || !body || body.length > 2000) {
        return reply({ error: 'Messages must be between 1 and 2000 characters.' });
      }
      const conversation = database.prepare(`
        SELECT user_one_id AS userOneId, user_two_id AS userTwoId FROM conversations WHERE id = ?
      `).get(conversationId);
      if (!conversation || ![conversation.userOneId, conversation.userTwoId].includes(userId)) {
        return reply({ error: 'You cannot send a message to this conversation.' });
      }
      try {
        const saved = database.prepare(`
          INSERT INTO messages (conversation_id, sender_id, body) VALUES (?, ?, ?)
        `).run(conversationId, userId, body);
        const message = database.prepare(`
          SELECT id, conversation_id AS conversationId, sender_id AS senderId, body,
            created_at AS createdAt FROM messages WHERE id = ?
        `).get(Number(saved.lastInsertRowid));
        const sender = database.prepare('SELECT username FROM users WHERE id = ?').get(userId);
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