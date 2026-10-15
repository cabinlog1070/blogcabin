# 협업 가이드

BlogCabin 팀(ehgo508, chang0580, jiwon934)이 함께 작업하는 방법입니다. 처음이라면 위에서부터 한 번 읽어 주세요.

## 한눈에 보기 (git flow)

```text
feat/* ──PR──▶ develop ──release/버전──▶ main ──▶ 운영 배포
                  ▲                         │
                  └──────── 되돌려 합치기 ◀──┘
hotfix/* (급한 수정): main에서 만들어 main으로 → 다시 develop에도 합치기
```

1. Issue에서 내 할 일 확인
2. **`develop`에서** 내 브랜치(`feat/…`, `fix/…`) 만들기
3. 브랜치에서 수정하고 커밋
4. **`develop`으로** PR 올리기 → 리뷰·승인 → merge (아직 운영에는 안 나감)
5. 배포할 때: `develop`에서 `release/1.33.0` 브랜치 → 릴리스 노트·버전 정리 → `main`으로 PR → merge = **운영 배포**
6. 배포가 끝나면 `main`을 `develop`에 다시 합친다

### 왜 이렇게 하나요?

`main`은 **지금 운영 중인 사이트와 똑같은 것**입니다. `main`에 merge되면 바로 운영 서버에 배포됩니다.
`develop`은 **다음 배포에 나갈 것들을 모아 두는 곳**입니다. 다 만든 기능은 먼저 `develop`에 모아 두고, 배포하고 싶을 때 한꺼번에 `main`으로 보냅니다.
반쯤 고친 내용이 운영에 나가거나, 서로의 수정을 덮어쓰는 일을 막기 위해서입니다.

| Git | 회사 문서에 비유하면 |
|---|---|
| `main` | 지금 게시된 공식 문서 |
| `develop` | 다음 판에 들어갈 원고 모음 |
| `feat/…` 브랜치 | 내 책상 위 초안 |
| `release/…` 브랜치 | 인쇄 직전 최종 교정본 |
| `hotfix/…` 브랜치 | 게시된 문서의 긴급 정정 |
| 커밋 | 초안 중간 저장 |
| PR | 결재 요청서 |
| Approve | 검토 승인 |
| merge | 원고 모음(또는 공식 문서)에 반영 |

## 팀 규칙

1. **`main`·`develop`에 직접 커밋하지 않는다.** 항상 브랜치 → PR.
   - 기능·수정 PR은 `develop`으로. `main`으로 가는 PR은 `release/…`, `hotfix/…`뿐이다.
2. **PR은 작성자가 아닌 팀원 1명 이상이 승인**한다.
3. **merge는 ehgo508이 한다.** 본인 PR을 본인이 merge하지 않는다.
4. **작업을 시작하기 전에 최신 `develop`을 받는다.** (충돌 예방, 급한 수정만 `main`)
5. **비밀값은 저장소에 올리지 않는다.** `.env.local`, 비밀번호, API 키는 카톡 등 별도 채널로 전달한다.
6. 실수로 `main`·`develop`에 커밋했거나 충돌이 나서 막히면 **혼자 해결하려 하지 말고 바로 팀에 알린다.**

> 이 저장소는 개인 비공개 저장소라서 GitHub가 위 규칙을 강제하지 못합니다. 서로 약속으로 지켜 주세요.

## 역할

| 담당 | 요구사항 영역 | 이슈 | 브랜치 |
|---|---|---|---|
| ehgo508 | 4.1 회원·인증, 5. 비기능 | - | `docs/req-nonfunctional` |
| chang0580 | 4.2 블로그, 4.3 글, 4.4 교류 | #2 | `docs/req-blog-post-social` |
| jiwon934 | 4.5 캐릭터·성장, 4.6 상점·꾸미기, 4.7 광장 | #3 | `docs/req-game-shop-town` |

## 작업 방법 A. GitHub 웹에서 (문서 작업 추천)

설치 없이 브라우저만으로 할 수 있습니다.

### 처음 PR 만들기

> 요구사항·ERD 같은 문서는 이 저장소가 아니라 **문서 저장소 [cabinlog1070/docs](https://github.com/cabinlog1070/docs)** 에 있습니다. 문서 저장소는 `develop` 없이 **`main`** 하나로 운영하므로, 아래 순서에서 `develop` 자리를 `main`으로 바꿔 읽으면 됩니다.

1. 저장소 화면 왼쪽 위 브랜치 버튼이 **`develop`** 인지 확인하고(문서 저장소는 `main`), 고칠 파일(예: 문서 저장소의 `docs/01-requirements.md`)을 엽니다.
2. 오른쪽 위 **✏️ (Edit this file)** 을 누릅니다.
3. 수정합니다. 위쪽 **Preview** 탭으로 결과를 미리 볼 수 있습니다.
4. 오른쪽 위 **Commit changes...** 를 누릅니다.
5. 커밋 메시지를 적고, **반드시 아래를 선택**합니다.

   ```text
   ○ Commit directly to the develop branch                               ← ❌ 고르지 않기
   ● Create a new branch for this commit and start a pull request        ← ✅ 이것
   ```

   브랜치 이름은 [역할](#역할) 표의 이름을 적습니다.
6. **Propose changes** → PR 화면 위쪽 **base** 가 `develop`인지 확인 → **Create pull request**.

### 이어서 더 고치기

1. 파일 화면 왼쪽 위 **브랜치 선택 버튼**에서 `develop` 대신 **내 브랜치**를 고릅니다.
2. ✏️로 수정 → **Commit changes...** → **Commit directly to the `내 브랜치` branch**.
3. 같은 브랜치에 커밋하면 **이미 만든 PR에 자동으로 추가**됩니다. PR을 새로 만들지 않아도 됩니다.

## 작업 방법 B. 내 컴퓨터에서 (코드 작업)

처음 한 번은 [README의 실행 방법](README.md#실행-방법)대로 설치합니다.

코드는 두 폴더에 있습니다: 화면은 `frontend/`, 서버 API(`/api/v1/…`, 로그인 `/api/auth/…`)는 `backend/`. 설치는 저장소 맨 위에서 `npm install` 한 번이고, 그 밖의 `npm` 명령은 고치는 쪽 폴더에 들어가서 실행합니다. DB 구조(`backend/src/db/schema.ts`)와 마이그레이션(`backend/drizzle/`)은 서버 폴더에 있습니다. 화면은 DB를 직접 읽지 않습니다: 새 화면이 데이터를 읽거나 저장하려면 `backend/src/routes/`에 주소를 만들고, 화면은 `src/server/read-api.ts`(서버 쪽 페이지)나 `src/lib/api.ts`(브라우저)로 부릅니다. 개발할 때는 화면·서버 개발 서버를 둘 다 켭니다. PR을 올리면 GitHub가 두 폴더를 각각 검사(CI)합니다.

```bash
# 작업 시작: 최신 develop에서 내 브랜치 만들기
git switch develop
git pull
git switch -c docs/req-blog-post-social

# ... 수정 ...

git add 바꾼파일
git commit -m "요구사항: BLOG-01~03 상세 명세"
git push -u origin docs/req-blog-post-social   # 처음 push할 때만 -u

# PR 만들기: 받는 쪽(base)은 develop (또는 GitHub 화면의 "Compare & pull request" 버튼)
gh pr create --base develop
```

이어서 고칠 때는 같은 브랜치에서 `git add` → `git commit` → `git push`만 하면 PR에 추가됩니다.

## 배포하기 (release)

`develop`에 모인 것을 운영에 내보낼 때입니다.

```bash
git switch develop && git pull
git switch -c release/1.33.0          # 이번에 나갈 버전 번호
# 릴리스 노트(frontend/src/lib/release-notes.ts + 일본어) 정리, DB 변경 번호 확인, 검사 실행
git push -u origin release/1.33.0
gh pr create --base main              # 이 PR을 merge하면 운영 배포
```

배포가 끝나면 `main`을 `develop`에 되돌려 합칩니다 (release 브랜치에서 고친 것이 develop에도 들어가게).

```bash
git switch develop && git pull
git merge origin/main && git push
```

## 급한 수정 (hotfix)

운영에서 바로 고쳐야 하는 문제는 `develop`을 기다리지 않습니다.

```bash
git switch main && git pull
git switch -c hotfix/1.32.7-login-error
# 고치고, 릴리스 노트 끝 숫자 +1
gh pr create --base main              # merge하면 바로 배포
```

배포 뒤에는 위와 같이 `main`을 `develop`에 합칩니다.

## 브랜치 이름

| 종류 | 형식 | 예 |
|---|---|---|
| 문서 | `docs/설명` | `docs/req-blog-post-social` |
| 새 기능 | `feat/설명` | `feat/image-upload` |
| 버그 수정 | `fix/설명` | `fix/mobile-header-menu` |
| 정리 (기능 변화 없음) | `refactor/설명` | `refactor/blog-queries` |
| 배포 준비 (develop → main) | `release/버전` | `release/1.33.0` |
| 급한 운영 수정 (main → main) | `hotfix/버전-설명` | `hotfix/1.32.7-login-error` |

`feat/`·`fix/`·`docs/`·`refactor/`는 `develop`에서 만들어 `develop`으로, `release/`는 `develop`에서 만들어 `main`으로, `hotfix/`는 `main`에서 만들어 `main`으로 보냅니다.

영문 소문자와 `-`만 씁니다.

## 커밋 메시지

**무엇을 왜 바꿨는지** 한국어 한 줄로 적습니다.

```text
✅ 요구사항: BLOG-01~03 상세 명세 추가
✅ 모바일에서 헤더 메뉴가 숨는 문제 수정
❌ 수정
❌ asdf
```

## PR 올릴 때

- 제목: 무엇을 했는지 한 줄. 예) `요구사항 명세서: 4.2 블로그 상세화`
- 본문: PR 템플릿의 체크리스트를 채웁니다.
- 관련 Issue가 있으면 본문에 `Closes #2`를 적습니다. merge되면 그 Issue가 자동으로 닫힙니다.
- 코드를 바꿨다면 merge 전에 아래 검사를 통과해야 합니다.

  ```bash
  npx tsc --noEmit        # 타입 검사
  npx eslint              # 코드 규칙 검사
  npm run test:sanitize   # 글 HTML 정화 테스트
  # 화면을 바꿨다면 개발 서버를 띄우고 e2e/ 시나리오 실행 (README 참고)
  ```

## 리뷰하는 방법

1. PR → **Files changed** 탭에서 바뀐 내용을 봅니다. (초록 = 추가, 빨강 = 삭제)
2. 궁금하거나 고칠 곳은 줄 번호 옆 **+** 를 눌러 댓글을 남깁니다.
   - 직접 고친 문장을 제안하려면 댓글 창의 **Suggestion(±)** 버튼을 씁니다. 작성자는 **Commit suggestion**으로 바로 반영할 수 있습니다.
3. 다 봤으면 오른쪽 위 **Review changes** →
   - 문제없음: **Approve**
   - 고쳐야 함: **Request changes** (무엇을 고칠지 적기)
   - 의견만: **Comment**

리뷰는 사람이 아니라 **내용**에 대해 씁니다. "틀렸어요"보다 "이 경우는 어떻게 될까요?"처럼 질문으로 남기면 좋습니다.

## 자주 생기는 상황

| 상황 | 해결 |
|---|---|
| 리뷰에서 수정 요청을 받음 | 같은 브랜치에 고쳐서 커밋 → PR이 자동으로 갱신 |
| 작업 중 다른 PR이 먼저 merge됨 | 웹: PR 아래 **Update branch** / 터미널: `git pull origin develop` |
| 충돌(conflict) 발생 | 같은 줄을 둘이 고친 경우. 웹: PR의 **Resolve conflicts** / 터미널: `<<<<<<<` `=======` `>>>>>>>` 표시를 정리하고 커밋. 막히면 팀에 알리기 |
| 실수로 `main`·`develop`에 커밋함 | 지우거나 강제로 되돌리지 말고 **바로 팀에 알리기** |
| PR을 잘못 만듦 | PR 화면 아래 **Close pull request** (merge 전이면 develop·main에 영향 없음) |
| PR의 받는 쪽이 `main`으로 되어 있음 | PR 제목 옆 **Edit** → base를 `develop`으로 바꾸기 |

## 요구사항 명세서를 쓸 때

- 문서 저장소의 [`docs/01-requirements.md`](https://github.com/cabinlog1070/docs/blob/main/docs/01-requirements.md)의 **4.0 작성 양식**을 따릅니다. AUTH-07, AUTH-09, AUTH-02가 작성 예시입니다.
- 요구사항 **ID는 한 번 정하면 바꾸지 않습니다.** 없앤 요구사항은 지우지 말고 상태를 `❌ 제외`로 바꿉니다.
- 모르는 것은 지어내지 말고 **열린 질문**에 적어서 회의에서 정합니다.
- 고치면 문서 위쪽 **변경 이력**에 한 줄 추가합니다.
- DB와 관련된 내용을 바꾸면 같은 저장소의 [`docs/02-erd.md`](https://github.com/cabinlog1070/docs/blob/main/docs/02-erd.md)도 함께 고칩니다.

## 할 일 관리 (Issue)

- 할 일 하나 = Issue 하나. 담당자(Assignees)를 지정합니다.
- 버그를 발견하면 Issue로 남깁니다: 무엇이, 어디서, 어떻게 하면 생기는지, 스크린샷.
- 라벨: `documentation`(문서), `bug`(버그), `enhancement`(새 기능)
