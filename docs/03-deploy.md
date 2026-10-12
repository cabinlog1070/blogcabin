# BlogCabin 운영 배포 안내


## 0. 지금 쓰는 배포 방식: GitHub Actions + Docker + SSH (2026-10-08)

`main`에 올리면 `.github/workflows/deploy.yml`이 자동으로 배포한다 (Actions 화면의 **Run workflow**로 직접 실행해도 된다).

1. 서버에 SSH로 접속해 CPU 종류(amd64/arm64)와 Docker 사용 가능 여부를 확인한다
2. 그 CPU에 맞는 Docker 이미지(`Dockerfile`)를 빌드해 파일로 묶는다
3. 이미지 파일·`deploy.env`(DB 주소 등)·`deploy/deploy.sh`를 서버의 `~/blogcabin/releases/`로 보낸다
4. 서버에서 `deploy/deploy.sh`가 이미지를 불러오고 → `db:migrate` → `db:seed` → (첫 배포만) `admin:create` → 컨테이너를 **포트 8440**으로 교체 실행 → `/api/health`가 200인지 확인한다. 실패하면 직전 이미지로 되돌린다

| 저장소 시크릿 | 쓰임 |
|---|---|
| `SSH_ADDRESS`, `SSH_PORT`, `SSH_ID`, `SSH_PASSWORD` | 배포 서버 SSH 접속 (비밀번호 방식) |
| `DB_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | `DATABASE_URL`로 합쳐서 컨테이너에 넘김 (비밀번호의 특수문자는 자동 인코딩) |
| `APP_URL` (선택) | 사용자가 여는 주소. 없으면 `http://SSH_ADDRESS:8440`. 도메인·https를 붙이면 꼭 넣는다 (로그인 쿠키·로그아웃이 이 주소 기준) |
| `TRUSTED_ORIGINS`, `DB_SSLMODE`, `GOOGLE_*`, `KAKAO_*`, `NAVER_*` (선택) | 추가 허용 주소, DB SSL, 소셜 로그인 |

서버 쪽 준비와 폴더:
- Docker가 설치돼 있고, SSH 계정이 `docker`를 쓸 수 있어야 한다 (docker 그룹 또는 비밀번호 없는 sudo)
- `DB_ADDRESS`가 `localhost`면 컨테이너가 서버 네트워크를 그대로 쓴다(`--network host`). 아니면 `-p 8440:8440`
- `~/blogcabin/secrets.env`: 첫 배포 때 서버가 만든 로그인 비밀키(`BETTER_AUTH_SECRET`)와 관리자 비밀번호(`ADMIN_PASSWORD`). 지우면 모든 회원이 로그아웃되니 지우지 않는다. 관리자 비밀번호 보기: `grep ADMIN_PASSWORD ~/blogcabin/secrets.env`
- `~/blogcabin/uploads/`: 글 첨부 사진·파일 (컨테이너의 `/data/uploads`). 백업 대상
- 로그 보기: `docker logs --tail 100 blogcabin`

## 1. 구조: 서버와 프론트가 한 덩어리다

BlogCabin은 **Next.js 16 풀스택 앱 하나**다. 프론트 서버와 API 서버를 따로 띄우지 않는다.

| 역할 | 어디서 도나 | 코드 |
|---|---|---|
| 화면(프론트) | 서버 컴포넌트는 Node 서버에서 HTML로 그리고, 클라이언트 컴포넌트(에디터, 꾸미기 끌어다 놓기, 농장 등)는 브라우저에서 돈다 | `src/app/**/page.tsx`, `src/components/` |
| 광장 게임 | 브라우저에서만 도는 Phaser 4 (서버 일 없음) | `src/components/town/` |
| 서버 로직 | 같은 Node 서버의 **Server Action** (글 저장, 구매, 출석 등) | `src/app/**/actions.ts`, `src/server/` |
| API | 같은 Node 서버의 Route Handler: 로그인 `/api/auth/*`, 첨부 올리기 `/api/uploads`, 첨부 보기 `/files/[키]` | `src/app/api/`, `src/app/files/` |
| 요청 앞단 | `src/proxy.ts` (예전 middleware): 초대 링크 쿠키 등 | `src/proxy.ts` |
| DB | PostgreSQL (Drizzle ORM) | `src/db/schema.ts`, `drizzle/` |
| 첨부 파일 | **서버 디스크** 폴더 (`UPLOAD_DIR`, 기본 `storage/uploads`) | `src/server/storage.ts` |

```text
브라우저 ──HTTPS──▶ Next.js 서버 (Node 24, next start) ──▶ PostgreSQL
                         │
                         └──▶ 디스크 폴더 UPLOAD_DIR (사진·파일)
```

## 2. 운영에 필요한 것

| 항목 | 내용 |
|---|---|
| Node.js | 24 (개발은 v24.21.0) |
| PostgreSQL | 16 이상 권장 (개발은 17). 운영 DB는 매일 백업 (NF-24) |
| 디스크 | 첨부 파일용 **지워지지 않는 디스크(볼륨)**. 서버를 다시 배포해도 남아 있어야 한다 |
| HTTPS | 필수. 로그인 쿠키가 운영에서는 `Secure`로만 전송된다 (NF-11) |
| 도메인 | 예: `https://blogcabin.example.com`. 소셜 로그인 콜백 주소에 쓰인다 |

### 호스팅 고르기

- **추천: 디스크를 붙일 수 있는 컨테이너·VM 호스팅** (Render, Railway, Fly.io, 또는 클라우드 VM + Docker). 지금 코드 그대로 올라간다.
- **Vercel 같은 서버리스**: 화면과 서버 로직은 돌아가지만 **서버 디스크가 남지 않아서 첨부 사진·파일이 사라진다.** 쓰려면 먼저 `src/server/storage.ts`를 S3·Cloudflare R2 같은 저장소로 바꾸는 작업이 필요하다.
- DB는 같은 곳의 관리형 PostgreSQL, Neon, Supabase, 또는 지금 쓰는 Crowfoot 관리형 DB 중 하나.

## 3. 환경 변수 (운영 서버에 설정)

| 이름 | 값 | 비고 |
|---|---|---|
| `DATABASE_URL` | `postgres://사용자:비밀번호@호스트:5432/DB이름` | 관리형 DB면 `?sslmode=require`가 필요할 수 있다 |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` 로 새로 만든 값 | 개발 값을 재사용하지 않는다 |
| `BETTER_AUTH_URL` | 운영 주소, 예: `https://blogcabin.example.com` | 끝에 `/` 없이. 쿠키·콜백·CSRF 확인에 쓰인다 |
| `ADMIN_USERNAME` | `admin` 등 | |
| `ADMIN_PASSWORD` | 12자 이상 추측하기 어려운 값 | NF-14 |
| `UPLOAD_DIR` | 볼륨 경로, 예: `/data/uploads` | 비우면 `storage/uploads` (재배포 때 사라질 수 있음) |
| `GOOGLE_CLIENT_ID` / `_SECRET` | 구글 클라우드 콘솔 | 비우면 그 버튼이 비활성 |
| `KAKAO_CLIENT_ID` / `_SECRET` | 카카오 디벨로퍼스 | 〃 |
| `NAVER_CLIENT_ID` / `_SECRET` | 네이버 개발자센터 | 〃 |

비밀 값은 호스팅 서비스의 환경 변수 화면에만 넣는다. `.env.local`은 Git에 올리지 않는다 (NF-01).

### 소셜 로그인 콜백 주소 (각 개발자 센터에 등록)

- 구글: `https://도메인/api/auth/callback/google`
- 카카오: `https://도메인/api/auth/callback/kakao`
- 네이버: `https://도메인/api/auth/callback/naver`

## 4. 배포 순서

처음 한 번:

```bash
npm ci
npm run build
npm run db:migrate      # drizzle/ 마이그레이션을 운영 DB에 적용
npm run db:seed         # 아이템·동물 카탈로그 (여러 번 해도 안전)
npm run admin:create    # 관리자 계정·공지 블로그
npm run start -- -p 3000
```

그다음 배포마다: `npm ci && npm run build && npm run db:migrate && npm run start`
(아이템을 바꿨으면 `npm run db:seed`도)

- `npm run db:reset`은 **개발 DB를 비우는 명령이라 운영에서 절대 쓰지 않는다.**
- DB 구조는 마이그레이션 파일로만 바꾼다 (NF-22).
- 서버는 하나만 띄운다. 첨부가 디스크에 있어서 서버를 여러 대로 늘리면 파일이 나뉜다 (늘리려면 S3·R2로 바꾼 뒤).

## 5. 배포 뒤 확인

- [ ] `https://도메인` 첫 화면이 열리고, 아이디 회원가입 → 온보딩 → 광장까지 간다
- [ ] 로그인 응답 쿠키에 `HttpOnly; Secure; SameSite=Lax`가 있다 (NF-11)
- [ ] 글에 사진을 올리고, 서버를 다시 시작해도 사진이 보인다 (볼륨 확인)
- [ ] 소셜 로그인 3가지가 각각 된다
- [ ] 휴대폰에서 광장 메뉴, 글쓰기, 꾸미기 끌어다 놓기, 농장이 된다
- [ ] `/feed`가 1초 안에 보인다 (NF-07, `e2e/nonfunctional.mjs`)
- [ ] DB 자동 백업이 켜져 있다 (NF-24)

## 6. 아직 정할 것

- 호스팅 서비스와 DB 서비스
- 도메인
- 첨부를 디스크에 둘지, S3·R2로 바꿀지 (서버리스나 서버 여러 대를 쓰려면 바꿔야 함)
- `main`에 올리면 자동 배포할지 (NF-08), PR마다 자동 검사(CI)를 돌릴지 (NF-23)
