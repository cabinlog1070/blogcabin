# BlogCabin 운영 배포 안내


## 0. 지금 쓰는 배포 방식: GitHub Actions + Docker + SSH (2026-10-08)

`main`에 올리면 `.github/workflows/deploy.yml`이 자동으로 배포한다 (Actions 화면의 **Run workflow**로 직접 실행해도 된다).

1. 서버에 SSH로 접속해 CPU 종류(amd64/arm64)와 Docker 사용 가능 여부를 확인한다
2. 그 CPU에 맞는 Docker 이미지 두 개를 빌드해 파일 하나로 묶는다: 화면 `blogcabin-web`(`frontend/Dockerfile`), 서버 `blogcabin-api`(`backend/Dockerfile`)
3. 이미지 파일·`deploy.env`(DB 주소 등)·`deploy/deploy.sh`를 서버의 `~/blogcabin/releases/`로 보낸다
4. 서버에서 `deploy/deploy.sh`가 이미지를 불러오고 → DB 마이그레이션(서버 이미지) → `db:seed` → (첫 배포만) `admin:create` (이 둘은 화면 이미지) → **롤링 배포**로 서버 두 개, 그다음 화면 두 개를 하나씩 새 이미지로 바꾼다 (아래). 실패하면 그 컨테이너를 직전 이미지로 되돌린다

### 무중단 롤링 배포 (2026-10-14)

```text
https://blogcabin.java21.net ─▶ 서버 관리자 nginx(443) ─▶ 우리 nginx(:8440, blogcabin-nginx)
                                                           ├─ /api/v1/* ─▶ 서버 blogcabin-api-1 (:8443)
                                                           │             └▶ 서버 blogcabin-api-2 (:8444)   ← 번갈아(라운드로빈)
                                                           └─ 나머지 ────▶ 화면 blogcabin-1 (:8441)
                                                                         └▶ 화면 blogcabin-2 (:8442)       ← 번갈아
```

- 2026-10-14부터 저장소를 화면(`frontend/`, Next.js)과 서버(`backend/`, Node + Hono)로 나누는 중이다. 서버가 맡는 주소는 모두 `/api/v1/`로 시작하고, 우리 nginx가 그 주소만 서버로 보낸다. 아직 옮기지 않은 일은 화면(Next.js)이 예전처럼 직접 한다

- 앞의 https nginx는 서버 관리자 것이라 고칠 수 없다. 관리자 nginx가 8440으로 보내 주므로 8440에 **우리 nginx 컨테이너**(`nginx:1.27-alpine`, 서버 네트워크)를 두고, 그 뒤에 앱 두 개를 둔다. 포트는 받은 범위 8440~8449 안에서 8440~8444를 쓴다
- 화면 두 개, 서버 두 개가 늘 같이 손님을 받는다(이중화). 한쪽이 응답하지 않으면 nginx가 다른 쪽으로 다시 보낸다 (`proxy_next_upstream`)
- 배포 순서: **서버 먼저, 그다음 화면** (새 화면이 부를 API가 먼저 있어야 한다). 각각 ① 1번을 nginx에서 빼고(`down`) 새 버전으로 바꿔 상태 확인(화면 `/api/health`, 서버 `/api/v1/health`) → ② 손님을 1번(새 버전)으로 넘기고 2번을 빼서 바꾼다 → ③ 둘 다 다시 받는다. 옛 버전과 새 버전이 동시에 손님을 받지 않아서 화면 파일이 섞이지 않는다
- ①에서 새 버전이 안 뜨면 1번을 직전 이미지로 되돌리고 끝낸다(사이트는 옛 버전 그대로). ②에서 2번이 안 뜨면 1번(새 버전) 하나로 계속 돈다. 서버는 새 버전으로 바뀌었는데 화면이 실패하면 새 서버 + 옛 화면으로 돈다
- **API 바꾸기 주의**: DB처럼 배포하는 동안 옛 화면이 새 서버를 잠깐 부른다. 주소를 지우거나 이름을 바꿀 때는 "새 주소 추가 → 다음 배포에서 옛 주소 정리"처럼 두 번에 나눈다
- 폴더를 나눈 뒤 첫 배포는 서버 두 개를 손님 없이 켜서 상태를 확인한 다음 nginx에 붙이고, 화면은 예전처럼 하나씩 바꾼다 (끊기지 않는다)
- 컨테이너 네 개 모두 같은 DB, 같은 `~/blogcabin/uploads`를 쓴다. 로그인은 DB에 저장돼서 어느 앱으로 가도 그대로다
- **DB 구조 변경 주의**: 마이그레이션은 컨테이너를 바꾸기 전에 한 번 돌고, 바꾸는 동안 옛 버전도 잠깐 그 DB를 쓴다. 칼럼 지우기·이름 바꾸기는 한 번에 하지 말고 "새 칼럼 추가 → 다음 배포에서 옛 칼럼 정리"처럼 두 번에 나눈다
- 처음 이 방식으로 배포할 때만 예전 앱(`blogcabin`, 8440)을 끄고 nginx를 켜는 사이 1초 안팎 끊길 수 있다. 그 뒤로는 끊기지 않는다
- nginx 설정은 배포마다 `~/blogcabin/nginx/`에 다시 만든다 (`nginx.conf`, 컨테이너 상태 `upstream.conf`). 직접 고치지 않는다

| 저장소 시크릿 | 쓰임 |
|---|---|
| `SSH_ADDRESS`, `SSH_PORT`, `SSH_ID`, `SSH_PASSWORD` | 배포 서버 SSH 접속 (비밀번호 방식) |
| `DB_ADDRESS`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | `DATABASE_URL`로 합쳐서 컨테이너에 넘김 (비밀번호의 특수문자는 자동 인코딩) |
| `APP_URL` (선택) | 사용자가 여는 주소. 없으면 `http://SSH_ADDRESS:8440`. 도메인·https를 붙이면 꼭 넣는다 (로그인 쿠키·로그아웃이 이 주소 기준) |
| `TRUSTED_ORIGINS`, `DB_SSLMODE`, `GOOGLE_*`, `KAKAO_*`, `NAVER_*` (선택) | 추가 허용 주소, DB SSL, 소셜 로그인 |

서버 쪽 준비와 폴더:
- Docker가 설치돼 있고, SSH 계정이 `docker`를 쓸 수 있어야 한다 (docker 그룹 또는 비밀번호 없는 sudo)
- `DB_ADDRESS`가 `localhost`이거나 기본 네트워크로 DB에 닿지 않으면 앱이 서버 네트워크를 그대로 쓴다(`--network host`). 앱은 늘 0.0.0.0에서 듣는다: 127.0.0.1로 듣게 하면 블로그 주소(`/@아이디`)가 500이 된다(2026-10-14 핫픽스). 아니면 `-p 127.0.0.1:8441:8441`처럼 서버 안에서만 열린다
- `~/blogcabin/secrets.env`: 첫 배포 때 서버가 만든 로그인 비밀키(`BETTER_AUTH_SECRET`)와 관리자 비밀번호(`ADMIN_PASSWORD`). 지우면 모든 회원이 로그아웃되니 지우지 않는다. 관리자 비밀번호 보기: `grep ADMIN_PASSWORD ~/blogcabin/secrets.env`
- `~/blogcabin/uploads/`: 글 첨부 사진·파일 (컨테이너의 `/data/uploads`). 백업 대상
- 로그 보기: 화면 `docker logs --tail 100 blogcabin-1` (`blogcabin-2`), 서버 `blogcabin-api-1`·`blogcabin-api-2`, nginx는 `blogcabin-nginx`

## 1. 구조: 화면(frontend)과 서버(backend)

저장소 하나에 폴더 두 개다. 원래 **Next.js 16 풀스택 앱 하나**(지금의 `frontend/`)가 화면도 그리고 DB 일도 했고, 2026-10-14부터 DB 일을 영역별로 `backend/`(Node + Hono, 주소 `/api/v1/…`)로 옮기는 중이다. 아래 표의 코드 위치는 `frontend/` 기준이다.

| 폴더 | 하는 일 | 상태 확인 |
|---|---|---|
| `frontend/` | 화면. 아직 옮기지 않은 영역은 Server Action으로 DB를 직접 쓴다. DB 마이그레이션·시드도 여기 | `/api/health` |
| `backend/` | 서버 API `/api/v1/…`. 지금은 상태 확인만 있다 | `/api/v1/health` |

| 역할 | 어디서 도나 | 코드 |
|---|---|---|
| 화면(프론트) | 서버 컴포넌트는 Node 서버에서 HTML로 그리고, 클라이언트 컴포넌트(에디터, 꾸미기 끌어다 놓기, 농장 등)는 브라우저에서 돈다 | `src/app/**/page.tsx`, `src/components/` |
| 광장 게임 | 브라우저에서만 도는 Phaser 4 (서버 일 없음) | `src/components/town/` |
| 서버 로직 | 같은 Node 서버의 **Server Action** (글 저장, 구매, 출석 등) | `src/app/**/actions.ts`, `src/server/` |
| API | 같은 Node 서버의 Route Handler: 로그인 `/api/auth/*`, 첨부 올리기 `/api/uploads`, 첨부 보기 `/files/[키]` | `src/app/api/`, `src/app/files/` |
| 요청 앞단 | `src/proxy.ts` (예전 middleware): 초대 링크 쿠키 등 | `src/proxy.ts` |
| DB | PostgreSQL (Drizzle ORM) | `backend/src/db/schema.ts`, `backend/drizzle/` |
| 첨부 파일 | **서버 디스크** 폴더 (`UPLOAD_DIR`, 기본 `storage/uploads`) | `src/server/storage.ts` |

```text
브라우저 ──HTTPS──▶ 우리 nginx ─┬─ /api/v1/* ─▶ 서버 (backend, Node 24) ──┐
                                └─ 나머지 ────▶ 화면 (frontend, next start) ─┴─▶ PostgreSQL
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

Docker 없이 직접 올릴 때 (지금은 위 0번의 Actions 방식을 쓴다). 화면은 `frontend/`, 서버는 `backend/`에서 실행한다.

처음 한 번:

```bash
npm ci                  # 저장소 맨 위에서 (화면·서버 둘 다)
cd frontend
npm run build
npm run db:migrate      # backend/drizzle/ 마이그레이션을 운영 DB에 적용
npm run db:seed         # 아이템·동물 카탈로그 (여러 번 해도 안전)
npm run admin:create    # 관리자 계정·공지 블로그
npm run start -- -p 3000
cd ../backend && npm run build && PORT=4000 npm start   # 서버 (/api/v1/…)
```

그다음 배포마다: 맨 위에서 `npm ci`, `frontend/`에서 `npm run build && npm run db:migrate && npm run start`, `backend/`에서 `npm run build && npm start`. 앞에 nginx를 두고 `/api/v1/`만 서버(4000)로 보낸다
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
