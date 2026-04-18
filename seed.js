import bcrypt from 'bcryptjs';
import { ensureSchema, get, run, pool } from './db.js';

async function seed() {
  await ensureSchema();

  const existing = await get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (existing) {
    console.log('이미 초기 관리자 계정이 존재합니다. (admin)');
  } else {
    const hash = await bcrypt.hash('admin1234', 10);
    await run(
      `INSERT INTO users (username, password_hash, display_name, role, bio)
       VALUES (?, ?, ?, 'admin', ?)`,
      ['admin', hash, '아빠', '우리 가족의 추억을 기록합니다.']
    );
    console.log('관리자 계정이 생성되었습니다.');
    console.log('  아이디: admin');
    console.log('  비밀번호: admin1234');
    console.log('  → 로그인 후 반드시 비밀번호를 변경해 주세요!');
  }

  const totalUsers = await get('SELECT COUNT(*)::int AS n FROM users');
  if (totalUsers.n === 1) {
    const hash = await bcrypt.hash('member1234', 10);
    await run(
      `INSERT INTO users (username, password_hash, display_name, role, bio)
       VALUES (?, ?, ?, 'member', ?)`,
      ['mom', hash, '엄마', '따뜻한 순간들을 담아봅니다.']
    );
    console.log('샘플 가족 구성원이 추가되었습니다. (mom / member1234)');
  }

  const postCount = await get('SELECT COUNT(*)::int AS n FROM posts');
  if (postCount.n === 0) {
    const admin = await get('SELECT id FROM users WHERE username = ?', ['admin']);
    const mom = await get('SELECT id FROM users WHERE username = ?', ['mom']);
    const samples = [
      { user_id: admin.id, title: '우리 가족 블로그를 시작합니다', category: '일상',
        content: '이곳은 우리 가족만의 작은 기록장입니다.\n\n아이들의 성장, 여행, 함께한 식사, 웃음과 눈물까지 모든 순간을 차곡차곡 담아봅시다.' },
      { user_id: mom?.id ?? admin.id, title: '봄꽃 나들이', category: '여행',
        content: '벚꽃이 만발한 주말, 근처 공원으로 나섰어요. 아이들 볼이 꽃잎처럼 발그레.' },
      { user_id: admin.id, title: '첫 걸음마', category: '아이들',
        content: '오늘 드디어 첫 걸음을 뗐다. 작은 발로 한 걸음, 두 걸음. 뭉클한 오후.' },
    ];
    for (const s of samples) {
      await run(
        'INSERT INTO posts (user_id, title, content, category) VALUES (?, ?, ?, ?)',
        [s.user_id, s.title, s.content, s.category]
      );
    }
    console.log('샘플 게시글 3개가 추가되었습니다.');
  }

  console.log('\n시드 완료.');
}

seed()
  .then(() => pool.end())
  .catch((e) => {
    console.error(e);
    pool.end();
    process.exit(1);
  });
