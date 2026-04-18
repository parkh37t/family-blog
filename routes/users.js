import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { query, get, run } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, async (req, res, next) => {
  try {
    const users = await query(`
      SELECT u.id, u.username, u.display_name, u.role, u.avatar, u.bio, u.active, u.created_at,
             (SELECT COUNT(*) FROM posts WHERE user_id = u.id)::int AS post_count
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json({ users });
  } catch (e) { next(e); }
});

router.post('/', requireAdmin, async (req, res, next) => {
  try {
    const { username, password, display_name, role = 'member' } = req.body;
    if (!username || !password || !display_name) {
      return res.status(400).json({ error: '모든 항목을 입력해 주세요.' });
    }
    if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?) RETURNING id',
      [username, hash, display_name, role]
    );
    res.json({ id: result.lastInsertRowid });
  } catch (e) { next(e); }
});

router.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const { display_name, role, active, password, bio } = req.body;
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const updates = [];
    const params = [];
    if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
    if (role !== undefined) { updates.push('role = ?'); params.push(role); }
    if (active !== undefined) { updates.push('active = ?'); params.push(Boolean(active)); }
    if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (updates.length === 0) return res.json({ ok: true });
    params.push(user.id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const user = await get('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    if (user.id === req.user.id) return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
    await run('DELETE FROM users WHERE id = ?', [user.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/invites', requireAdmin, async (req, res, next) => {
  try {
    const invites = await query(`
      SELECT i.*, u.display_name AS creator_name, u2.display_name AS used_by_name
      FROM invites i
      LEFT JOIN users u  ON u.id  = i.created_by
      LEFT JOIN users u2 ON u2.id = i.used_by
      ORDER BY i.created_at DESC
    `);
    res.json({ invites });
  } catch (e) { next(e); }
});

router.post('/invites', requireAdmin, async (req, res, next) => {
  try {
    const { role = 'member', expires_days } = req.body;
    const code = crypto.randomBytes(6).toString('hex').toUpperCase();
    const expiresAt = expires_days
      ? new Date(Date.now() + Number(expires_days) * 24 * 60 * 60 * 1000).toISOString()
      : null;
    await run(
      'INSERT INTO invites (code, created_by, role, expires_at) VALUES (?, ?, ?, ?)',
      [code, req.user.id, role, expiresAt]
    );
    res.json({ code });
  } catch (e) { next(e); }
});

router.delete('/invites/:id', requireAdmin, async (req, res, next) => {
  try {
    await run('DELETE FROM invites WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.get('/stats', requireAdmin, async (req, res, next) => {
  try {
    const [u, au, p, c, i, recent, top] = await Promise.all([
      get('SELECT COUNT(*)::int AS n FROM users'),
      get('SELECT COUNT(*)::int AS n FROM users WHERE active = TRUE'),
      get('SELECT COUNT(*)::int AS n FROM posts'),
      get('SELECT COUNT(*)::int AS n FROM comments'),
      get('SELECT COUNT(*)::int AS n FROM post_images'),
      query(`
        SELECT p.id, p.title, p.created_at, u.display_name
        FROM posts p JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC LIMIT 5
      `),
      query(`
        SELECT u.display_name, COUNT(p.id)::int AS n
        FROM users u LEFT JOIN posts p ON p.user_id = u.id
        GROUP BY u.id ORDER BY n DESC LIMIT 5
      `),
    ]);
    res.json({
      stats: {
        users: u.n, active_users: au.n, posts: p.n, comments: c.n, images: i.n,
        recent_posts: recent, top_authors: top,
      },
    });
  } catch (e) { next(e); }
});

export default router;
