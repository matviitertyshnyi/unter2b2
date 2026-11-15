import cors from 'cors';
import express, { Express } from 'express';
import { Repository } from './db/repositories.js';
import { createApiRouter } from './routes/api.js';

export function createApp(repo: Repository, corsOrigin?: string): Express {
  const app = express();

  const allowedOrigins = (corsOrigin || process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  // Include loopback alias so local Vite previews work smoothly across browsers
  if (!allowedOrigins.includes('http://127.0.0.1:5173')) {
    allowedOrigins.push('http://127.0.0.1:5173');
  }

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use('/api', createApiRouter(repo));

  return app;
}
