import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import database, { initializeDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import attachChatSockets from './sockets/chat.js';

const app = express();
const httpServer = createServer(app);
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
const io = new Server(httpServer, { cors: { origin: clientUrl } });

app.use(cors({ origin: clientUrl }));
app.use(express.json({ limit: '10kb' }));
app.get('/api/health', (_request, response) => response.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);

// Debug: catch-all for unmatched routes
app.use('/api/*', (req, res) => {
  console.log('404 - Unmatched API route:', req.method, req.originalUrl);
  res.status(404).json({ error: 'API route not found', path: req.originalUrl });
});

app.use((error, _request, response, _next) => {
  console.error('Request failed:', error);
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

attachChatSockets(io);
const port = Number(process.env.PORT) || 3001;

console.log('Starting server...');
console.log('CLIENT_URL:', clientUrl);
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL set:', !!process.env.DATABASE_URL);

// Don't crash on DB failure - log and continue
initializeDatabase()
  .then(() => {
    console.log('Database initialized successfully');
    httpServer.listen(port, () => console.log(`ChatFlow server listening on http://localhost:${port}`));
  })
  .catch((err) => {
    console.error('Database initialization failed (continuing anyway):', err);
    httpServer.listen(port, () => console.log(`ChatFlow server listening on http://localhost:${port} (WITHOUT DATABASE)`));
  });

process.on('SIGINT', async () => {
  io.close(() => {
    process.exit(0);
  });
});