// ==============================================================
// setup.js — Supabase 원클릭 설정 스크립트
//
// 실행 전 .env 파일에 아래 3개 변수가 설정되어 있어야 합니다:
//   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY
//
// 실행: npm run setup
//
// 수행 작업:
//   1. Supabase Storage 'uploads' 버킷 생성 (공개)
//   2. Postgres 스키마 마이그레이션 (테이블 + 인덱스)
//   3. 초기 관리자/샘플 계정 + 샘플 게시글 생성
//   4. 업로드/다운로드 왕복 테스트
// ==============================================================

import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';

const REQUIRED = ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error('\n❌ 필수 환경변수가 설정되지 않았습니다:');
  missing.forEach((k) => console.error(`   - ${k}`));
  console.error('\n.env 파일에 값을 채운 뒤 다시 실행해 주세요.\n');
  process.exit(1);
}

const BUCKET = process.env.SUPABASE_BUCKET || 'uploads';
const SUPA = process.env.SUPABASE_URL.replace(/\/+$/, '');
const SK = process.env.SUPABASE_SERVICE_KEY;

function section(msg) {
  console.log('\n\x1b[34m▶\x1b[0m \x1b[1m' + msg + '\x1b[0m');
}
function ok(msg) { console.log('  \x1b[32m✓\x1b[0m ' + msg); }
function info(msg) { console.log('  \x1b[36m·\x1b[0m ' + msg); }
function warn(msg) { console.log('  \x1b[33m!\x1b[0m ' + msg); }

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      apikey: SK,
      authorization: `Bearer ${SK}`,
      'content-type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function ensureBucket() {
  section(`1) Supabase Storage 버킷 '${BUCKET}' 준비`);
  const list = await fetchJson(`${SUPA}/storage/v1/bucket`);
  if (!list.ok) throw new Error(`버킷 목록 조회 실패 (${list.status}): ${JSON.stringify(list.body)}`);
  const existing = Array.isArray(list.body) ? list.body.find((b) => b.name === BUCKET) : null;
  if (existing) {
    info(`이미 존재함 (public=${existing.public})`);
    if (!existing.public) {
      const upd = await fetchJson(`${SUPA}/storage/v1/bucket/${BUCKET}`, {
        method: 'PUT',
        body: JSON.stringify({ public: true, file_size_limit: 20 * 1024 * 1024 }),
      });
      if (!upd.ok) throw new Error(`버킷 공개 전환 실패: ${JSON.stringify(upd.body)}`);
      ok('버킷을 public으로 전환했습니다.');
    } else {
      ok('버킷이 이미 공개 상태입니다.');
    }
    return;
  }
  const create = await fetchJson(`${SUPA}/storage/v1/bucket`, {
    method: 'POST',
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true,
      file_size_limit: 20 * 1024 * 1024,
      allowed_mime_types: ['image/*'],
    }),
  });
  if (!create.ok) throw new Error(`버킷 생성 실패: ${JSON.stringify(create.body)}`);
  ok(`'${BUCKET}' 버킷 생성됨 (public, 20MB 제한)`);
}

async function testUpload() {
  section(`2) 업로드/다운로드 왕복 테스트`);
  // 1x1 PNG pixel
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64'
  );
  const key = `_setup/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.png`;

  const up = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'POST',
    headers: { apikey: SK, authorization: `Bearer ${SK}`, 'content-type': 'image/png' },
    body: png,
  });
  if (!up.ok) throw new Error(`업로드 실패 (${up.status}): ${await up.text()}`);
  const publicUrl = `${SUPA}/storage/v1/object/public/${BUCKET}/${key}`;
  ok(`업로드 성공: ${publicUrl}`);

  const dl = await fetch(publicUrl);
  if (!dl.ok) throw new Error(`공개 URL 다운로드 실패 (${dl.status}). 버킷이 public인지 확인하세요.`);
  ok('공개 URL로 다운로드 성공');

  const del = await fetch(`${SUPA}/storage/v1/object/${BUCKET}/${key}`, {
    method: 'DELETE',
    headers: { apikey: SK, authorization: `Bearer ${SK}` },
  });
  if (!del.ok) warn(`테스트 파일 삭제 실패 (무시 가능): ${del.status}`);
  else ok('테스트 파일 정리 완료');
}

async function ensureSchemaAndSeed() {
  section(`3) Postgres 스키마 + 시드 데이터`);
  const { ensureSchema, get, run, pool } = await import('./db.js');
  await ensureSchema();
  ok('스키마 마이그레이션 완료 (users, posts, post_images, comments, invites + 인덱스)');

  const admin = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (admin) {
    info('관리자 계정(admin)이 이미 존재합니다.');
  } else {
    const hash = await bcrypt.hash('admin1234', 10);
    await run(
      `INSERT INTO users (username, password_hash, display_name, role, bio)
       VALUES (?, ?, ?, 'admin', ?)`,
      ['admin', hash, '아빠', '우리 가족의 추억을 기록합니다.']
    );
    ok('관리자 계정 생성됨 (admin / admin1234)');
  }

  const totalUsers = await get('SELECT COUNT(*)::int AS n FROM users');
  if (totalUsers.n === 1) {
    const hash = await bcrypt.hash('member1234', 10);
    await run(
      `INSERT INTO users (username, password_hash, display_name, role, bio)
       VALUES (?, ?, ?, 'member', ?)`,
      ['mom', hash, '엄마', '따뜻한 순간들을 담아봅니다.']
    );
    ok('샘플 가족 구성원 추가됨 (mom / member1234)');
  }

  const postCount = await get('SELECT COUNT(*)::int AS n FROM posts');
  if (postCount.n === 0) {
    const ad = await get('SELECT id FROM users WHERE username = ?', ['admin']);
    const mo = await get('SELECT id FROM users WHERE username = ?', ['mom']);
    const samples = [
      { uid: ad.id, title: '우리 가족 블로그를 시작합니다', cat: '일상',
        body: '이곳은 우리 가족만의 작은 기록장입니다.\n\n아이들의 성장, 여행, 함께한 식사, 웃음과 눈물까지 모든 순간을 차곡차곡 담아봅시다.' },
      { uid: mo?.id ?? ad.id, title: '봄꽃 나들이', cat: '여행',
        body: '벚꽃이 만발한 주말, 근처 공원으로 나섰어요. 아이들 볼이 꽃잎처럼 발그레.' },
      { uid: ad.id, title: '첫 걸음마', cat: '아이들',
        body: '오늘 드디어 첫 걸음을 뗐다. 작은 발로 한 걸음, 두 걸음. 뭉클한 오후.' },
    ];
    for (const s of samples) {
      await run(
        'INSERT INTO posts (user_id, title, content, category) VALUES (?, ?, ?, ?)',
        [s.uid, s.title, s.body, s.cat]
      );
    }
    ok('샘플 게시글 3개 추가됨');
  } else {
    info(`게시글이 이미 ${postCount.n}개 존재합니다.`);
  }

  await pool.end();
}

async function main() {
  console.log('\n\x1b[1m🏠 우리 가족 블로그 — 원클릭 설정\x1b[0m');
  console.log(`   SUPABASE_URL = ${SUPA}`);
  console.log(`   BUCKET       = ${BUCKET}`);

  try {
    await ensureBucket();
    await testUpload();
    await ensureSchemaAndSeed();

    console.log('\n\x1b[32m✅ 모든 설정이 완료되었습니다!\x1b[0m');
    console.log('\n다음 단계:');
    console.log('  · 로컬 테스트:  npm run dev  →  http://localhost:3000');
    console.log('  · 배포:          Render 대시보드에서 Blueprint로 배포');
    console.log('\n초기 계정 (배포 직후 반드시 비밀번호 변경):');
    console.log('  · 관리자: admin / admin1234');
    console.log('  · 멤버:   mom   / member1234\n');
  } catch (e) {
    console.error('\n\x1b[31m❌ 설정 중 오류가 발생했습니다:\x1b[0m');
    console.error('   ' + (e.message || e));
    console.error('\n값이 올바른지 확인하고 다시 실행해 주세요.\n');
    process.exit(1);
  }
}

main();
