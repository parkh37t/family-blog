import { Router } from 'express';
import { query, get, run, transaction } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

async function hydratePost(post) {
  if (!post) return null;
  post.images = await query(
    'SELECT id, filename, caption FROM post_images WHERE post_id = ? ORDER BY position ASC, id ASC',
    [post.id]
  );
  const c = await get('SELECT COUNT(*)::int AS n FROM comments WHERE post_id = ?', [post.id]);
  post.comment_count = c?.n ?? 0;
  return post;
}

router.get('/', async (req, res, next) => {
  try {
    const { category, user, q, limit = 30, offset = 0 } = req.query;
    const where = ['p.published = TRUE'];
    const params = [];
    if (category && category !== 'all') { where.push('p.category = ?'); params.push(category); }
    if (user) { where.push('u.username = ?'); params.push(user); }
    if (q) { where.push('(p.title ILIKE ? OR p.content ILIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

    const sql = `
      SELECT p.*, u.username, u.display_name, u.avatar AS user_avatar
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE ${where.join(' AND ')}
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const rows = await query(sql, [...params, Number(limit), Number(offset)]);
    for (const row of rows) await hydratePost(row);
    res.json({ posts: rows });
  } catch (e) { next(e); }
});

router.get('/categories', async (req, res, next) => {
  try {
    const rows = await query(`
      SELECT category, COUNT(*)::int AS count
      FROM posts WHERE published = TRUE
      GROUP BY category
      ORDER BY count DESC
    `);
    res.json({ categories: rows });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const post = await get(`
      SELECT p.*, u.username, u.display_name, u.avatar AS user_avatar, u.bio AS user_bio
      FROM posts p JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `, [req.params.id]);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    await run('UPDATE posts SET views = views + 1 WHERE id = ?', [post.id]);
    await hydratePost(post);
    post.comments = await query(`
      SELECT c.*, u.username, u.display_name, u.avatar
      FROM comments c JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ? ORDER BY c.created_at ASC
    `, [post.id]);
    res.json({ post });
  } catch (e) { next(e); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { title, content, category = '일상', images = [], cover_image } = req.body;
    if (!title) return res.status(400).json({ error: '제목을 입력해 주세요.' });

    const postId = await transaction(async (tx) => {
      const { lastInsertRowid } = await tx.run(
        'INSERT INTO posts (user_id, title, content, category, cover_image) VALUES (?, ?, ?, ?, ?) RETURNING id',
        [req.user.id, title, content || '', category, cover_image || (images[0]?.filename ?? null)]
      );
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        await tx.run(
          'INSERT INTO post_images (post_id, filename, caption, position) VALUES (?, ?, ?, ?)',
          [lastInsertRowid, img.filename, img.caption || '', i]
        );
      }
      return lastInsertRowid;
    });
    res.json({ id: postId });
  } catch (e) { next(e); }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const post = await get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const { title, content, category, images, cover_image } = req.body;
    await transaction(async (tx) => {
      await tx.run(
        `UPDATE posts SET title = ?, content = ?, category = ?, cover_image = ?, updated_at = NOW() WHERE id = ?`,
        [title ?? post.title, content ?? post.content, category ?? post.category, cover_image ?? post.cover_image, post.id]
      );
      if (Array.isArray(images)) {
        await tx.run('DELETE FROM post_images WHERE post_id = ?', [post.id]);
        for (let i = 0; i < images.length; i++) {
          const img = images[i];
          await tx.run(
            'INSERT INTO post_images (post_id, filename, caption, position) VALUES (?, ?, ?, ?)',
            [post.id, img.filename, img.caption || '', i]
          );
        }
      }
    });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const post = await get('SELECT * FROM posts WHERE id = ?', [req.params.id]);
    if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    await run('DELETE FROM posts WHERE id = ?', [post.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/:id/like', requireAuth, async (req, res, next) => {
  try {
    await run('UPDATE posts SET likes = likes + 1 WHERE id = ?', [req.params.id]);
    const p = await get('SELECT likes FROM posts WHERE id = ?', [req.params.id]);
    res.json({ likes: p?.likes ?? 0 });
  } catch (e) { next(e); }
});

router.post('/:id/comments', requireAuth, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: '댓글을 입력해 주세요.' });
    await run(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [req.params.id, req.user.id, content.trim()]
    );
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const c = await get('SELECT * FROM comments WHERE id = ?', [req.params.commentId]);
    if (!c) return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
    if (c.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    await run('DELETE FROM comments WHERE id = ?', [c.id]);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
