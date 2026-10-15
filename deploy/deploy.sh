#!/usr/bin/env bash
# BlogCabin 서버 배포 스크립트. GitHub Actions(.github/workflows/deploy.yml)가 SSH로 서버에서 실행한다.
#
#   bash deploy.sh <태그> <image.tar.gz> <deploy.env> [화면 포트 두 개, 기본 "8440 8441"] [화면 시험 포트, 기본 8449]
#                  [서버 API 포트 두 개, 기본 "8442 8443"] [서버 API 시험 포트, 기본 8448]
#
# 이미지는 두 종류다 (저장소의 frontend/·backend/ 폴더)
#   blogcabin-web:<태그>  화면(Next.js). 손님을 받고, /api/v1/…·/api/auth/… 는 짝이 되는 서버 API로 넘긴다.
#                         DB 접속 정보·로그인 비밀키를 받지 않는다 (web.env)
#   blogcabin-api:<태그>  서버 API(backend, Hono). DB·로그인·첨부 파일을 맡는다 (app.env).
#                         DB 마이그레이션·아이템 시드·관리자 계정도 이 이미지로 한다
#
# 앱은 짝 두 개다: 화면 blogcabin-1(8440) → 서버 API blogcabin-api-1(8442),
#                  화면 blogcabin-2(8441) → 서버 API blogcabin-api-2(8443)
# 서버 관리자 nginx(https)는 ~/nginx/<사이트 주소>.conf 의 upstream으로 화면 두 개(8440, 8441)에만 번갈아 보낸다.
# 서버 API 포트는 이 서버 안에서만 쓴다.
#
# 하는 일
#   1. 이미지 파일(두 이미지가 같이 묶여 있다)을 docker에 불러온다
#   2. 처음 배포면 로그인 비밀키·관리자 비밀번호를 만들어 ~/blogcabin/secrets.env 에 보관한다 (다음 배포부터 재사용)
#   3. DB 구조를 맞추고(migrate) 아이템·동물 목록을 넣는다(seed, 여러 번 해도 안전)
#   4. 처음 배포면 관리자 계정을 만든다(create-admin)
#   5. 새 짝(서버 API + 화면)을 시험용 포트(8448·8449)에서 먼저 켜 보고, 정상이면
#      롤링 배포: 짝을 하나씩 멈추고 새 이미지로 바꾼다. 멈춘 쪽은 nginx가 접속 실패를 보고
#      다른 화면으로 다시 보내서(proxy_next_upstream) 사이트가 꺼지지 않는다
#   6. 실패하면 그 짝을 직전 이미지로 되돌린다
#
# 서버 nginx 설정(~/nginx/<사이트 주소>.conf)은 여러 학생이 같이 쓰는 nginx가 읽는다.
# 틀리면 모두의 nginx가 다시 읽기를 못 하니, 이 스크립트는 그 파일에 upstream이 없을 때 딱 한 번만 고친다
# (Certbot 줄은 그대로 두고, 문법을 먼저 검사하고, 원래 파일은 ~/blogcabin/nginx-backup/ 에 남긴다).
# 서버 nginx는 10분마다 스스로 설정을 다시 읽는다.
#
# 서버 폴더 (~/blogcabin)
#   secrets.env  로그인 비밀키·관리자 비밀번호 (지우면 모든 회원이 로그아웃됨)
#   app.env      서버 API에 넘기는 환경 변수 (DB 접속 정보 포함, 매 배포마다 다시 만듦)
#   web.env      화면에 넘기는 환경 변수 (DB 접속 정보·비밀키 없음, 매 배포마다 다시 만듦)
#   uploads/     글 첨부 사진·파일 (서버 API 컨테이너의 /data/uploads, 두 서버 API가 같이 쓴다)
#   releases/    전송받은 이미지와 이 스크립트
set -euo pipefail

TAG="${1:?이미지 태그가 필요해요}"
IMAGE_TAR="${2:?이미지 파일 경로가 필요해요}"
DEPLOY_ENV="${3:?deploy.env 경로가 필요해요}"
read -r -a WEB_PORT <<< "${4:-8440 8441}"
[ "${#WEB_PORT[@]}" -eq 2 ] || { echo "화면 포트는 두 개여야 해요: ${4:-}" >&2; exit 1; }
WEB_CHECK_PORT="${5:-8449}" # 새 이미지를 손님 앱에 넣기 전에 잠깐 켜 보는 시험용 포트 (배포 중에만 쓰고 끈다)
read -r -a API_PORT <<< "${6:-8442 8443}"
[ "${#API_PORT[@]}" -eq 2 ] || { echo "서버 API 포트는 두 개여야 해요: ${6:-}" >&2; exit 1; }
API_CHECK_PORT="${7:-8448}"
WEB_IMAGE="blogcabin-web:$TAG"
API_IMAGE="blogcabin-api:$TAG"
WEB_NAME=("blogcabin-1" "blogcabin-2")         # 화면 두 개 (WEB_PORT 순서대로)
API_NAME=("blogcabin-api-1" "blogcabin-api-2") # 짝이 되는 서버 API 두 개 (API_PORT 순서대로)
WEB_CHECK="blogcabin-check"
API_CHECK="blogcabin-api-check"
BRIDGE_NET="blogcabin-net"                     # 기본 네트워크로 DB에 닿을 때 화면이 서버 API를 이름으로 찾는 네트워크
NGINX_IMAGE="nginx:1.27-alpine"                # 서버 nginx 설정 문법 검사용
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
log "이미지 불러오는 중: $WEB_IMAGE, $API_IMAGE"
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

# DB 위치 (DB_HOST·DB_PORT는 네트워크 확인에만 쓰고 컨테이너에 넘기지 않는다)
DB_HOST_VALUE="$(sed -n 's/^DB_HOST=//p' "$DEPLOY_ENV")"
DB_PORT_VALUE="$(sed -n 's/^DB_PORT=//p' "$DEPLOY_ENV")"
DB_PORT_VALUE="${DB_PORT_VALUE:-5432}"

# ── 컨테이너에 넘길 환경 변수 ──
# 서버 API: DB 접속 정보·비밀 값 전부. 화면: 화면에 보일 값만 (DB 비밀번호·로그인 비밀키는 넣지 않는다)
(
  umask 077
  {
    grep -v -e '^DB_HOST=' -e '^DB_PORT=' "$DEPLOY_ENV"
    cat "$BASE/secrets.env"
    echo "NODE_ENV=production"
    echo "UPLOAD_DIR=/data/uploads"
  } > "$BASE/app.env"
  {
    grep -e '^SUPPORT_EMAIL=' "$DEPLOY_ENV" || true
    echo "NODE_ENV=production"
  } > "$BASE/web.env"
)
rm -f "$DEPLOY_ENV"

# ── 컨테이너가 DB에 닿는 네트워크 고르기 ──
# 컨테이너 기본 네트워크(bridge)에서 서버 자신의 공인 IP나 localhost로는 못 가는 경우가 많다.
# 그래서 실제로 접속해 보고, 안 되면 서버 네트워크를 그대로 쓰는 --network host로 바꾼다.
probe_db() {
  "${DOCKER[@]}" run --rm "$@" --entrypoint node "$API_IMAGE" -e "
    const s = require('net').connect({ host: process.argv[1], port: Number(process.argv[2]) });
    s.setTimeout(5000);
    s.on('connect', () => process.exit(0));
    s.on('timeout', () => process.exit(1));
    s.on('error', () => process.exit(1));
  " "$DB_HOST_VALUE" "$DB_PORT_VALUE" >/dev/null 2>&1
}
log "DB 연결 경로 확인"
HOST_NET=0
case "$DB_HOST_VALUE" in
  localhost|127.0.0.1|::1) HOST_NET=1; echo "DB가 이 서버 안(localhost)에 있어서 서버 네트워크를 그대로 써요" ;;
  *)
    if probe_db; then
      echo "컨테이너 기본 네트워크로 DB에 닿아요 (화면과 서버 API는 $BRIDGE_NET 네트워크로 이어요)"
    elif probe_db --network host; then
      HOST_NET=1; echo "기본 네트워크로는 DB에 닿지 않아 서버 네트워크를 그대로 써요 (--network host)"
    else
      if timeout 5 bash -c "exec 3<>/dev/tcp/$DB_HOST_VALUE/$DB_PORT_VALUE" 2>/dev/null; then
        fail "서버에서는 DB에 닿는데 컨테이너에서는 닿지 않아요. 방화벽이 docker 네트워크를 막는지 확인해 주세요."
      fi
      fail "이 서버에서 DB(DB_ADDRESS:DB_PORT)로 접속이 안 돼요. 주소·포트가 맞는지, DB 쪽 방화벽·PostgreSQL 설정(listen_addresses, pg_hba.conf)이 이 서버를 허용하는지 확인해 주세요."
    fi
    ;;
esac
ONE_OFF_NET=()
if [ "$HOST_NET" = 1 ]; then
  ONE_OFF_NET=(--network host)
elif ! "${DOCKER[@]}" network inspect "$BRIDGE_NET" >/dev/null 2>&1; then
  "${DOCKER[@]}" network create "$BRIDGE_NET" >/dev/null
fi

# 서버 API 이미지의 스크립트를 한 번 실행하고 지운다 (DB 접속 정보가 필요한 일은 모두 서버 API 이미지로)
run_once() {
  "${DOCKER[@]}" run --rm --env-file "$BASE/app.env" ${ONE_OFF_NET[@]+"${ONE_OFF_NET[@]}"} \
    -v "$BASE/uploads:/data/uploads" "$API_IMAGE" node --conditions=react-server "$@"
}

# 첨부 폴더는 컨테이너 안의 앱 사용자(node, uid 1000)가 쓸 수 있어야 한다
"${DOCKER[@]}" run --rm --user 0 -v "$BASE/uploads:/data/uploads" --entrypoint sh "$API_IMAGE" \
  -c 'chown -R node:node /data/uploads' >/dev/null

# ── 3. DB 구조 맞추기 + 기본 데이터 ──
log "DB 마이그레이션"
run_once dist/scripts/migrate.mjs
log "아이템·동물 목록 (여러 번 해도 안전)"
run_once dist/scripts/seed.mjs

# ── 4. 첫 배포면 관리자 계정 ──
# (첫 배포가 중간에 실패했어도 다음 배포에서 만들도록 표시 파일로 확인한다)
ADMIN_CREATED_NOW=0
if [ ! -f "$BASE/.admin-created" ] || [ "${RUN_ADMIN_CREATE:-0}" = "1" ]; then
  log "관리자 계정 만들기 (아이디 admin, 비밀번호는 $BASE/secrets.env)"
  run_once dist/scripts/create-admin.mjs
  touch "$BASE/.admin-created"
  ADMIN_CREATED_NOW=1
fi

# ── 5. 롤링 배포: 짝(서버 API + 화면) 두 개를 하나씩 새 이미지로 바꾼다 ──
# 서버 관리자 nginx가 사이트 주소를 화면 두 개로 번갈아(라운드로빈) 보낸다. 화면 하나를 멈추면
# nginx가 그쪽 접속 실패를 보고 다른 쪽으로 다시 보내서(proxy_next_upstream) 손님은 끊기지 않는다.
# 그 nginx는 우리가 다시 읽게(reload) 할 수 없어서, 우리 쪽은 앱을 멈추고 켜는 것만으로 롤링한다.
# 짝을 바꿀 때는 화면을 먼저 멈춰서, 서버 API가 바뀌는 동안 그 화면이 손님을 받지 않게 한다.

# 컨테이너 네트워크. 늘 0.0.0.0에서 듣는다. 앱을 127.0.0.1로 듣게 하면 Next.js가 블로그 주소(/@아이디) 바꿔 보여주기를
# 바깥 주소로 착각해 https로 자기 자신에게 다시 요청하다 실패해서 500이 났다 (2026-10-14 핫픽스).
net_args() { # 포트
  if [ "$HOST_NET" = 1 ]; then
    echo "--network host"
  else
    echo "--network $BRIDGE_NET -p 127.0.0.1:$1:$1"
  fi
}
# 화면이 짝 서버 API를 부르는 주소
backend_url() { # 서버 API 이름 포트
  if [ "$HOST_NET" = 1 ]; then echo "http://127.0.0.1:$2"; else echo "http://$1:$2"; fi
}

# 서버 API와 따로 도는 화면 이미지인지 (frontend/Dockerfile의 LABEL). 아니면 서버 앱을 안에서 같이 돌리던 예전 화면이다
is_separate_web() { [ "$("${DOCKER[@]}" image inspect --format '{{index .Config.Labels "blogcabin.backend"}}' "$1" 2>/dev/null)" = "separate" ]; }

start_api() { # 이름 포트 이미지
  # shellcheck disable=SC2046
  "${DOCKER[@]}" run -d --name "$1" --restart unless-stopped --stop-timeout 30 \
    --env-file "$BASE/app.env" -e PORT="$2" $(net_args "$2") \
    -v "$BASE/uploads:/data/uploads" \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$3" >/dev/null
}

start_web() { # 이름 포트 이미지 서버API주소
  if is_separate_web "$3"; then
    # shellcheck disable=SC2046
    "${DOCKER[@]}" run -d --name "$1" --restart unless-stopped --stop-timeout 30 \
      --env-file "$BASE/web.env" -e PORT="$2" -e BACKEND_URL="$4" $(net_args "$2") \
      --log-opt max-size=10m --log-opt max-file=3 \
      "$3" >/dev/null
  else
    # 예전 화면으로 되돌릴 때만: 예전 화면은 서버 앱을 안에서 같이 돌려서 DB 접속 정보와 첨부 폴더가 필요하다
    # shellcheck disable=SC2046
    "${DOCKER[@]}" run -d --name "$1" --restart unless-stopped --stop-timeout 30 \
      --env-file "$BASE/app.env" -e PORT="$2" $(net_args "$2") \
      -v "$BASE/uploads:/data/uploads" \
      --log-opt max-size=10m --log-opt max-file=3 \
      "$3" >/dev/null
  fi
}

# 상태 확인. 서버 API: /api/v1/health (DB까지). 화면: /api/health 와 화면을 거친 /api/v1/health (짝 서버 API까지)
healthy() { # 이름 포트 경로… (2초 간격으로 HEALTH_TRIES번)
  local name="$1" port="$2"; shift 2
  local paths; paths="$(printf "'%s'," "$@")"
  for _ in $(seq 1 "${HEALTH_TRIES:-45}"); do
    if "${DOCKER[@]}" exec "$name" node -e "
      const u = 'http://127.0.0.1:$port';
      Promise.all([${paths}].map((p) => fetch(u + p)))
        .then((rs) => process.exit(rs.every((r) => r.ok) ? 0 : 1)).catch(() => process.exit(1));
    " >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}
api_healthy() { healthy "$1" "$2" /api/v1/health; }
web_healthy() { healthy "$1" "$2" /api/health /api/v1/health; }

image_of() { "${DOCKER[@]}" inspect --format '{{.Config.Image}}' "$1" 2>/dev/null || true; }
exists() { "${DOCKER[@]}" inspect "$1" >/dev/null 2>&1; }
show_logs() { local n; for n in "$@"; do echo "--- $n 최근 로그 ---"; "${DOCKER[@]}" logs --tail 80 "$n" 2>&1 || true; done; }
stop_rm() { # 이름… : 처리 중인 요청을 마칠 시간을 주고(SIGTERM, 최대 30초) 지운다
  local n
  for n in "$@"; do
    exists "$n" || continue
    "${DOCKER[@]}" stop -t 30 "$n" >/dev/null 2>&1 || true
    "${DOCKER[@]}" rm -f "$n" >/dev/null 2>&1 || true
  done
}

# 짝 하나 바꾸기: 화면 멈춤 → 서버 API 새로 → 화면 새로. 성공하면 0
replace_pair() { # 번호(0/1) 화면이미지
  local i="$1" web="$2" api
  stop_rm "${WEB_NAME[$i]}"
  if is_separate_web "$web"; then
    api="${web/blogcabin-web:/blogcabin-api:}"
    stop_rm "${API_NAME[$i]}"
    start_api "${API_NAME[$i]}" "${API_PORT[$i]}" "$api" || return 1
    api_healthy "${API_NAME[$i]}" "${API_PORT[$i]}" || return 1
  else
    stop_rm "${API_NAME[$i]}" # 예전 화면은 서버 API가 필요 없다
  fi
  start_web "${WEB_NAME[$i]}" "${WEB_PORT[$i]}" "$web" "$(backend_url "${API_NAME[$i]}" "${API_PORT[$i]}")" || return 1
  web_healthy "${WEB_NAME[$i]}" "${WEB_PORT[$i]}"
}

# ── 서버 nginx 설정(~/nginx/<사이트 주소>.conf)에 upstream 넣기: 없을 때 한 번만 ──
SITE_HOST="$(sed -n 's/^BETTER_AUTH_URL=//p' "$BASE/app.env" | sed -E 's#^[a-z]+://##; s#[:/].*$##')"
SITE_CONF="${SITE_NGINX_CONF:-$HOME/nginx/$SITE_HOST.conf}"
UPSTREAM_NAME="blogcabin_java21_app" # 모든 학생 설정이 한 nginx에 들어가니 이름이 겹치지 않게 길게
setup_site_nginx() {
  if [ ! -f "$SITE_CONF" ]; then
    echo "서버 nginx 설정 파일($SITE_CONF)이 없어서 건너뛰어요. 사이트 주소는 ${WEB_PORT[0]} 하나로만 들어와요."
    return 0
  fi
  if grep -q "upstream $UPSTREAM_NAME" "$SITE_CONF"; then
    echo "서버 nginx 설정에 이미 앱 두 개(upstream)가 있어요: $SITE_CONF"
    return 0
  fi
  if ! grep -Eq "^[[:space:]]*proxy_pass[[:space:]]+http://127\.0\.0\.1:${WEB_PORT[0]};" "$SITE_CONF"; then
    echo "서버 nginx 설정이 예상한 모양(proxy_pass http://127.0.0.1:${WEB_PORT[0]};)이 아니라 고치지 않아요: $SITE_CONF"
    return 0
  fi
  local work new
  work="$(mktemp -d)"; new="$work/site.conf"
  {
    echo "# BlogCabin 앱 두 개 (deploy/deploy.sh가 $(date +%F) 한 번 넣음). 번갈아 보내고, 하나가 멈추면 다른 쪽으로 보낸다"
    echo "upstream $UPSTREAM_NAME {"
    echo "    server 127.0.0.1:${WEB_PORT[0]} max_fails=1 fail_timeout=5s;"
    echo "    server 127.0.0.1:${WEB_PORT[1]} max_fails=1 fail_timeout=5s;"
    echo "}"
    echo
    # proxy_pass만 upstream으로 바꾸고, 접속 실패·502·503이면 다른 앱으로 다시 보내는 줄을 더한다.
    # 첨부(30MB)가 들어오도록 본문 크기를 40M로 늘린다. Certbot 줄을 포함한 나머지는 그대로 둔다
    sed -E \
      -e "s#^([[:space:]]*)proxy_pass[[:space:]]+http://127\.0\.0\.1:${WEB_PORT[0]};#\1proxy_pass http://$UPSTREAM_NAME;\n\1proxy_next_upstream error timeout http_502 http_503;#" \
      -e 's#^([[:space:]]*client_max_body_size[[:space:]]+)[0-9]+[mM];#\140M;#' \
      "$SITE_CONF"
  } > "$new"
  # 문법 검사: 인증서 파일은 이 계정이 못 읽으니 ssl 줄만 빼고 nginx로 검사한다
  sed -E -e '/ssl_certificate|ssl_dhparam|letsencrypt/d' -e 's/listen([[:space:]]+[^;]*)[[:space:]]+ssl/listen\1/' "$new" > "$work/check.conf"
  printf 'pid /tmp/nginx.pid;\nevents {}\nhttp {\n  include /check/check.conf;\n}\n' > "$work/nginx.conf"
  "${DOCKER[@]}" image inspect "$NGINX_IMAGE" >/dev/null 2>&1 || "${DOCKER[@]}" pull -q "$NGINX_IMAGE" >/dev/null 2>&1 || true
  if ! "${DOCKER[@]}" run --rm -v "$work:/check:ro" --entrypoint nginx "$NGINX_IMAGE" -t -q -c /check/nginx.conf; then
    rm -rf "$work"
    echo "새 서버 nginx 설정이 문법 검사를 통과하지 못해서 원래 파일을 그대로 둬요."
    return 0
  fi
  mkdir -p "$BASE/nginx-backup"
  cp -p "$SITE_CONF" "$BASE/nginx-backup/$(basename "$SITE_CONF").$(date +%Y%m%d-%H%M%S).bak"
  cat "$new" > "$SITE_CONF" # 파일 주인·권한은 그대로 두고 내용만 바꾼다
  rm -rf "$work"
  echo "서버 nginx 설정에 앱 두 개(${WEB_PORT[*]})를 넣었어요: $SITE_CONF (원래 파일은 $BASE/nginx-backup/)"
  echo "선생님(관리자)이 nginx를 다시 읽어야(sudo nginx -t && sudo systemctl reload nginx) 적용돼요."
}

# 지금 도는 화면 이미지 (되돌릴 때 쓴다. 서버 API 이미지는 같은 태그). 짝마다 따로 기억한다
PREV0="$(image_of "${WEB_NAME[0]}")"; PREV1="$(image_of "${WEB_NAME[1]}")"
PREV0="${PREV0:-$PREV1}"; PREV1="${PREV1:-$PREV0}"

# ── 미리 시험: 손님 앱을 건드리기 전에 새 짝을 시험용 포트에서 켜 본다 ──
# 서버 nginx는 새 앱이 상태 확인을 통과하기 전에도 손님을 보내므로(우리가 down을 붙일 수 없다),
# 망가진 이미지가 손님을 받지 않게 여기서 먼저 걸러 낸다
log "새 짝을 시험용 포트(서버 API $API_CHECK_PORT, 화면 $WEB_CHECK_PORT)에서 먼저 켜 봐요 (손님은 받지 않아요)"
stop_rm "$WEB_CHECK" "$API_CHECK"
if ! { start_api "$API_CHECK" "$API_CHECK_PORT" "$API_IMAGE" && api_healthy "$API_CHECK" "$API_CHECK_PORT" &&
       start_web "$WEB_CHECK" "$WEB_CHECK_PORT" "$WEB_IMAGE" "$(backend_url "$API_CHECK" "$API_CHECK_PORT")" &&
       web_healthy "$WEB_CHECK" "$WEB_CHECK_PORT"; }; then
  show_logs "$API_CHECK" "$WEB_CHECK"
  stop_rm "$WEB_CHECK" "$API_CHECK"
  fail "새 이미지가 시험용 포트에서 정상으로 뜨지 않았어요. 사이트는 하나도 바꾸지 않았어요. 위 로그를 확인해 주세요."
fi
stop_rm "$WEB_CHECK" "$API_CHECK"

if [ -z "$PREV0" ]; then
  # ── 처음 켜기 ──
  log "처음 준비: 짝 두 개(화면 ${WEB_PORT[*]}, 서버 API ${API_PORT[*]})를 새 이미지로 켜요"
  stop_rm "blogcabin" # 아주 예전 방식(앱 하나)의 컨테이너
  for i in 1 0; do
    if ! replace_pair "$i" "$WEB_IMAGE"; then
      show_logs "${API_NAME[$i]}" "${WEB_NAME[$i]}"
      fail "짝 $((i + 1)) (화면 :${WEB_PORT[$i]}, 서버 API :${API_PORT[$i]})가 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
    fi
  done
else
  # ── 롤링: 2번 짝 → 1번 짝 ──
  log "롤링 1/2 짝 2 (화면 :${WEB_PORT[1]}, 서버 API :${API_PORT[1]}) 를 새 버전으로 바꿔요 (손님은 ${WEB_NAME[0]} 가 받아요)"
  if ! replace_pair 1 "$WEB_IMAGE"; then
    show_logs "${API_NAME[1]}" "${WEB_NAME[1]}"
    log "새 버전이 정상이 아니라 짝 2를 이전 이미지로 되돌려요: $PREV1"
    replace_pair 1 "$PREV1" || true
    fail "새 버전이 정상으로 뜨지 않았어요. 사이트는 이전 버전으로 계속 돌아요. 위 로그를 확인해 주세요."
  fi
  # 서버 nginx는 멈춰 있던 화면 2를 5초(fail_timeout) 동안 "죽음"으로 기억한다. 그 사이 화면 1까지 멈추면 갈 곳이 없어
  # 502가 나니, 화면 2를 다시 쓰기 시작할 때까지 기다린다 (2026-10-14 시험에서 확인).
  # 이 몇 초 동안은 옛 버전(짝 1)과 새 버전(짝 2)이 같이 손님을 받는다
  sleep 8
  log "롤링 2/2 짝 1 (화면 :${WEB_PORT[0]}, 서버 API :${API_PORT[0]}) 를 새 버전으로 바꿔요 (손님은 새 버전 ${WEB_NAME[1]} 가 받아요)"
  if ! replace_pair 0 "$WEB_IMAGE"; then
    show_logs "${API_NAME[0]}" "${WEB_NAME[0]}"
    # 한 사이트에 두 버전이 계속 섞여 있지 않게 둘 다 이전 이미지로 되돌린다
    log "두 짝을 모두 이전 이미지로 되돌려요: 짝 1 $PREV0, 짝 2 $PREV1"
    replace_pair 0 "$PREV0" || true
    sleep 8
    replace_pair 1 "$PREV1" || true
    fail "짝 1이 새 버전으로 뜨지 않아서 두 짝을 이전 버전으로 되돌렸어요. 위 로그를 확인해 주세요."
  fi
fi
log "서버 nginx 설정 확인"
setup_site_nginx
log "배포 완료: 화면 :${WEB_PORT[0]}, :${WEB_PORT[1]} → 서버 API :${API_PORT[0]}, :${API_PORT[1]} ($TAG)"

# ── 6. 정리: 지금 것과 직전 것만 남기고 예전 이미지는 지운다 (폴더를 나누기 전 이름 blogcabin:… 도) ──
PREV_API="${PREV1/blogcabin-web:/blogcabin-api:}"
rm -f "$IMAGE_TAR"
"${DOCKER[@]}" images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E '^blogcabin(-web|-api)?:' \
  | grep -v -x -e "$WEB_IMAGE" -e "$API_IMAGE" -e "${PREV1:-__none__}" -e "${PREV_API:-__none__}" \
  | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true

if [ "$ADMIN_CREATED_NOW" = "1" ]; then
  echo
  echo "관리자 계정을 만들었어요. 비밀번호는 서버에서 아래 명령으로 볼 수 있어요:"
  echo "  grep ADMIN_PASSWORD $BASE/secrets.env"
fi
