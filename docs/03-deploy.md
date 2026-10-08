# BlogCabin 운영 배포 안내

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
