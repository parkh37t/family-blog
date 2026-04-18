import { Router } from 'express';
import { query, get, run, db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

function hydratePost(post) {
  if (!post) return null;
  post.images = query('SELECT id, filename, caption FROM post_images WHERE post_id = ? ORDER BY position ASC, id ASC', [post.id]);
  post.comment_count = get('SELECT COUNT(*) as n FROM comments WHERE post_id = ?', [post.id]).n;
  return post;
}

router.get('/', (req, res) => {
  const { category, user, q, limit = 30, offset = 0 } = req.query;
  const where = ['p.published = 1'];
  const params = [];
  if (category && category !== 'all') { where.push('p.category = ?'); params.push(category); }
  if (user) { where.push('u.username = ?'); params.push(user); }
  if (q) { where.push('(p.title LIKE ? OR p.content LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  const sql = `
    SELECT p.*, u.username, u.display_name, u.avatar as user_avatar
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE ${where.join(' AND ')}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const rows = query(sql, [...params, Number(limit), Number(offset)]);
  rows.forEach(hydratePost);
  res.json({ posts: rows });
});

router.get('/categories', (req, res) => {
  const rows = query(`
    SELECT category, COUNT(*) as count
    FROM posts WHERE published = 1
    GROUP BY category
    ORDER BY count DESC
  `);
  res.json({ categories: rows });
});

router.get('/:id', (req, res) => {
  const post = get(`
    SELECT p.*, u.username, u.display_name, u.avatar as user_avatar, u.bio as user_bio
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `, [req.params.id]);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  run('UPDATE posts SET views = views + 1 WHERE id = ?', [post.id]);
  hydratePost(post);
  post.comments = query(`
    SELECT c.*, u.username, u.display_name, u.avatar
    FROM comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? ORDER BY c.created_at ASC
  `, [post.id]);
  res.json({ post });
});

router.post('/', requireAuth, (req, res) => {
  const { title, content, category = '일상', images = [], cover_image } = req.body;
  if (!title) return res.status(400).json({ error: '제목을 입력해 주세요.' });

  const tx = db.prepare('BEGIN').run.bind(db.prepare('BEGIN'));
  db.exec('BEGIN');
  try {
    const result = run(
      'INSERT INTO posts (user_id, title, content, category, cover_image) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, title, content || '', category, cover_image || (images[0]?.filename ?? null)]
    );
    const postId = result.lastInsertRowid;
    images.forEach((img, i) => {
      run(
        'INSERT INTO post_images (post_id, filename, caption, position) VALUES (?, ?, ?, ?)',
        [postId, img.filename, img.caption || '', i]
      );
    });
    db.exec('COMMIT');
    res.json({ id: postId });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});

router.put('/:id', requireAuth, (req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  if (post.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '권한이 없습니다.' });
  }

  const { title, content, category, images, cover_image } = req.body;
  db.exec('BEGIN');
  try {
    run(
      `UPDATE posts SET title = ?, content = ?, category = ?, cover_image = ?, updated_at = datetime('now') WHERE id = ?`,
      [title ?? post.title, content ?? post.content, category ?? post.category, cover_image ?? post.cover_image, post.id]
    );
    if (Array.isArray(images)) {
      run('DELETE FROM post_images WHERE post_id = ?', [post.id]);
      images.forEach((img, i) => {
        run(
          'INSERT INTO post_images (post_id, filename, caption, position) VALUES (?, ?, ?, ?)',
          [post.id, img.filename, img.caption || '', i]
        );
      });
    }
    db.exec('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', requireAuth, (req, res) => {
  const post = get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  if (post.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '권한이 없습니다.' });
  }
  run('DELETE FROM posts WHERE id = ?', [post.id]);
  res.json({ ok: true });
});

router.post('/:id/like', requireAuth, (req, res) => {
  run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [req.params.id]);
  const p = get('SELECT likes FROM posts WHERE id = ?', [req.params.id]);
  res.json({ likes: p?.likes ?? 0 });
});

router.post('/:id/comments', requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: '댓글을 입력해 주세요.' });
  run('INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)', [req.params.id, req.user.id, content.trim()]);
  res.json({ ok: true });
});

router.delete('/comments/:commentId', requireAuth, (req, res) => {
  const c = get('SELECT * FROM comments WHERE id = ?', [req.params.commentId]);
  if (!c) return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
  if (c.user_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: '권한이 없습니다.' });
  }
  run('DELETE FROM comments WHERE id = ?', [c.id]);
  res.json({ ok: true });
});

export default router;
