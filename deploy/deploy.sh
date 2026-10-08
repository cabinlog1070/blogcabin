#!/usr/bin/env bash
# BlogCabin 서버 배포 스크립트. GitHub Actions(.github/workflows/deploy.yml)가 SSH로 서버에서 실행한다.
#
#   bash deploy.sh <이미지:태그> <image.tar.gz> <deploy.env> [포트, 기본 8440]
#
# 하는 일
#   1. 이미지 파일을 docker에 불러온다
#   2. 처음 배포면 로그인 비밀키·관리자 비밀번호를 만들어 ~/blogcabin/secrets.env 에 보관한다 (다음 배포부터 재사용)
#   3. DB 구조를 맞추고(db:migrate) 아이템·동물 목록을 넣는다(db:seed, 여러 번 해도 안전)
#   4. 처음 배포면 관리자 계정을 만든다(admin:create)
#   5. 기존 컨테이너를 새 이미지로 바꿔 포트에서 실행하고, /api/health 가 정상인지 확인한다
#   6. 실패하면 직전 이미지로 되돌린다
#
# 서버 폴더 (~/blogcabin)
#   secrets.env  로그인 비밀키·관리자 비밀번호 (지우면 모든 회원이 로그아웃됨)
#   app.env      컨테이너에 넘기는 환경 변수 (매 배포마다 다시 만듦)
#   uploads/     글 첨부 사진·파일 (컨테이너의 /data/uploads)
#   releases/    전송받은 이미지와 이 스크립트
set -euo pipefail

IMAGE_REF="${1:?이미지:태그가 필요해요}"
IMAGE_TAR="${2:?이미지 파일 경로가 필요해요}"
DEPLOY_ENV="${3:?deploy.env 경로가 필요해요}"
PORT="${4:-8440}"
NAME="blogcabin"
BASE="${BLOGCABIN_HOME:-$HOME/blogcabin}"

log() { printf '\n▶ %s\n' "$*"; }
fail() { printf '\n✗ %s\n' "$*" >&2; exit 1; }

# docker: 그냥 되면 그대로, 아니면 비밀번호 없는 sudo
if docker version >/dev/null 2>&1; then
  DOCKER=(docker)
elif sudo -n docker version >/dev/null 2>&1; then
  DOCKER=(sudo -n docker)
else
  fail "docker를 쓸 수 없어요. 이 계정을 docker 그룹에 넣거나 비밀번호 없는 sudo를 허용해 주세요."
fi

mkdir -p "$BASE/uploads" "$BASE/releases"
chmod 700 "$BASE"

# ── 1. 이미지 불러오기 ──
log "이미지 불러오는 중: $IMAGE_REF"
gunzip -c "$IMAGE_TAR" | "${DOCKER[@]}" load

# ── 2. 비밀 값 (처음 한 번만 만든다) ──
FIRST_DEPLOY=0
if [ ! -s "$BASE/secrets.env" ]; then
  FIRST_DEPLOY=1
  log "첫 배포: 로그인 비밀키와 관리자 비밀번호를 만들어 $BASE/secrets.env 에 보관해요"
  (
    umask 077
    {
      echo "BETTER_AUTH_SECRET=$(head -c 48 /dev/urandom | base64 | tr -d '\n=+/' | cut -c1-48)"
      echo "ADMIN_USERNAME=admin"
      echo "ADMIN_PASSWORD=$(head -c 32 /dev/urandom | base64 | tr -d '\n=+/' | cut -c1-20)"
    } > "$BASE/secrets.env"
  )
fi

# DB가 이 서버 안에 있는지 (DB_HOST는 컨테이너에 넘기지 않는다)
DB_HOST_VALUE="$(sed -n 's/^DB_HOST=//p' "$DEPLOY_ENV")"

# ── 컨테이너에 넘길 환경 변수 ──
(
  umask 077
  {
    grep -v '^DB_HOST=' "$DEPLOY_ENV"
    cat "$BASE/secrets.env"
    echo "NODE_ENV=production"
    echo "PORT=$PORT"
    echo "UPLOAD_DIR=/data/uploads"
  } > "$BASE/app.env"
)
rm -f "$DEPLOY_ENV"

# DB가 이 서버 안에 있으면(localhost) 컨테이너가 서버의 네트워크를 그대로 쓰게 한다.
# 아니면 컨테이너 포트만 서버 포트에 연결한다.
case "$DB_HOST_VALUE" in
  localhost|127.0.0.1|::1) NET=(--network host) ;;
  *) NET=(-p "$PORT:$PORT") ;;
esac
ONE_OFF_NET=()
if [ "${NET[0]}" = "--network" ]; then ONE_OFF_NET=(--network host); fi

# 이미지 안의 npm 스크립트를 한 번 실행하고 지운다 (서버 실행용 시작 스크립트는 건너뛴다)
run_once() {
  "${DOCKER[@]}" run --rm --env-file "$BASE/app.env" ${ONE_OFF_NET[@]+"${ONE_OFF_NET[@]}"} \
    -v "$BASE/uploads:/data/uploads" --entrypoint npm "$IMAGE_REF" "$@"
}

# 첨부 폴더는 컨테이너 안의 앱 사용자(node, uid 1000)가 쓸 수 있어야 한다
"${DOCKER[@]}" run --rm --user 0 -v "$BASE/uploads:/data/uploads" --entrypoint sh "$IMAGE_REF" \
  -c 'chown -R node:node /data/uploads' >/dev/null

# ── 3. DB 구조 맞추기 + 기본 데이터 ──
log "DB 마이그레이션"
run_once run db:migrate:prod
log "아이템·동물 목록 (여러 번 해도 안전)"
run_once run db:seed

# ── 4. 첫 배포면 관리자 계정 ──
if [ "$FIRST_DEPLOY" = "1" ] || [ "${RUN_ADMIN_CREATE:-0}" = "1" ]; then
  log "관리자 계정 만들기 (아이디 admin, 비밀번호는 $BASE/secrets.env)"
  run_once run admin:create
fi

# ── 5. 컨테이너 교체 ──
PREV_IMAGE="$("${DOCKER[@]}" inspect --format '{{.Config.Image}}' "$NAME" 2>/dev/null || true)"
log "컨테이너 교체 (이전: ${PREV_IMAGE:-없음})"
"${DOCKER[@]}" rm -f "$NAME" >/dev/null 2>&1 || true

start_container() {
  "${DOCKER[@]}" run -d --name "$NAME" --restart unless-stopped \
    --env-file "$BASE/app.env" "${NET[@]}" \
    -v "$BASE/uploads:/data/uploads" \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$1" >/dev/null
}

healthy() {
  for _ in $(seq 1 45); do
    if "${DOCKER[@]}" exec "$NAME" node -e \
      "fetch('http://127.0.0.1:$PORT/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

start_container "$IMAGE_REF"
log "헬스 체크 (/api/health)"
if healthy; then
  log "배포 완료: 포트 $PORT 에서 실행 중 ($IMAGE_REF)"
else
  echo "--- 최근 로그 ---"
  "${DOCKER[@]}" logs --tail 80 "$NAME" || true
  if [ -n "$PREV_IMAGE" ] && [ "$PREV_IMAGE" != "$IMAGE_REF" ]; then
    log "새 버전이 정상이 아니라 이전 이미지로 되돌려요: $PREV_IMAGE"
    "${DOCKER[@]}" rm -f "$NAME" >/dev/null 2>&1 || true
    start_container "$PREV_IMAGE"
  fi
  fail "새 버전이 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
fi

# ── 6. 정리: 지금 것과 직전 것만 남기고 예전 이미지는 지운다 ──
rm -f "$IMAGE_TAR"
"${DOCKER[@]}" images blogcabin --format '{{.Repository}}:{{.Tag}}' \
  | grep -v -x -e "$IMAGE_REF" -e "${PREV_IMAGE:-__none__}" \
  | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true

if [ "$FIRST_DEPLOY" = "1" ]; then
  echo
  echo "처음 배포라 관리자 계정을 만들었어요. 비밀번호는 서버에서 아래 명령으로 볼 수 있어요:"
  echo "  grep ADMIN_PASSWORD $BASE/secrets.env"
fi
