import { readToken } from '../auth/tokens.js';

export default function authenticate(request, response, next) {
  const [scheme, token] = (request.get('authorization') || '').split(' ');

  if (scheme !== 'Bearer' || !token) {
    return response.status(401).json({ error: 'Please log in to continue.' });
  }

  try {
    request.userId = readToken(token);
    next();
  } catch {
    response.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
}