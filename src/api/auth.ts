import { Router } from 'express';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config';
import { getDb } from '../data/db';
import { authRequired } from './middleware';
import { client } from '../bot/client';

const router = Router();

// POST /auth/discord — exchange OAuth code for JWT
router.post('/discord', async (req, res) => {
  const { code, redirect_uri } = req.body;
  if (!code) {
    res.status(400).json({ error: 'Missing code' });
    return;
  }

  try {
    // Exchange code for tokens
    const tokenRes = await axios.post('https://discord.com/api/v10/oauth2/token',
      new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.discordClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirect_uri || `${config.frontendUrl}/callback`,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Fetch user info
    const userRes = await axios.get('https://discord.com/api/v10/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const { id: userId, username, avatar } = userRes.data;

    // Fetch user guilds
    const guildsRes = await axios.get('https://discord.com/api/v10/users/@me/guilds', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const db = getDb();
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    // Save session
    db.prepare(`
      INSERT OR REPLACE INTO web_sessions (id, discord_user_id, discord_username, discord_avatar, access_token, refresh_token, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, username, avatar, access_token, refresh_token ?? null, expiresAt);

    // Cache guilds (only ones the bot is in)
    const botGuildIds = new Set(client.guilds.cache.map(g => g.id));
    for (const guild of guildsRes.data) {
      if (botGuildIds.has(guild.id)) {
        db.prepare(`
          INSERT OR REPLACE INTO user_guilds (discord_user_id, guild_id, guild_name, guild_icon, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `).run(userId, guild.id, guild.name, guild.icon ?? null);
      }
    }

    // Create JWT
    const token = jwt.sign({ sid: sessionId, uid: userId }, config.jwtSecret, { expiresIn: '7d' });

    res.json({ token, user: { id: userId, username, avatar } });
  } catch (err: any) {
    console.error('[API] OAuth error:', err.response?.data ?? err.message);
    res.status(500).json({ error: 'OAuth exchange failed' });
  }
});

// GET /auth/me — current user info + stats
router.get('/me', authRequired, (req, res) => {
  const db = getDb();
  const stats = db.prepare('SELECT * FROM user_stats WHERE discord_user_id = ?').get(req.user!.userId) as any;
  const totalPoints = db.prepare('SELECT COALESCE(SUM(points), 0) as total FROM user_points WHERE discord_user_id = ?').get(req.user!.userId) as any;

  res.json({
    user: {
      id: req.user!.userId,
      username: req.user!.username,
      avatar: req.user!.avatar,
    },
    stats: stats ?? { games_played: 0, games_won: 0, current_streak: 0, max_streak: 0, avg_path_length: 0, total_points: 0 },
    totalPoints: totalPoints?.total ?? 0,
  });
});

// GET /auth/guilds — user's guilds where bot is present
router.get('/guilds', authRequired, (req, res) => {
  const db = getDb();
  const guilds = db.prepare('SELECT guild_id, guild_name, guild_icon FROM user_guilds WHERE discord_user_id = ?').all(req.user!.userId);
  res.json({ guilds });
});

export default router;
