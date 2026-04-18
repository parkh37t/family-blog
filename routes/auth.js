import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { get, run } from '../db.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();
const cookieOpts = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '아이디와 비밀번호를 입력해 주세요.' });

    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user || !user.active) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' });

    const token = signToken(user);
    res.cookie('token', token, cookieOpts);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        avatar: user.avatar,
      },
    });
  } catch (e) { next(e); }
});

router.post('/register', async (req, res, next) => {
  try {
    const { username, password, display_name, invite_code } = req.body;
    if (!username || !password || !display_name) {
      return res.status(400).json({ error: '모든 항목을 입력해 주세요.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
    }
    if (!invite_code) {
      return res.status(400).json({ error: '가입을 위해서는 초대코드가 필요합니다.' });
    }

    const inviteRow = await get('SELECT * FROM invites WHERE code = ? AND used_by IS NULL', [invite_code]);
    if (!inviteRow) return res.status(400).json({ error: '초대코드가 유효하지 않습니다.' });
    if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
      return res.status(400).json({ error: '초대코드가 만료되었습니다.' });
    }
    const role = inviteRow.role;

    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });

    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?) RETURNING id',
      [username, hash, display_name, role]
    );
    await run('UPDATE invites SET used_by = ? WHERE id = ?', [result.lastInsertRowid, inviteRow.id]);

    const user = await get('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
    const token = signToken(user);
    res.cookie('token', token, cookieOpts);
    res.json({
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    });
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

router.put('/me', requireAuth, async (req, res, next) => {
  try {
    const { display_name, bio, avatar, password } = req.body;
    const updates = [];
    const params = [];
    if (display_name) { updates.push('display_name = ?'); params.push(display_name); }
    if (bio !== undefined) { updates.push('bio = ?'); params.push(bio); }
    if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar); }
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: '비밀번호는 6자 이상이어야 합니다.' });
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      params.push(hash);
    }
    if (updates.length === 0) return res.json({ ok: true });
    params.push(req.user.id);
    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
