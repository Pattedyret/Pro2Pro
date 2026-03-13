import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { getDb } from '../data/db';

export interface AuthUser {
  userId: string;
  username: string;
  avatar: string | null;
  sessionId: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization token' });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    const db = getDb();
    const session = db.prepare('SELECT * FROM web_sessions WHERE id = ?').get(payload.sid) as any;

    if (!session || new Date(session.expires_at) < new Date()) {
      res.status(401).json({ error: 'Session expired' });
      return;
    }

    req.user = {
      userId: session.discord_user_id,
      username: session.discord_username,
      avatar: session.discord_avatar,
      sessionId: session.id,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function authOptional(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwtSecret) as any;
    const db = getDb();
    const session = db.prepare('SELECT * FROM web_sessions WHERE id = ?').get(payload.sid) as any;
    if (session && new Date(session.expires_at) >= new Date()) {
      req.user = {
        userId: session.discord_user_id,
        username: session.discord_username,
        avatar: session.discord_avatar,
        sessionId: session.id,
      };
    }
  } catch {
    // Invalid token — proceed without auth
  }
  next();
}
