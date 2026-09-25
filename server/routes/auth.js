import { Router } from 'express';
import bcrypt from 'bcryptjs';
import database from '../db/database.js';
import authenticate from '../middleware/authenticate.js';
import { createToken } from '../auth/tokens.js';

const router = Router();

function sendSession(response, user) {
  response.json({ token: createToken(user.id), user: { id: user.id, username: user.username } });
}

router.post('/register', async (request, response) => {
  const username = typeof request.body.username === 'string' ? request.body.username.trim() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    return response.status(400).json({ error: 'Username must be 3-20 letters, numbers, or underscores.' });
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return response.status(400).json({ error: 'Password must be at least 8 characters and no more than 72 bytes.' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    const result = await database.run(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id',
      [username, passwordHash]
    );
    sendSession(response, { id: result.lastInsertRowid, username });
  } catch (error) {
    if (error.code === '23505') {
      return response.status(409).json({ error: 'That username is already in use.' });
    }
    throw error;
  }
});

router.post('/login', async (request, response) => {
  const username = typeof request.body.username === 'string' ? request.body.username.trim() : '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const user = await database.get('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return response.status(401).json({ error: 'Username or password is incorrect.' });
  }
  sendSession(response, user);
});

router.get('/me', authenticate, async (request, response) => {
  const user = await database.get('SELECT id, username FROM users WHERE id = $1', [request.userId]);
  if (!user) return response.status(401).json({ error: 'Please log in again.' });
  response.json({ user });
});

export default router;