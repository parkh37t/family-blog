# 우리 가족 블로그 👨‍👩‍👧‍👦

스마트폰·PC 어디서나 바로 쓰고 사진을 올릴 수 있는 가족 전용 블로그입니다.
관리자가 초대코드로 구성원을 초대하고, 구성원은 로그인 후 바로 이야기를 남길 수 있습니다.

차분한 블루 톤 팔레트, 매거진 스타일 그리드, 모바일 퍼스트 UX로 설계했습니다.

---

## ✨ 주요 기능

### 프론트
- **모바일 퍼스트 UI** — 아이폰·안드로이드에서도 탭하기 쉬운 큰 터치 타겟
- **매거진 스타일 피드** — 8n+1 대형 셀 배치, 카테고리 칩 필터, 실시간 검색
- **그라디언트 히어로** — 블루 톤의 세련된 첫 인상
- **게시글 상세** — 사진 갤러리, 좋아요, 댓글, 라이트박스
- **빠른 글쓰기** — 다중 사진 업로드(드래그&드롭, 붙여넣기), 대표 이미지 선택
- **갤러리/구성원 페이지** — 전체 사진 타일, 가족별 작성량 한눈에
- **다크 모드 자동 대응**

### 관리자 (admin 역할 전용)
- **대시보드** — 구성원/게시글/사진/댓글 통계, 최근 글, 작성자 랭킹
- **구성원 관리** — 직접 추가/수정/삭제, 역할 변경, 활성화/정지
- **초대코드 발급** — 역할·만료일 지정, 초대 링크 자동 복사
- **게시글 관리** — 전체 글 일괄 조회·수정·삭제

### 인증 & 보안
- JWT 쿠키 기반 로그인 (30일, `HttpOnly` + 프로덕션 `Secure`)
- bcrypt 비밀번호 해시
- **초대코드 기반 가입** (공개 가입 불가능)

---

## 🚀 로컬에서 실행하기

```bash
npm install
npm run seed       # 초기 관리자 계정 + 샘플 데이터 생성
npm start          # http://localhost:3000
```

### 초기 계정 (반드시 변경!)
| 역할 | 아이디 | 비밀번호 |
|------|--------|----------|
| 관리자 | `admin` | `admin1234` |
| 멤버 | `mom` | `member1234` |

로그인 후 `/me` 에서 비밀번호 변경.

---

## 🌐 웹에 배포하기 (GitHub + Render, 무료)

### Step 1 — GitHub에 푸시

GitHub CLI 사용 (추천):
```bash
gh auth login                                    # 브라우저 인증
gh repo create family-blog --public --source=. --push
```

수동 방법:
1. https://github.com/new 에서 `family-blog` 리포 생성 (Private/Public 자유)
2. 아래 명령어 실행:
```bash
git remote add origin https://github.com/<사용자명>/family-blog.git
git push -u origin main
```

### Step 2 — Render.com에 배포

1. https://dashboard.render.com 접속 → GitHub 계정 연결
2. **New → Blueprint** 선택
3. `family-blog` 리포 선택
4. `render.yaml` 을 자동 감지 → **Apply** 클릭
5. 약 2~3분 후 `https://family-blog-xxxx.onrender.com` 발급

#### 무엇이 자동 설정되나요?
- `NODE_ENV=production`
- `JWT_SECRET` 자동 생성 (Render가 안전한 값 주입)
- 영구 디스크 1GB (`/var/data`)에 SQLite DB + 업로드 사진 저장
- `/healthz` 헬스체크
- 빌드 후 자동으로 `seed.js` 실행 → 관리자 계정 자동 생성

#### 배포 후 첫 로그인
1. 배포된 URL → `/login` 접속
2. `admin` / `admin1234` 로 로그인
3. 즉시 `/me` 에서 비밀번호 변경
4. `/admin` → **구성원 관리**에서 가족 추가 또는 **초대코드** 발급
5. 가족에게 초대 링크 공유 → 모바일에서 바로 가입/글쓰기 가능!

### Step 3 — 스마트폰 홈 화면에 추가 (선택)
- iOS Safari: 공유 → "홈 화면에 추가"
- Android Chrome: 메뉴 → "홈 화면에 추가"
- 브랜드 색(`#f4f7fc`) 적용된 앱처럼 동작합니다.

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
| `/healthz` | 헬스체크 (JSON) | 공개 |

---

## 👨‍👩‍👧 새 가족 구성원 초대하기

1. 관리자로 로그인 → `/admin` → **초대코드** 탭
2. **초대코드 생성** 버튼 → 역할/만료 선택
3. 발급된 **링크 복사** → 카카오톡 등으로 공유
4. 가족이 링크를 열어 `/register`에서 아이디·표시이름·비밀번호만 입력

또는 **구성원 관리** 탭에서 관리자가 계정을 직접 생성해서 아이디/비밀번호를 알려줄 수도 있습니다.

---

## 🛠 기술 스택
- **런타임**: Node.js 22+ (`node:sqlite` 내장 모듈)
- **서버**: Express + JWT + bcryptjs + Multer
- **프론트**: Vanilla JS ES Modules + 모던 CSS (빌드 과정 없음)
- **DB**: SQLite 단일 파일 (영구 디스크)

## 📂 구조
```
family/
├── server.js         # Express 서버
├── db.js             # SQLite 스키마 + 헬퍼
├── seed.js           # 초기 데이터 생성 (idempotent)
├── routes/           # auth, posts, users, uploads
├── middleware/       # 인증 미들웨어
├── public/           # 정적 프론트 (HTML/CSS/JS)
├── render.yaml       # Render 배포 설정
├── .env.example      # 환경변수 예시
└── (data/, uploads/) # 런타임에 생성됨 — gitignore
```

## 🔒 환경변수
| 이름 | 설명 | 필수 |
|------|------|------|
| `NODE_ENV` | `production` 시 secure 쿠키 활성화 + JWT_SECRET 검증 | ✅ |
| `JWT_SECRET` | 토큰 서명 키 (32자+ 무작위) | ✅ (prod) |
| `PORT` | 서버 포트 (기본 3000) | |
| `DATA_DIR` | SQLite DB 저장 경로 | |
| `UPLOADS_DIR` | 업로드 이미지 저장 경로 | |

## 💡 다른 호스팅으로 배포하기
- **Railway**: GitHub 연결 후 Volume 1GB 추가 → `/var/data` 마운트
- **Fly.io**: `fly launch` → Volume 1GB 생성
- **자체 VPS**: `pm2 start server.js` + Nginx 리버스 프록시
