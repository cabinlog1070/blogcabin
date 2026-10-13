@AGENTS.md

# BlogCabin 작업 안내

AI응용프로젝트 개인 프로젝트. 게임형 블로그(Next.js 16 + PostgreSQL + Drizzle + Better Auth + Phaser 4).
사용자는 한국어로 소통하는 학습 중인 개발자이므로, 무엇을 왜 하는지 짧게 설명하며 진행한다.

## 먼저 읽을 것

- `docs/01-requirements.md` 요구사항(ID: AUTH-01 등), `docs/02-erd.md` DB 설계와 결정 이유
- Next.js 16은 학습 데이터와 다르다: `params`/`searchParams`/`cookies()`는 await, `middleware` → `proxy`, `@` 폴더는 parallel route (블로그는 `/@slug` → `/blog/[slug]` rewrite, `src/proxy.ts`에서. `next.config.ts` rewrites는 쿼리를 빠뜨려 쓰지 않는다)
- Phaser 4: `node_modules/phaser/skills/`, 마이그레이션 가이드 `node_modules/phaser/changelog/v4/4.0/MIGRATION-GUIDE.md`

## 규칙

- **스키마 변경**: `src/db/schema.ts` 수정 → `npm run db:generate` → `npm run db:migrate`. `docs/02-erd.md`도 함께 고친다.
- **인증**: 페이지와 Server Action마다 `requireMember()` / `requireUser()` (`src/server/dal.ts`). 레이아웃에서 권한 검사를 하지 않는다. 예외는 로그인 전 `signUp`·`signIn`과 방문자도 세는 `recordBlogVisit`·`recordPostView`(주인 여부를 서버에서 다시 확인).
- **보상·코인**: 잔액 컬럼을 만들지 않는다. `point_ledger`에 기록하고 `getWallet()`으로 계산한다. 지급·차감은 `lockUser(tx, userId)`를 건 트랜잭션 안에서 `grantReward()` 사용 (레벨이 오르면 레벨업 알림도 여기서 생긴다. 원장에 경험치를 직접 넣는 곳은 `recordLevelUps()`를 부른다). 규칙 숫자는 `src/lib/game.ts`.
- **알림**: `notifications` (GAME-08). 공감·댓글처럼 남에게 알릴 일은 그 Server Action의 트랜잭션에서 `notifySocial()`. 자기 행동은 알리지 않는다.
- **헤더 갱신**: 코인·캐릭터가 바뀌는 Server Action은 `revalidatePath("/", "layout")`을 호출한다 (루트 레이아웃은 이동만으로 다시 그려지지 않는다).
- **글 HTML**: 저장 전에 `sanitizePostHtml()`로 정화한다. 허용 태그를 늘리면 에디터와 `src/server/sanitize.ts`를 같이 고친다.
- **그림**: DB에는 `asset_key`만. 실제 모양은 `src/lib/art/`에서 코드로 그린 크레용 그림체 SVG (공통 붓·그림은 `crayon.ts`·`crayon-people.ts`·`crayon-animals.ts`, 그 위에 `characters.ts` 캐릭터, `avatar.ts` 아바타 꾸미기, `furniture.ts` 가구, `backgrounds.ts` 배경, `town.ts` 광장 건물, `animals.ts` 농장 펫과 펫 꾸미기, `farm.ts` 농장 풀밭·울타리). 캐릭터 그림에는 입은 꾸미기를 붙인 "모습 키"(`char.boy+avatar.hat.straw`)를 넘긴다 (`src/server/look.ts`의 `lookSql`). 외부 그림 파일을 쓰지 않는다. 사파리(아이폰)는 `<img>`·CSS 배경 SVG의 필터를 1배로 그려 흐려서, 루트 레이아웃의 `CrispArt`(`src/components/crisp-art.tsx`)가 사파리에서만 화면 픽셀 크기 PNG로 바꿔 끼운다. 광장은 평면 2D다 (아이소메트릭 TOWN-05는 2026-10-11 제외).
- **색**: 오두막·캠프파이어 느낌의 나무 갈색 + 숲 초록. `src/app/globals.css`의 `@theme` 토큰(`cream`·`paper`·`ink`·`bark`·`leaf`·`honey`·`moss`·`sun`·`ember`·`berry`)을 쓰고 컴포넌트에 색 코드를 직접 쓰지 않는다. 글자 대비는 WCAG AA.
- **광장이 메인**: 헤더에 다른 화면으로 가는 메뉴를 두지 않는다. 광장 밖 화면은 헤더의 `← 광장으로 나가기`(`src/components/exit-button.tsx`)로 돌아온다. 새 장소는 광장 건물 입구(`scene.ts`의 `entrances`)로 연결한다.
- **기본 캐릭터**: 가입할 때 남자/여자 주민(`is_starter`) 중 하나만 받는다. 아이템을 바꾸면 `npm run db:seed`.
- **로그인**: 아이디 로그인은 Better Auth `username` 플러그인 (가입은 `src/app/(auth)/actions.ts`, 대체 이메일 `아이디@users.blogcabin.invalid`). 관리자는 `users.role = 'admin'`, `requireAdmin()`. 한 회원 = 아이디 하나: 아이디·비밀번호(credential)가 없는 소셜 회원은 `requireUser()`가 `/account-setup`(아이디 만들기 또는 기존 아이디에 합치기)으로 먼저 보낸다(그 화면 아래에서 탈퇴도 할 수 있다: `withdraw`는 `requireSignedIn`). 소셜 연동 보상(🪙100)은 소셜 계정당 한 번이고, 준 기록은 탈퇴해도 남는 `social_link_rewards`로 막는다. 관리자 계정은 `npm run admin:create` (캐릭터는 여자 주민 `char_girl`, 비밀번호는 `.env.local`에만, 코드·문서에 쓰지 않는다).
- **화면 언어 (NF-27)**: 한국어·일본어. 코드에는 한국어 문장을 그대로 쓰고 `t()`로 감싼다 (서버 `await getT()` from `@/server/i18n`, 클라이언트 `useT()` from `@/components/i18n`, 데이터 표의 문장은 `msg()`). 새 문장은 `src/lib/i18n/ja/`의 영역별 사전에 일본어를 같이 넣는다 (`npm run test:i18n`이 빠진 것을 찾는다). 회원이 쓴 글·닉네임·블로그 이름은 사전으로 번역하지 않는다 (글을 읽는 사람이 누르는 번역 버튼은 POST-10, `src/components/blog/post-translate.tsx`). 아이템·동물 이름은 DB에는 한국어, 화면에서 `t(item.name)`. 언어 바꾸기 `src/app/locale-actions.ts`는 로그인 전에도 쓰므로 `requireUser()`를 걸지 않는다.
- **릴리스 노트**: 주민 눈에 보이는 변경을 main에 올리는(=운영 배포) PR에는 `src/lib/release-notes.ts` 항목을 같이 넣는다. PR 하나(=배포 하나)가 버전 하나다: 오늘(한국 시간) 날짜 묶음의 `versions` 맨 위에 새 버전을 더하고(그날 묶음이 없으면 새 날짜 묶음을 맨 위에 만든다), 번호는 새 기능이 있으면 가운데 숫자를, 바뀐 점·고친 문제뿐이면 끝 숫자를 올린다(`npm run test:release-notes`가 확인한다). 주민이 알아듣는 쉬운 말로 쓰고(파일·함수 이름 같은 개발 용어 없이), 관리자만 쓰는 기능은 `admin: true`. 다른 PR과 이 파일이 충돌하면 두 쪽 항목을 모두 남기고, 나중에 병합되는 쪽을 새 버전으로 맨 위에 두어 번호를 다시 매긴다. 화면이 바뀌지 않는 배포·문서·테스트만의 변경은 넣지 않아도 된다. 화면은 내 정보 메뉴 → 릴리스 노트(`/release-notes`): 날짜마다 접히는 묶음, 가장 최근 날짜만 펼쳐 둔다. 문장은 `msg()`로 감싸고 일본어를 `src/lib/i18n/ja/release-notes.ts`에 같이 넣는다.
- **검증**: `npx tsc --noEmit`, `npx eslint`, `npm test`, 개발 서버를 띄운 상태에서 `npm run db:seed && npm run db:reset && npm run admin:create` 후 `node e2e/auth.mjs <폴더>`, `node e2e/blog.mjs <폴더>`, `node e2e/game.mjs <폴더>`, `node e2e/decorate.mjs <폴더>`, `node e2e/notify.mjs <폴더>`, `node e2e/farm.mjs <폴더>`, `node e2e/batch-d.mjs <폴더>`, `node e2e/batch-d2.mjs <폴더>`, `node e2e/cabin.mjs <폴더>`, `node e2e/admin-members.mjs <폴더>`, `node e2e/account-setup.mjs <폴더>`, `node e2e/social-account.mjs <폴더>`, `node e2e/nickname.mjs <폴더>`, `node e2e/release-notes.mjs <폴더>`, `node e2e/locale.mjs <폴더>`, `node e2e/table.mjs <폴더>`, `node e2e/feed-adjacent.mjs <폴더>`, `node e2e/translate.mjs <폴더>`, `node e2e/shop-save.mjs <폴더>`, `node e2e/comment-edit.mjs <폴더>`, `node e2e/blog-category.mjs <폴더>`, `node e2e/admin-content.mjs <폴더>`, `node e2e/gift.mjs <폴더>`, `node e2e/joystick.mjs <폴더>`, `node e2e/egg-species.mjs <폴더>`, `node e2e/edge-size.mjs <폴더>` (3000번 아니면 `BASE_URL=http://localhost:포트`). 화면 변경은 스크린샷으로 확인한다.
