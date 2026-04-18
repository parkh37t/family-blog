import jwt from 'jsonwebtoken';
import { get } from '../db.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'family-blog-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function authOptional(req, res, next) {
  const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return next();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await get(
      'SELECT id, username, display_name, role, avatar, active FROM users WHERE id = ?',
      [payload.id]
    );
    if (user && user.active) req.user = user;
  } catch {}
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: '로그인이 필요합니다.' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });
  next();
}
