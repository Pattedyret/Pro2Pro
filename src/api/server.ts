import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { config } from '../config';
import authRoutes from './auth';
import puzzleRoutes from './puzzles';
import gameRoutes from './games';
import playerRoutes from './players';
import leaderboardRoutes from './leaderboard';

export function startApiServer(): void {
  const app = express();

  app.use(cors({
    origin: [config.frontendUrl, 'https://pattedyret.github.io', 'http://localhost:5173'],
    credentials: true,
  }));
  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/puzzles', puzzleRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);

  // Serve web frontend — built into dist/public/ so it survives Railway's production image
  const webPublic = path.resolve(__dirname, '../public');
  if (fs.existsSync(webPublic)) {
    app.use(express.static(webPublic));
    app.get('/{*path}', (_req, res) => {
      res.sendFile(path.join(webPublic, 'index.html'));
    });
    console.log('[API] Serving web frontend from dist/public');
  }

  app.listen(config.apiPort, () => {
    console.log(`[API] Server running on port ${config.apiPort}`);
  });
}
