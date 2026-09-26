import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(httpServer, { cors: { origin: clientUrl } });

app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', (_req, res) => res.json({ 
  status: 'ok', 
  timestamp: new Date().toISOString(),
  env: process.env.NODE_ENV,
  hasDbUrl: !!process.env.DATABASE_URL,
  clientUrl
}));

app.get('/api/debug', (_req, res) => res.json({ 
  message: 'Debug endpoint working'
}));

app.use((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Server error' });
});

const port = Number(process.env.PORT) || 3001;

console.log('=== SERVER STARTING ===');
console.log('PORT:', port);
console.log('CLIENT_URL:', clientUrl);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);
console.log('JWT_SECRET set:', !!process.env.JWT_SECRET);

httpServer.listen(port, () => console.log(`ChatFlow server listening on http://localhost:${port}`));

process.on('SIGINT', () => {
  io.close(() => process.exit(0));
});