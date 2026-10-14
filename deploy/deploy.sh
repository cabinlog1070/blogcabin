#!/usr/bin/env bash
# BlogCabin 서버 배포 스크립트. GitHub Actions(.github/workflows/deploy.yml)가 SSH로 서버에서 실행한다.
#
#   bash deploy.sh <태그> <image.tar.gz> <deploy.env> [nginx 포트, 기본 8440] [화면 포트 두 개, 기본 "8441 8442"] [서버 포트 두 개, 기본 "8443 8444"]
#
# 이미지는 두 종류다 (저장소의 frontend/·backend/ 폴더)
#   blogcabin-web:<태그>  화면(Next.js). 아직 옮기지 않은 영역은 DB도 직접 쓴다. 시드·관리자 계정도 이 이미지로 돌린다
#   blogcabin-api:<태그>  서버(backend). /api/v1/… 주소를 맡는다. DB 구조(마이그레이션)는 이 이미지가 맞춘다
#
# 하는 일
#   1. 이미지 파일(두 이미지가 같이 묶여 있다)을 docker에 불러온다
#   2. 처음 배포면 로그인 비밀키·관리자 비밀번호를 만들어 ~/blogcabin/secrets.env 에 보관한다 (다음 배포부터 재사용)
#   3. DB 구조를 맞추고(db:migrate) 아이템·동물 목록을 넣는다(db:seed, 여러 번 해도 안전)
#   4. 처음 배포면 관리자 계정을 만든다(admin:create)
#   5. 롤링 배포: nginx(8440)가 /api/v1/ 은 서버 두 개(8443, 8444)로, 나머지는 화면 두 개(8441, 8442)로 번갈아 보낸다.
#      서버를 먼저, 그다음 화면을 하나씩 새 이미지로 바꾸고 상태 확인 주소를 본다. 바꾸는 동안 사이트는 꺼지지 않는다
#      (새 화면이 부를 API가 먼저 있어야 해서 서버가 먼저다)
#   6. 실패하면 그 컨테이너를 직전 이미지로 되돌린다
#
# 서버 폴더 (~/blogcabin)
#   secrets.env  로그인 비밀키·관리자 비밀번호 (지우면 모든 회원이 로그아웃됨)
#   app.env      컨테이너에 넘기는 환경 변수 (매 배포마다 다시 만듦)
#   uploads/     글 첨부 사진·파일 (컨테이너의 /data/uploads, 모든 컨테이너가 같이 쓴다)
#   nginx/       앞단 nginx 설정 (배포마다 다시 만든다)
#   releases/    전송받은 이미지와 이 스크립트
set -euo pipefail

TAG="${1:?이미지 태그가 필요해요}"
IMAGE_TAR="${2:?이미지 파일 경로가 필요해요}"
DEPLOY_ENV="${3:?deploy.env 경로가 필요해요}"
PUBLIC_PORT="${4:-8440}"
read -r -a WEB_PORT <<< "${5:-8441 8442}"
read -r -a API_PORT <<< "${6:-8443 8444}"
[ "${#WEB_PORT[@]}" -eq 2 ] || { echo "화면 포트는 두 개여야 해요: ${5:-}" >&2; exit 1; }
[ "${#API_PORT[@]}" -eq 2 ] || { echo "서버 포트는 두 개여야 해요: ${6:-}" >&2; exit 1; }
WEB_IMAGE="blogcabin-web:$TAG"
API_IMAGE="blogcabin-api:$TAG"
LEGACY_NAME="blogcabin"                          # 예전 방식(앱 하나)의 컨테이너 이름
WEB_NAME=("blogcabin-1" "blogcabin-2")           # 화면 두 개 (이름은 폴더를 나누기 전과 같다)
API_NAME=("blogcabin-api-1" "blogcabin-api-2")   # 서버 두 개
PROXY="blogcabin-nginx"
NGINX_IMAGE="nginx:1.27-alpine"
BASE="${BLOGCABIN_HOME:-$HOME/blogcabin}"
NGINX_DIR="$BASE/nginx"
NGINX_IN="/etc/nginx/blogcabin"

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
"${DOCKER[@]}" image inspect "$NGINX_IMAGE" >/dev/null 2>&1 || "${DOCKER[@]}" pull -q "$NGINX_IMAGE" >/dev/null \
  || fail "nginx 이미지($NGINX_IMAGE)를 받지 못했어요. 서버 인터넷 연결을 확인해 주세요."

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
      NET=(-p "$PUBLIC_PORT:$PUBLIC_PORT"); echo "컨테이너 기본 네트워크로 DB에 닿아요"
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

# ── 5. 롤링 배포: 서버 두 개, 화면 두 개를 하나씩 새 이미지로 바꾼다 ──
# 손님은 nginx(PUBLIC_PORT)가 받아 /api/v1/ 은 서버 두 개로, 나머지는 화면 두 개로 번갈아(라운드로빈) 보낸다.
# 한쪽을 바꾸는 동안에는 nginx가 다른 쪽으로만 보내서 사이트가 꺼지지 않는다.
# 옛 버전과 새 버전이 동시에 손님을 받지 않게, 새 버전 쪽을 켠 뒤 한 번에 넘기고 나머지를 바꾼다.

# 컨테이너 네트워크: DB에 닿는 쪽(서버 네트워크 또는 기본 네트워크 + 서버 안에서만 여는 포트).
# 늘 0.0.0.0에서 듣는다. 화면을 127.0.0.1로 듣게 하면 Next.js가 블로그 주소(/@아이디) 바꿔 보여주기를
# 바깥 주소로 착각해 https로 자기 자신에게 다시 요청하다 실패해서 500이 났다 (2026-10-14 핫픽스).
slot_net() {
  if [ "${NET[0]}" = "--network" ]; then
    echo "--network host"
  else
    echo "-p 127.0.0.1:$1:$1"
  fi
}

# 상태 확인 주소: 화면은 /api/health, 서버는 /api/v1/health
health_path() { if [ "$1" = api ]; then echo /api/v1/health; else echo /api/health; fi; }

# 종류(web/api)별 컨테이너 이름·포트·지금 상태(up/down)
declare -A STATE=([web0]=up [web1]=up [api0]=up [api1]=up)
slot_name() { if [ "$1" = api ]; then echo "${API_NAME[$2]}"; else echo "${WEB_NAME[$2]}"; fi; }
slot_port() { if [ "$1" = api ]; then echo "${API_PORT[$2]}"; else echo "${WEB_PORT[$2]}"; fi; }

start_slot() { # 이름 포트 이미지
  # shellcheck disable=SC2046
  "${DOCKER[@]}" run -d --name "$1" --restart unless-stopped \
    --env-file "$BASE/app.env" -e PORT="$2" $(slot_net "$2") \
    -v "$BASE/uploads:/data/uploads" \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$3" >/dev/null
}

healthy() { # 이름 포트 주소
  for _ in $(seq 1 45); do
    if "${DOCKER[@]}" exec "$1" node -e \
      "fetch('http://127.0.0.1:$2$3').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
      >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

image_of() { "${DOCKER[@]}" inspect --format '{{.Config.Image}}' "$1" 2>/dev/null || true; }
running() { [ "$("${DOCKER[@]}" inspect --format '{{.State.Running}}' "$1" 2>/dev/null)" = "true" ]; }

# nginx 설정: 쉬는 컨테이너에는 down을 붙여 손님을 보내지 않는다
write_upstream() {
  local kind i line # local이 없으면 부른 함수(roll)의 kind를 덮어쓴다 (bash는 변수를 부른 쪽과 나눠 쓴다)
  {
    for kind in web api; do
      echo "upstream blogcabin_$kind {"
      for i in 0 1; do
        line="  server 127.0.0.1:$(slot_port "$kind" "$i") max_fails=1 fail_timeout=5s"
        [ "${STATE[$kind$i]}" = "down" ] && line="$line down"
        echo "$line;"
      done
      echo "  keepalive 16;"
      echo "}"
    done
  } > "$NGINX_DIR/upstream.conf.new"
  mv "$NGINX_DIR/upstream.conf.new" "$NGINX_DIR/upstream.conf"
}

write_nginx_conf() {
  cat > "$NGINX_DIR/nginx.conf" <<NGINX
# BlogCabin 앞단 nginx (deploy/deploy.sh가 배포마다 다시 만든다. 직접 고치지 않는다)
# 서버 관리자 nginx(https) → 이 nginx(:$PUBLIC_PORT)
#   /api/v1/ → 서버(backend) 두 개 (:${API_PORT[0]}, :${API_PORT[1]}) 라운드로빈
#   나머지   → 화면(frontend) 두 개 (:${WEB_PORT[0]}, :${WEB_PORT[1]}) 라운드로빈
worker_processes 2;
pid /tmp/nginx.pid;
error_log /dev/stderr warn;
events { worker_connections 1024; }
http {
  access_log off;
  client_max_body_size 40m;
  # 앞의 관리자 nginx가 알려 준 원래 주소·https 여부를 앱까지 그대로 넘긴다
  map \$http_x_forwarded_proto \$fwd_proto { default \$http_x_forwarded_proto; "" \$scheme; }
  map \$http_x_real_ip \$real_ip { default \$http_x_real_ip; "" \$remote_addr; }
  include $NGINX_IN/upstream.conf;
  proxy_http_version 1.1;
  proxy_set_header Connection "";
  proxy_set_header Host \$http_host;
  proxy_set_header X-Forwarded-Proto \$fwd_proto;
  proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
  proxy_set_header X-Real-IP \$real_ip;
  proxy_read_timeout 120s;
  # 한쪽이 응답하지 않으면 다른 쪽으로 다시 보낸다 (이중화)
  proxy_next_upstream error timeout http_502 http_503;
  server {
    listen $PUBLIC_PORT;
    location = /nginx-health { access_log off; return 200 "ok\n"; }
    location /api/v1/ { proxy_pass http://blogcabin_api; }
    location / { proxy_pass http://blogcabin_web; }
  }
}
NGINX
}

reload_proxy() {
  write_upstream
  "${DOCKER[@]}" exec "$PROXY" nginx -t -q -c "$NGINX_IN/nginx.conf" && "${DOCKER[@]}" exec "$PROXY" nginx -s reload -c "$NGINX_IN/nginx.conf"
  sleep 1 # 옛 설정으로 처리 중이던 요청이 끝날 시간
}

start_proxy() {
  "${DOCKER[@]}" run -d --name "$PROXY" --restart unless-stopped --network host \
    -v "$NGINX_DIR:$NGINX_IN:ro" \
    --log-opt max-size=10m --log-opt max-file=3 \
    "$NGINX_IMAGE" nginx -c "$NGINX_IN/nginx.conf" -g 'daemon off;' >/dev/null
}

proxy_healthy() { # nginx를 거쳐 화면·서버 상태 확인 주소가 둘 다 열리는지
  for _ in $(seq 1 15); do
    if "${DOCKER[@]}" exec "$PROXY" wget -q -O /dev/null "http://127.0.0.1:$PUBLIC_PORT/api/health" 2>/dev/null &&
       "${DOCKER[@]}" exec "$PROXY" wget -q -O /dev/null "http://127.0.0.1:$PUBLIC_PORT/api/v1/health" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  return 1
}

show_logs() { echo "--- $1 최근 로그 ---"; "${DOCKER[@]}" logs --tail 80 "$1" 2>&1 || true; }

replace_slot() { # 종류 번호(0/1) 이미지 → 성공하면 0
  local name port
  name="$(slot_name "$1" "$2")"; port="$(slot_port "$1" "$2")"
  "${DOCKER[@]}" rm -f "$name" >/dev/null 2>&1 || true
  start_slot "$name" "$port" "$3"
  healthy "$name" "$port" "$(health_path "$1")"
}

prev_image() { # 종류 → 지금 돌고 있는 이미지 (없으면 빈 값)
  local img
  img="$(image_of "$(slot_name "$1" 1)")"
  [ -n "$img" ] || img="$(image_of "$(slot_name "$1" 0)")"
  echo "$img"
}

# 처음 켜기: 두 개를 새 이미지로 켜고 상태를 확인한다 (아직 손님을 받지 않던 종류)
start_both() { # 종류 이미지
  local i
  for i in 0 1; do
    if ! replace_slot "$1" "$i" "$2"; then
      show_logs "$(slot_name "$1" "$i")"
      "${DOCKER[@]}" rm -f "$(slot_name "$1" 0)" "$(slot_name "$1" 1)" >/dev/null 2>&1 || true
      return 1
    fi
  done
}

# 롤링: 1번을 빼고 바꾼 뒤 1번으로 넘기고, 2번을 바꾼 뒤 둘 다 받는다
roll() { # 종류 새이미지 옛이미지 이름표
  local kind="$1" new="$2" prev="$3" label="$4"
  local n0 n1
  n0="$(slot_name "$kind" 0)"; n1="$(slot_name "$kind" 1)"
  log "$label 1/3 $n0 를 쉬게 하고 새 버전으로 바꿔요 (손님은 $n1 가 받아요)"
  STATE[${kind}0]=down; STATE[${kind}1]=up; reload_proxy
  if ! replace_slot "$kind" 0 "$new"; then
    show_logs "$n0"
    log "새 버전이 정상이 아니라 $n0 를 이전 이미지로 되돌려요: $prev"
    replace_slot "$kind" 0 "$prev" || true
    STATE[${kind}0]=up; reload_proxy
    return 1
  fi
  log "$label 2/3 손님을 새 버전($n0)으로 넘기고 $n1 를 바꿔요"
  STATE[${kind}0]=up; STATE[${kind}1]=down; reload_proxy
  if ! replace_slot "$kind" 1 "$new"; then
    show_logs "$n1"
    "${DOCKER[@]}" rm -f "$n1" >/dev/null 2>&1 || true
    fail "$n1 가 새 버전으로 뜨지 않았어요. $label 는 $n0(새 버전) 하나로 돌고 있어요. 위 로그를 확인해 주세요."
  fi
  log "$label 3/3 두 개가 다시 같이 손님을 받아요"
  STATE[${kind}1]=up; reload_proxy
}

PREV_WEB="$(prev_image web)"
PREV_API="$(prev_image api)"
# 서버가 아직 없으면(폴더를 나눈 뒤 첫 배포) 켜기 전까지 nginx가 서버 쪽으로 보내지 않게 한다
if [ -z "$PREV_API" ]; then STATE[api0]=down; STATE[api1]=down; fi
mkdir -p "$NGINX_DIR"
write_nginx_conf
write_upstream

if [ -z "$PREV_WEB" ] || ! running "$PROXY"; then
  # ── nginx가 없을 때(새 서버 등): 네 개를 모두 새 이미지로 켜고 nginx를 켠다 ──
  log "처음 준비: 서버 두 개(${API_PORT[*]})와 화면 두 개(${WEB_PORT[*]})를 새 이미지로 켜요"
  start_both api "$API_IMAGE" || fail "서버(backend)가 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
  start_both web "$WEB_IMAGE" || fail "화면(frontend)이 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
  STATE[api0]=up; STATE[api1]=up
  write_upstream
  log "포트 $PUBLIC_PORT 를 nginx에게 맡겨요"
  "${DOCKER[@]}" rm -f "$LEGACY_NAME" "$PROXY" >/dev/null 2>&1 || true
  start_proxy
  if ! proxy_healthy; then
    show_logs "$PROXY"
    fail "nginx가 정상으로 뜨지 않았어요. 위 로그를 확인해 주세요."
  fi
else
  # ── 서버 먼저 (새 화면이 부를 API가 먼저 있어야 한다) ──
  if [ -z "$PREV_API" ]; then
    # 폴더를 나눈 뒤 첫 배포: 서버는 아직 없어서 손님 없이 켜고 nginx에 붙인다
    log "서버(backend) 두 개를 처음 켜요 (${API_PORT[*]})"
    start_both api "$API_IMAGE" || fail "서버(backend)가 정상으로 뜨지 않았어요. 사이트는 이전 그대로예요. 위 로그를 확인해 주세요."
    STATE[api0]=up; STATE[api1]=up
    reload_proxy
  else
    roll api "$API_IMAGE" "$PREV_API" "서버" \
      || fail "서버(backend) 새 버전이 정상으로 뜨지 않았어요. 사이트는 이전 버전으로 계속 돌아요. 위 로그를 확인해 주세요."
  fi
  # ── 그다음 화면 ──
  roll web "$WEB_IMAGE" "$PREV_WEB" "화면" \
    || fail "화면(frontend) 새 버전이 정상으로 뜨지 않았어요. 화면은 이전 버전으로 계속 돌아요(서버는 새 버전). 위 로그를 확인해 주세요."
  if ! proxy_healthy; then
    show_logs "$PROXY"
    fail "nginx를 거친 상태 확인이 실패했어요. 위 로그를 확인해 주세요."
  fi
fi
log "배포 완료: nginx :$PUBLIC_PORT → 화면 :${WEB_PORT[0]}, :${WEB_PORT[1]} ($WEB_IMAGE) / 서버 :${API_PORT[0]}, :${API_PORT[1]} ($API_IMAGE)"

# ── 6. 정리: 지금 것과 직전 것만 남기고 예전 이미지는 지운다 (폴더를 나누기 전 이름 blogcabin:… 도) ──
rm -f "$IMAGE_TAR"
"${DOCKER[@]}" images --format '{{.Repository}}:{{.Tag}}' \
  | grep -E '^blogcabin(-web|-api)?:' \
  | grep -v -x -e "$WEB_IMAGE" -e "$API_IMAGE" -e "${PREV_WEB:-__none__}" -e "${PREV_API:-__none__}" \
  | xargs -r "${DOCKER[@]}" rmi >/dev/null 2>&1 || true

if [ "$ADMIN_CREATED_NOW" = "1" ]; then
  echo
  echo "관리자 계정을 만들었어요. 비밀번호는 서버에서 아래 명령으로 볼 수 있어요:"
  echo "  grep ADMIN_PASSWORD $BASE/secrets.env"
fi
