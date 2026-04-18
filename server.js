import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authOptional } from './middleware/auth.js';
import { ensureSchema } from './db.js';
import authRoutes from './routes/auth.js';
import postsRoutes from './routes/posts.js';
import usersRoutes from './routes/users.js';
import uploadsRoutes from './routes/uploads.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

if (isProd && (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'family-blog-secret-change-me')) {
  console.error('[FATAL] Production requires a strong JWT_SECRET env var.');
  process.exit(1);
}

app.set('trust proxy', 1);
app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(authOptional);

app.use('/api/auth', authRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/uploads', uploadsRoutes);

app.get('/healthz', (req, res) => res.json({ ok: true, env: isProd ? 'production' : 'development' }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: isProd ? '1h' : '0' }));

const pageMap = {
  '/': 'index.html',
  '/login': 'login.html',
  '/register': 'register.html',
  '/write': 'write.html',
  '/admin': 'admin.html',
  '/me': 'me.html',
  '/gallery': 'gallery.html',
  '/members': 'members.html',
};
Object.entries(pageMap).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(__dirname, 'public', file)));
});
app.get(/^\/post\/(\d+)$/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'post.html')));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || '서버 오류' });
});

// Ensure schema is up-to-date before accepting traffic
await ensureSchema();

app.listen(PORT, () => {
  console.log(`\n가족 블로그 서버 실행 중 (${isProd ? 'production' : 'development'}): http://localhost:${PORT}\n`);
});
