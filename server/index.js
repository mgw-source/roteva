import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import corsMiddleware, { allowedOrigins, socketCorsOptions } from './middleware/cors.js';
import { initializeDatabase, closeDatabase } from './db/database.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import attachChatSockets from './sockets/chat.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, socketCorsOptions);

console.log('=== ChatFlow server starting ===');
console.log('Allowed client origins:', allowedOrigins.join(', ') || '(none)');
console.log('JWT_SECRET configured:', Boolean(process.env.JWT_SECRET));
console.log('DATABASE_URL configured:', Boolean(process.env.DATABASE_URL));

app.use(corsMiddleware);
app.use(express.json({ limit: '10kb' }));
app.get('/api/health', (_request, response) => response.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use((error, _request, response, _next) => {
  console.error('Request failed:', error);
  response.status(500).json({ error: 'Something went wrong. Please try again.' });
});

attachChatSockets(io);
const port = Number(process.env.PORT) || 3001;

async function start() {
  try {
    await initializeDatabase();
  } catch (error) {
    console.error('Database initialisation failed. Check DATABASE_URL is correct and reachable.', error);
    process.exit(1);
  }
  httpServer.listen(port, () => console.log(`ChatFlow server listening on port ${port}`));
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`Received ${signal}, shutting down.`);
    io.close(async () => {
      await closeDatabase();
      process.exit(0);
    });
  });
}

start();
