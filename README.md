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

## 🌐 웹에 배포하기 (Fly.io, 무료 + 3GB 영구 볼륨)

### Step 1 — flyctl 설치 (Windows PowerShell)

```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

설치 후 PowerShell 재시작하면 `flyctl` 명령 사용 가능.
macOS/Linux는 `curl -L https://fly.io/install.sh | sh`.

### Step 2 — 로그인 및 배포

```bash
cd C:/Users/jaeha/Documents/Cowork/family

# 1) 로그인 (브라우저에서 GitHub 또는 이메일로 가입/로그인)
flyctl auth login

# 2) 앱 생성 (볼륨·시크릿은 뒤에서 따로, 지금은 배포하지 않음)
flyctl launch --no-deploy --copy-config --name family-blog-<고유> --region nrt

# 3) 3GB 영구 볼륨 생성 (SQLite DB + 업로드 사진 저장소)
flyctl volumes create family_blog_data --region nrt --size 3 --yes

# 4) JWT 시크릿 주입 (앱이 production에서 필수로 요구)
flyctl secrets set JWT_SECRET=$(openssl rand -hex 32)

# 5) 배포!
flyctl deploy
```

약 2~4분 후 `https://family-blog-<고유>.fly.dev` 발급됩니다.

> 💡 **무료 플랜 한도**: 3 shared-cpu-1x VM + 3GB 볼륨 + 160GB 아웃바운드/월.
> 가족용 블로그는 한도를 넘을 일이 거의 없습니다. 카드 등록만 되면 과금되지 않습니다.

### Step 3 — 첫 로그인

1. 발급된 URL → `/login` 접속
2. `admin` / `admin1234` 로 로그인 (컨테이너 첫 실행 시 자동 생성됨)
3. 즉시 `/me` 에서 **비밀번호 변경**
4. `/admin` → **초대코드** 탭에서 가족 초대 링크 발급 → 카톡 공유
5. 가족이 링크 클릭 → 모바일에서 바로 가입하고 사진·글 업로드 🎉

### Step 4 — 이후 업데이트
코드를 수정하고 GitHub에 푸시한 뒤:
```bash
flyctl deploy
```
볼륨(사진·DB)은 그대로 유지되고, 앱 코드만 새 버전으로 교체됩니다.

### 유용한 명령어
```bash
flyctl logs                    # 실시간 로그
flyctl status                  # 현재 상태
flyctl ssh console             # 컨테이너 접속
flyctl volumes list            # 볼륨 확인
flyctl secrets list            # 시크릿 목록
flyctl apps destroy <앱명>     # 완전 삭제
```

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
- **Render Starter ($7/월)**: `render.yaml` 포함됨 → Blueprint로 배포 (무료 플랜은 디스크 미지원)
- **Railway**: GitHub 연결 후 Volume 1GB 추가 → `/var/data` 마운트
- **자체 VPS**: `Dockerfile` 그대로 사용 또는 `pm2 start server.js` + Nginx 리버스 프록시
