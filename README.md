# 우리 가족 블로그 👨‍👩‍👧‍👦

스마트폰과 PC 어디서나 바로 쓰고 사진을 올릴 수 있는 가족 전용 블로그입니다.
**완전 무료**로 웹에 배포 가능 (Render 무료 웹 서비스 + Supabase 무료 DB·Storage).

- 🎨 차분한 블루 톤, 모바일 퍼스트 매거진 UI
- 🔐 초대코드 기반 폐쇄형 가입, JWT 쿠키 인증
- 🧑‍💼 관리자 페이지: 대시보드 + 구성원/초대/게시글 관리
- 📷 다중 사진 업로드 (드래그·붙여넣기), 라이트박스
- ☁️ Supabase Postgres + Supabase Storage로 데이터·사진 영구 보관

---

## 🚀 배포 가이드 (Supabase + Render, 완전 무료)

전체 소요 시간 약 **15분**.

### ① Supabase 프로젝트 만들기 (5분)

1. https://supabase.com → **Start your project** → GitHub 로그인
2. **New Project** 클릭
   - Name: `family-blog`
   - Database Password: **아주 긴 무작위 문자열로 설정 + 어딘가에 저장** (나중에 필요!)
   - Region: **Northeast Asia (Seoul)** 선택
   - Plan: **Free**
3. 프로젝트 생성 대기 (약 1~2분)

### ② Storage 버킷 만들기 (1분)

1. 왼쪽 사이드바 → **Storage**
2. **New bucket** 클릭
   - Name: `uploads`
   - **Public bucket**: ✅ 체크 (사진을 블로그에서 직접 접근해야 함)
   - **Allowed MIME types**: `image/*` (선택 사항)
   - **File size limit**: `20 MB`
3. **Save**

### ③ Supabase 환경변수 복사 (2분)

**A) Postgres 연결 문자열**
- 좌측 하단 **Project Settings** → **Database** → **Connection String** → **URI** 탭
- **Mode**: `Transaction` 선택 (권장, 포트 6543)
- 표시된 URL의 `[YOUR-PASSWORD]` 부분을 ①에서 저장한 DB 비밀번호로 교체
- 이게 `DATABASE_URL` 값입니다 → 메모장에 보관

**B) Storage API 키**
- **Project Settings** → **API**
- **Project URL** (예: `https://xxxxxxxx.supabase.co`) → `SUPABASE_URL` 값
- **Project API Keys** 중 **`service_role` (secret)** → `SUPABASE_SERVICE_KEY` 값
  > ⚠️ `anon` 키 말고 **반드시 `service_role`** 키를 복사하세요. 서버가 사진 업로드를 하려면 이 키가 필요합니다.

### ④ Render에 배포 (5분)

1. https://dashboard.render.com → GitHub으로 로그인
2. **New** → **Blueprint**
3. `parkh37t/family-blog` 리포 선택
4. `render.yaml` 자동 감지 → **Apply**
5. 배포 도중 **환경변수 입력 화면**이 나옵니다. ③에서 준비한 값을 붙여넣으세요:
   - `DATABASE_URL` = `postgresql://postgres.xxxx:PW@...pooler.supabase.com:6543/postgres`
   - `SUPABASE_URL` = `https://xxxx.supabase.co`
   - `SUPABASE_SERVICE_KEY` = `eyJhbGciOi...` (긴 JWT 토큰)
6. **Apply** → 빌드 2~3분 대기
7. 완료되면 `https://family-blog-xxxx.onrender.com` 같은 URL 발급

### ⑤ 첫 로그인

1. 발급된 URL → `/login`
2. **admin / admin1234** 로 로그인 (서버 첫 시작 시 자동 생성됨)
3. 즉시 `/me` 에서 비밀번호 변경
4. `/admin` → **초대코드** 탭 → 가족에게 초대 링크 공유 → 모바일에서 바로 가입·사진 올리기 🎉

---

## ⚠️ Render 무료 플랜 참고

- **15분 유휴 시 슬립** → 다음 첫 접속이 30~50초 지연 (이후 즉시)
- 월 100GB 대역폭 (가족용으로 충분)
- **카드 등록 필요 없음**

슬립이 싫으면 Starter $7/월로 업그레이드하면 즉시 응답.

---

## 💻 로컬 개발

1. `.env.example` → `.env` 로 복사하고 Supabase 값 채우기
2. ```bash
   npm install
   npm run seed       # Supabase DB에 관리자/샘플 데이터 생성 (1회)
   npm run dev        # http://localhost:3000
   ```

로컬/프로덕션 모두 같은 Supabase를 쓰므로, 개발하면서 작성한 글이 그대로 웹에 반영됩니다.
분리하고 싶다면 Supabase에서 별도 프로젝트를 하나 더 만들어 `DATABASE_URL`만 다르게 주세요.

### 초기 계정 (배포 직후 반드시 변경)
| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| 관리자 | `admin` | `admin1234` |
| 멤버 | `mom` | `member1234` |

---

## 🧭 URL 맵

| URL | 설명 | 인증 |
|-----|------|------|
| `/` | 블로그 메인 피드 | 공개 |
| `/post/:id` | 게시글 상세 | 공개 |
| `/gallery` | 사진 전체 타일 | 공개 |
| `/members` | 가족 구성원 목록 | 공개 |
| `/write` | 새 글 / 수정 | 멤버+ |
| `/me` | 내 프로필 | 멤버+ |
| `/admin` | 관리자 패널 | 관리자 |
| `/login`, `/register` | 로그인·가입 | 공개 |
| `/healthz` | 헬스체크 JSON | 공개 |

---

## 🛠 기술 스택
- **런타임**: Node.js 22+ (내장 `--env-file` 지원)
- **서버**: Express + JWT + bcryptjs + Multer
- **DB**: PostgreSQL (Supabase Managed, Transaction pooler)
- **Storage**: Supabase Storage (`uploads` bucket, public)
- **프론트**: Vanilla JS ES Modules + 모던 CSS, 빌드 과정 없음
- **호스팅**: Render 무료 웹 서비스

## 📂 구조
```
family/
├── server.js          # Express 서버
├── db.js              # pg Pool + 마이그레이션
├── storage.js         # Supabase Storage 클라이언트
├── seed.js            # 관리자/샘플 데이터 (idempotent)
├── schema.sql         # Supabase SQL Editor 용 스키마
├── routes/            # auth, posts, users, uploads
├── middleware/        # 인증 미들웨어
├── public/            # 정적 프론트 (HTML/CSS/JS)
├── render.yaml        # Render Blueprint
└── .env.example       # 로컬 개발용 환경변수 템플릿
```

## 🔒 환경변수 요약
| 이름 | 설명 | 필수 |
|------|------|------|
| `NODE_ENV` | `production` 시 secure 쿠키 + JWT 검증 | ✅ |
| `JWT_SECRET` | 32자 이상 무작위 문자열 | ✅ |
| `DATABASE_URL` | Supabase Postgres 연결 문자열 | ✅ |
| `SUPABASE_URL` | `https://xxx.supabase.co` | ✅ |
| `SUPABASE_SERVICE_KEY` | `service_role` 시크릿 키 | ✅ |
| `SUPABASE_BUCKET` | 업로드 버킷 이름 (기본 `uploads`) | |
| `PORT` | 기본 3000 | |

## 💡 다른 호스팅으로 배포하기
- **Vercel / Netlify**: 서버리스 전환 필요 (현재 Express 런타임 구조)
- **Railway**: GitHub 연결 → 동일한 env 입력
- **Fly.io**: `Dockerfile` 추가 후 `flyctl deploy`
- **자체 VPS**: `pm2 start server.js` + Nginx 리버스 프록시
