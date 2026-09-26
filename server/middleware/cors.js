import cors from 'cors';

const LOCAL_ORIGIN = 'http://localhost:5173';

function normalise(origin) {
  return origin.trim().replace(/\/+$/, '');
}

export function resolveAllowedOrigins(raw = process.env.CLIENT_URL) {
  const entries = [...new Set(String(raw ?? '').split(/[\s,]+/).map(normalise).filter(Boolean))];
  const invalid = entries.filter((entry) => entry !== '*' && !/^https?:\/\/[^/\s]+$/i.test(entry));
  if (invalid.length) {
    console.warn(`CLIENT_URL: ignoring entries that are not plain origins: ${invalid.join(', ')}`);
  }
  const valid = entries.filter((entry) => !invalid.includes(entry));
  if (valid.length) return valid;
  console.warn('CLIENT_URL: no valid origins found, allowing local development origin only.');
  return [LOCAL_ORIGIN];
}

export const allowedOrigins = resolveAllowedOrigins();

export function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOrigins.includes('*')) return true;
  const candidate = normalise(origin);
  return allowedOrigins.some((allowed) => allowed === candidate);
}

const corsMiddleware = cors({
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

export const socketCorsOptions = {
  origin(origin, callback) {
    callback(null, isOriginAllowed(origin));
  },
};

export default corsMiddleware;
