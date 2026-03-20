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

  // Debug filesystem (temporary)
  app.get('/api/debug/fs', (_req, res) => {
    const webDist = path.resolve(__dirname, '../../web/dist');
    const appDir = path.resolve(__dirname, '../../');
    res.json({
      dirname: __dirname,
      appDir,
      webDist,
      webDistExists: fs.existsSync(webDist),
      appContents: fs.existsSync(appDir) ? fs.readdirSync(appDir) : [],
      webContents: fs.existsSync(`${appDir}/web`) ? fs.readdirSync(`${appDir}/web`) : [],
    });
  });

  // Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/puzzles', puzzleRoutes);
  app.use('/api/games', gameRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/leaderboard', leaderboardRoutes);

  // Serve web frontend from the same Express server
  const webDist = path.resolve(__dirname, '../../web/dist');
  console.log(`[API] Looking for web frontend at: ${webDist} (exists: ${fs.existsSync(webDist)})`);
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(webDist, 'index.html'));
    });
    console.log('[API] Serving web frontend from web/dist');
  }

  app.listen(config.apiPort, () => {
    console.log(`[API] Server running on port ${config.apiPort}`);
  });
}
