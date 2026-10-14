#!/usr/bin/env bash
# BlogCabin 서버 배포 스크립트. GitHub Actions(.github/workflows/deploy.yml)가 SSH로 서버에서 실행한다.
#
#   bash deploy.sh <태그> <image.tar.gz> <deploy.env> [앱 포트 두 개, 기본 "8440 8441"]
#
# 이미지는 두 종류다 (저장소의 frontend/·backend/ 폴더)
#   blogcabin-web:<태그>  손님을 받는 앱. 화면(Next.js)이 서버(backend) /api/v1/… 도 안에서 같이 돌린다
#                         (frontend/src/app/api/v1/[...path]/route.ts). 시드·관리자 계정도 이 이미지로 돌린다
#   blogcabin-api:<태그>  서버(backend). 배포 때 DB 구조(마이그레이션)를 맞추는 데만 쓴다
#
# 하는 일
#   1. 이미지 파일(두 이미지가 같이 묶여 있다)을 docker에 불러온다
#   2. 처음 배포면 로그인 비밀키·관리자 비밀번호를 만들어 ~/blogcabin/secrets.env 에 보관한다 (다음 배포부터 재사용)
#   3. DB 구조를 맞추고(migrate) 아이템·동물 목록을 넣는다(db:seed, 여러 번 해도 안전)
#   4. 처음 배포면 관리자 계정을 만든다(admin:create)
#   5. 롤링 배포: 서버 관리자 nginx(https)가 ~/nginx/<사이트 주소>.conf 의 upstream으로 앱 두 개(8440, 8441)에
#      번갈아(라운드로빈) 보낸다. 앱을 하나씩 멈추고 새 이미지로 바꾼다. 멈춘 쪽은 nginx가 접속 실패를 보고
#      다른 쪽으로 다시 보내서(proxy_next_upstream) 사이트가 꺼지지 않는다
#   6. 실패하면 그 앱을 직전 이미지로 되돌린다
#
# 서버 nginx 설정(~/nginx/<사이트 주소>.conf)은 여러 학생이 같이 쓰는 nginx가 읽는다.
# 틀리면 모두의 nginx가 다시 읽기를 못 하니, 이 스크립트는 그 파일에 upstream이 없을 때 딱 한 번만 고친다
# (Certbot 줄은 그대로 두고, 문법을 먼저 검사하고, 원래 파일은 ~/blogcabin/nginx-backup/ 에 남긴다).
# 고친 파일은 선생님(관리자)이 nginx를 다시 읽어야(reload) 적용된다. 그 전까지 서버 nginx는 8440 하나만 안다.
#
# 서버 폴더 (~/blogcabin)
#   secrets.env  로그인 비밀키·관리자 비밀번호 (지우면 모든 회원이 로그아웃됨)
#   app.env      컨테이너에 넘기는 환경 변수 (매 배포마다 다시 만듦)
#   uploads/     글 첨부 사진·파일 (컨테이너의 /data/uploads, 두 앱이 같이 쓴다)
#   releases/    전송받은 이미지와 이 스크립트
set -euo pipefail

TAG="${1:?이미지 태그가 필요해요}"
IMAGE_TAR="${2:?이미지 파일 경로가 필요해요}"
DEPLOY_ENV="${3:?deploy.env 경로가 필요해요}"
read -r -a APP_PORT <<< "${4:-8440 8441}"
[ "${#APP_PORT[@]}" -eq 2 ] || { echo "앱 포트는 두 개여야 해요: ${4:-}" >&2; exit 1; }
WEB_IMAGE="blogcabin-web:$TAG"
API_IMAGE="blogcabin-api:$TAG"
APP_NAME=("blogcabin-1" "blogcabin-2")   # 앱 두 개 (APP_PORT 순서대로)
# 예전 구성(우리 nginx 컨테이너 + 화면 두 개 + 서버 두 개)의 컨테이너. 처음 바꿀 때 하나씩 내린다
OLD_PROXY="blogcabin-nginx"
OLD_API=("blogcabin-api-1" "blogcabin-api-2")
NGINX_IMAGE="nginx:1.27-alpine"           # 서버 nginx 설정 문법 검사용
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
(
  umask 077
  {
    grep -v -e '^DB_HOST=' -e '^DB_PORT=' "$DEPLOY_ENV"
    cat "$BASE/secrets.env"
    echo "NODE_ENV=production"
    echo "UPLOAD_DIR=/data/uploads"
  } > "$BASE/app.env"
)
rm -f "$DEPLOY_ENV"

# ── 컨테이너가 DB에 닿는 네트워크 고르기 ──
# 컨테이너 기본 네트워크(bridge)에서 서버 자신의 공인 IP나 localhost로는 못 가는 경우가 많다.
# 그래서 실제로 접속해 보고, 안 되면 서버 네트워크를 그대로 쓰는 --network host로 바꾼다.
probe_db() {
  "${DOCKER[@]}" run --rm "$@" --entrypoint node "$WEB_IMAGE" -e "
    const s = require('net').connect({ host: process.argv[1], port: Number(process.argv[2]) });
    s.setTimeout(5000);
    s.on('connect', () => process.exit(0));
    s.on('timeout', () => process.exit(1));
    s.on('error', () => process.exit(1));
  " "$DB_HOST_VALUE" "$DB_PORT_VALUE" >/dev/null 2>&1
}
log "DB 연결 경로 확인"
case "$DB_HOST_VALUE" in
  localhost|127.0.0.1|::1) NET=(--network host); echo "DB가 이 서버 안(localhost)에 있어서 서버 네트워크를 그대로 써요" ;;
  *)
    if probe_db; then
      NET=(-p "127.0.0.1:${APP_PORT[0]}:${APP_PORT[0]}"); echo "컨테이너 기본 네트워크로 DB에 닿아요"
    elif probe_db --network host; then
      NET=(--network host); echo "기본 네트워크로는 DB에 닿지 않아 서버 네트워크를 그대로 써요 (--network host)"
    else
      if timeout 5 bash -c "exec 3<>/dev/tcp/$DB_HOST_VALUE/$DB_PORT_VALUE" 2>/dev/null; then
        fail "서버에서는 DB에 닿는데 컨테이너에서는 닿지 않아요. 방화벽이 docker 네트워크를 막는지 확인해 주세요."
      fi
      fail "이 서버에서 DB(DB_ADDRESS:DB_PORT)로 접속이 안 돼요. 주소·포트가 맞는지, DB 쪽 방화벽·PostgreSQL 설정(listen_addresses, pg_hba.conf)이 이 서버를 허용하는지 확인해 주세요."
    fi
    ;;
esac
ONE_OFF_NET=()
if [ "${NET[0]}" = "--network" ]; then ONE_OFF_NET=(--network host); fi

# 이미지 안의 npm 스크립트를 한 번 실행하고 지운다 (서버 실행용 시작 스크립트는 건너뛴다)
run_once() {
  "${DOCKER[@]}" run --rm --env-file "$BASE/app.env" ${ONE_OFF_NET[@]+"${ONE_OFF_NET[@]}"} \
    -v "$BASE/uploads:/data/uploads" --entrypoint npm "$WEB_IMAGE" "$@"
}

# 첨부 폴더는 컨테이너 안의 앱 사용자(node, uid 1000)가 쓸 수 있어야 한다
"${DOCKER[@]}" run --rm --user 0 -v "$BASE/uploads:/data/uploads" --entrypoint sh "$WEB_IMAGE" \
  -c 'chown -R node:node /data/uploads' >/dev/null

# ── 3. DB 구조 맞추기 + 기본 데이터 ──
log "DB 마이그레이션 (서버 이미지)"
"${DOCKER[@]}" run --rm --env-file "$BASE/app.env" ${ONE_OFF_NET[@]+"${ONE_OFF_NET[@]}"} \
  "$API_IMAGE" node dist/scripts/migrate.mjs
log "아이템·동물 목록 (여러 번 해도 안전)"
run_once run db:seed

# ── 4. 첫 배포면 관리자 계정 ──
# (첫 배포가 중간에 실패했어도 다음 배포에서 만들도록 표시 파일로 확인한다)
ADMIN_CREATED_NOW=0
if [ ! -f "$BASE/.admin-created" ] || [ "${RUN_ADMIN_CREATE:-0}" = "1" ]; then
  log "관리자 계정 만들기 (아이디 admin, 비밀번호는 $BASE/secrets.env)"
  run_once run admin:create
  touch "$BASE/.admin-created"
  ADMIN_CREATED_NOW=1
fi

# ── 5. 롤링 배포: 앱 두 개를 하나씩 새 이미지로 바꾼다 ──
# 서버 관리자 nginx가 사이트 주소를 upstream(앱 두 개)으로 번갈아(라운드로빈) 보낸다. 앱 하나를 멈추면
# nginx가 그쪽 접속 실패를 보고 다른 쪽으로 다시 보내서(proxy_next_upstream) 손님은 끊기지 않는다.
# 그 nginx는 우리가 다시 읽게(reload) 할 수 없어서, 우리 쪽은 앱을 멈추고 켜는 것만으로 롤링한다.
# 옛 버전과 새 버전이 함께 손님을 받는 시간을 줄이려고, 2번을 새 버전으로 바꾸고 정상이면 곧바로 1번을 멈춘다.

# 컨테이너 네트워크: DB에 닿는 쪽(서버 네트워크 또는 기본 네트워크 + 서버 안에서만 여는 포트).
# 늘 0.0.0.0에서 듣는다. 앱을 127.0.0.1로 듣게 하면 Next.js가 블로그 주소(/@아이디) 바꿔 보여주기를
# 바깥 주소로 착각해 https로 자기 자신에게 다시 요청하다 실패해서 500이 났다 (2026-10-14 핫픽스).
slot_net() {
  if [ "${NET[0]}" = "--network" ]; then
    echo "--network host"
  else
    echo "-p 127.0.0.1:$1:$1"
  fi
}

start_app() { # 이름 포트 이미지
  # shellcheck disable=SC2046
  "${DOCKER[@]}" run -d --name "$1" --restart unless-stopped --stop-timeout 30 \
    --env-file "$BASE/app.env" -e PORT="$2" $(slot_net "$2") \
    -v "$BASE/uploads:/data/uploads" \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$3" >/dev/null
}

# 상태 확인: 화면(/api/health)과 서버(/api/v1/health)가 둘 다 열려야 정상
healthy() { # 이름 포트
  for _ in $(seq 1 45); do
    if "${DOCKER[@]}" exec "$1" node -e "
      const u = 'http://127.0.0.1:$2';
      Promise.all([fetch(u + '/api/health'), fetch(u + '/api/v1/health')])
        .then((rs) => process.exit(rs.every((r) => r.ok) ? 0 : 1)).catch(() => process.exit(1));
    " >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

image_of() { "${DOCKER[@]}" inspect --format '{{.Config.Image}}' "$1" 2>/dev/null || true; }
port_of() { "${DOCKER[@]}" inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$1" 2>/dev/null | sed -n 's/^PORT=//p'; }
exists() { "${DOCKER[@]}" inspect "$1" >/dev/null 2>&1; }
show_logs() { echo "--- $1 최근 로그 ---"; "${DOCKER[@]}" logs --tail 80 "$1" 2>&1 || true; }
stop_rm() { # 이름… : 처리 중인 요청을 마칠 시간을 주고(SIGTERM, 최대 30초) 지운다
  local n
  for n in "$@"; do
    exists "$n" || continue
    "${DOCKER[@]}" stop -t 30 "$n" >/dev/null 2>&1 || true
    "${DOCKER[@]}" rm -f "$n" >/dev/null 2>&1 || true
  done
}

replace_app() { # 번호(0/1) 이미지 → 성공하면 0
  stop_rm "${APP_NAME[$1]}"
  start_app "${APP_NAME[$1]}" "${APP_PORT[$1]}" "$2"
  healthy "${APP_NAME[$1]}" "${APP_PORT[$1]}"
}

# ── 서버 nginx 설정(~/nginx/<사이트 주소>.conf)에 upstream 넣기: 없을 때 한 번만 ──
SITE_HOST="$(sed -n 's/^BETTER_AUTH_URL=//p' "$BASE/app.env" | sed -E 's#^[a-z]+://##; s#[:/].*$##')"
SITE_CONF="${SITE_NGINX_CONF:-$HOME/nginx/$SITE_HOST.conf}"
UPSTREAM_NAME="blogcabin_java21_app" # 모든 학생 설정이 한 nginx에 들어가니 이름이 겹치지 않게 길게
setup_site_nginx() {
  if [ ! -f "$SITE_CONF" ]; then
    echo "서버 nginx 설정 파일($SITE_CONF)이 없어서 건너뛰어요. 사이트 주소는 ${APP_PORT[0]} 하나로만 들어와요."
    return 0
  fi
  if grep -q "upstream $UPSTREAM_NAME" "$SITE_CONF"; then
    echo "서버 nginx 설정에 이미 앱 두 개(upstream)가 있어요: $SITE_CONF"
    return 0
  fi
  if ! grep -Eq "proxy_pass[[:space:]]+http://127\.0\.0\.1:${APP_PORT[0]};" "$SITE_CONF"; then
    echo "서버 nginx 설정이 예상한 모양(proxy_pass http://127.0.0.1:${APP_PORT[0]};)이 아니라 고치지 않아요: $SITE_CONF"
    return 0
  fi
  local work new
  work="$(mktemp -d)"; new="$work/site.conf"
  {
    echo "# BlogCabin 앱 두 개 (deploy/deploy.sh가 $(date +%F) 한 번 넣음). 번갈아 보내고, 하나가 멈추면 다른 쪽으로 보낸다"
    echo "upstream $UPSTREAM_NAME {"
    echo "    server 127.0.0.1:${APP_PORT[0]} max_fails=1 fail_timeout=5s;"
    echo "    server 127.0.0.1:${APP_PORT[1]} max_fails=1 fail_timeout=5s;"
    echo "}"
    echo
    # proxy_pass만 upstream으로 바꾸고, 접속 실패·502·503이면 다른 앱으로 다시 보내는 줄을 더한다.
    # 첨부(30MB)가 들어오도록 본문 크기를 40M로 늘린다. Certbot 줄을 포함한 나머지는 그대로 둔다
    sed -E \
      -e "s#^([[:space:]]*)proxy_pass[[:space:]]+http://127\.0\.0\.1:${APP_PORT[0]};#\1proxy_pass http://$UPSTREAM_NAME;\n\1proxy_next_upstream error timeout http_502 http_503;#" \
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
  echo "서버 nginx 설정에 앱 두 개(${APP_PORT[*]})를 넣었어요: $SITE_CONF (원래 파일은 $BASE/nginx-backup/)"
  echo "선생님(관리자)이 nginx를 다시 읽어야(sudo nginx -t && sudo systemctl reload nginx) 적용돼요."
}

PREV_APP="$(image_of "${APP_NAME[1]}")"; [ -n "$PREV_APP" ] || PREV_APP="$(image_of "${APP_NAME[0]}")"

if exists "$OLD_PROXY"; then
  # ── 예전 구성에서 처음 바꾸기 ──
  # 예전: 우리 nginx(8440) → 화면 blogcabin-1(8441)·blogcabin-2(8442), 서버 blogcabin-api-1/2(8443·8444)
  # 지금: 앱 blogcabin-1(8440)·blogcabin-2(8441). 서버 nginx는 아직 8440만 알아서 8440이 바뀌는 순간 몇 초 끊긴다
  log "예전 구성(우리 nginx + 화면 두 개 + 서버 두 개)을 앱 두 개(${APP_PORT[*]})로 바꿔요"
  for n in "${APP_NAME[@]}"; do
    if exists "$n"; then "${DOCKER[@]}" rename "$n" "$n-old" >/dev/null; fi
  done
  # 8441을 쓰던 예전 화면을 내리면 우리 nginx가 다른 화면(8442)으로 보낸다
  for n in "${APP_NAME[@]/%/-old}"; do
    if [ "$(port_of "$n")" = "${APP_PORT[1]}" ]; then stop_rm "$n"; fi
  done
  log "새 앱 ${APP_NAME[1]} (:${APP_PORT[1]}) 켜기"
  if ! replace_app 1 "$WEB_IMAGE"; then
    show_logs "${APP_NAME[1]}"
    stop_rm "${APP_NAME[1]}"
    fail "새 앱이 정상으로 뜨지 않았어요. 사이트는 예전 구성 그대로예요(화면 하나 줄어든 상태, 다음 배포에서 다시 맞춰요). 위 로그를 확인해 주세요."
  fi
  log "8440을 우리 nginx에서 새 앱 ${APP_NAME[0]} 로 넘겨요 (이 순간 몇 초 끊길 수 있어요)"
  stop_rm "$OLD_PROXY"
  if ! { start_app "${APP_NAME[0]}" "${APP_PORT[0]}" "$WEB_IMAGE" && healthy "${APP_NAME[0]}" "${APP_PORT[0]}"; }; then
    show_logs "${APP_NAME[0]}"
    fail "${APP_NAME[0]} (:${APP_PORT[0]})가 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
  fi
  stop_rm "${APP_NAME[@]/%/-old}" "${OLD_API[@]}"
  rm -rf "$BASE/nginx"
elif [ -z "$PREV_APP" ]; then
  # ── 처음 켜기 ──
  log "처음 준비: 앱 두 개(${APP_PORT[*]})를 새 이미지로 켜요"
  stop_rm "blogcabin" # 아주 예전 방식(앱 하나)의 컨테이너
  for i in 1 0; do
    if ! replace_app "$i" "$WEB_IMAGE"; then
      show_logs "${APP_NAME[$i]}"
      fail "${APP_NAME[$i]} (:${APP_PORT[$i]})가 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
    fi
  done
else
  # ── 롤링: 2번(${APP_PORT[1]}) → 1번(${APP_PORT[0]}) ──
  # 서버 nginx가 아직 8440만 알면(다시 읽기 전) 2번은 손님이 없어 먼저 바꾸고, 1번을 바꾸는 몇 초만 끊긴다
  log "롤링 1/2 ${APP_NAME[1]} (:${APP_PORT[1]}) 를 새 버전으로 바꿔요 (손님은 ${APP_NAME[0]} 가 받아요)"
  if ! replace_app 1 "$WEB_IMAGE"; then
    show_logs "${APP_NAME[1]}"
    log "새 버전이 정상이 아니라 ${APP_NAME[1]} 를 이전 이미지로 되돌려요: $PREV_APP"
    replace_app 1 "$PREV_APP" || true
    fail "새 버전이 정상으로 뜨지 않았어요. 사이트는 이전 버전으로 계속 돌아요. 위 로그를 확인해 주세요."
  fi
  # 서버 nginx는 멈춰 있던 2번을 5초(fail_timeout) 동안 "죽음"으로 기억한다. 그 사이 1번까지 멈추면 갈 곳이 없어
  # 502가 나니, 2번을 다시 쓰기 시작할 때까지 기다린다 (2026-10-14 시험에서 확인)
  sleep 8
  log "롤링 2/2 ${APP_NAME[0]} (:${APP_PORT[0]}) 를 새 버전으로 바꿔요 (손님은 새 버전 ${APP_NAME[1]} 가 받아요)"
  if ! replace_app 0 "$WEB_IMAGE"; then
    show_logs "${APP_NAME[0]}"
    log "${APP_NAME[0]} 를 이전 이미지로 되돌려요 (${APP_NAME[1]} 은 새 버전): $PREV_APP"
    replace_app 0 "$PREV_APP" || true
    fail "${APP_NAME[0]} 가 새 버전으로 뜨지 않았어요. 위 로그를 확인해 주세요."
  fi
fi
log "서버 nginx 설정 확인"
setup_site_nginx
log "배포 완료: 앱 :${APP_PORT[0]}, :${APP_PORT[1]} ($WEB_IMAGE)"

# ── 6. 정리: 지금 것과 직전 것만 남기고 예전 이미지는 지운다 (폴더를 나누기 전 이름 blogcabin:… 도) ──
PREV_API="${PREV_APP/blogcabin-web:/blogcabin-api:}"
rm -f "$IMAGE_TAR"
"${DOCKER[@]}" images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E '^blogcabin(-web|-api)?:' \
  | grep -v -x -e "$WEB_IMAGE" -e "$API_IMAGE" -e "${PREV_APP:-__none__}" -e "${PREV_API:-__none__}" \
  | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true

if [ "$ADMIN_CREATED_NOW" = "1" ]; then
  echo
  echo "관리자 계정을 만들었어요. 비밀번호는 서버에서 아래 명령으로 볼 수 있어요:"
  echo "  grep ADMIN_PASSWORD $BASE/secrets.env"
fi
