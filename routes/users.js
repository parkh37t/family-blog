import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { query, get, run } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAdmin, (req, res) => {
  const users = query(`
    SELECT u.id, u.username, u.display_name, u.role, u.avatar, u.bio, u.active, u.created_at,
           (SELECT COUNT(*) FROM posts WHERE user_id = u.id) AS post_count
    FROM users u
    ORDER BY u.created_at DESC
  `);
  res.json({ users });
});

router.post('/', requireAdmin, async (req, res) => {
  const { username, password, display_name, role = 'member' } = req.body;
  if (!username || !password || !display_name) {
    return res.status(400).json({ error: '모든 항목을 입력해 주세요.' });
  }
  if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
  const existing = get('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
  const hash = await bcrypt.hash(password, 10);
  const result = run(
    'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
    [username, hash, display_name, role]
  );
  res.json({ id: result.lastInsertRowid });
});

router.put('/:id', requireAdmin, async (req, res) => {
  const { display_name, role, active, password, bio } = req.body;
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

  const updates = [];
  const params = [];
  if (display_name !== undefined) { updates.push('display_name = ?'); params.push(display_name); }
  if (role !== undefined) { updates.push('role = ?'); params.push(role); }
  if (active !== undefined) { updates.push('active = ?'); params.push(active ? 1 : 0); }
  if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    const hash = await bcrypt.hash(password, 10);
    updates.push('password_hash = ?');
    params.push(hash);
  }
  if (updates.length === 0) return res.json({ ok: true });
  params.push(user.id);
  run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  res.json({ ok: true });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const user = get('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  if (user.id === req.user.id) return res.status(400).json({ error: '자기 자신은 삭제할 수 없습니다.' });
  run('DELETE FROM users WHERE id = ?', [user.id]);
  res.json({ ok: true });
});

router.get('/invites', requireAdmin, (req, res) => {
  const invites = query(`
    SELECT i.*, u.display_name as creator_name, u2.display_name as used_by_name
    FROM invites i
    LEFT JOIN users u ON u.id = i.created_by
    LEFT JOIN users u2 ON u2.id = i.used_by
    ORDER BY i.created_at DESC
  `);
  res.json({ invites });
});

router.post('/invites', requireAdmin, (req, res) => {
  const { role = 'member', expires_days } = req.body;
  const code = crypto.randomBytes(6).toString('hex').toUpperCase();
  const expiresAt = expires_days
    ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
    : null;
  run(
    'INSERT INTO invites (code, created_by, role, expires_at) VALUES (?, ?, ?, ?)',
    [code, req.user.id, role, expiresAt]
  );
  res.json({ code });
});

router.delete('/invites/:id', requireAdmin, (req, res) => {
  run('DELETE FROM invites WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/stats', requireAdmin, (req, res) => {
  const stats = {
    users: get('SELECT COUNT(*) AS n FROM users').n,
    active_users: get('SELECT COUNT(*) AS n FROM users WHERE active = 1').n,
    posts: get('SELECT COUNT(*) AS n FROM posts').n,
    comments: get('SELECT COUNT(*) AS n FROM comments').n,
    images: get('SELECT COUNT(*) AS n FROM post_images').n,
    recent_posts: query(`
      SELECT p.id, p.title, p.created_at, u.display_name
      FROM posts p JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC LIMIT 5
    `),
    top_authors: query(`
      SELECT u.display_name, COUNT(p.id) AS n
      FROM users u LEFT JOIN posts p ON p.user_id = u.id
      GROUP BY u.id ORDER BY n DESC LIMIT 5
    `),
  };
  res.json({ stats });
});

export default router;
