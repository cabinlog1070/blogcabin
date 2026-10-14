#!/bin/sh
# 컨테이너 시작: 운영 서버를 PORT(기본 8440)에서 연다. BIND_HOST(기본 0.0.0.0)는 듣는 주소
# (롤링 배포의 앱 두 개는 서버 네트워크를 쓸 때 127.0.0.1에서만 들어서 nginx를 거쳐야만 들어온다)
set -e
exec node_modules/.bin/next start -H "${BIND_HOST:-0.0.0.0}" -p "${PORT:-8440}"
