import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production.');
}

const secret = process.env.JWT_SECRET || 'chatflow-development-secret-change-before-deployment';

export function createToken(userId) {
  return jwt.sign({ userId }, secret, { expiresIn: '7d' });
}

export function readToken(token) {
  return Number(jwt.verify(token, secret).userId);
}