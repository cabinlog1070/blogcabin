#!/bin/sh
# 컨테이너 시작: 운영 서버를 PORT(기본 8440)에서 연다.
# -H는 0.0.0.0으로 둔다. 127.0.0.1이면 src/proxy.ts의 /@아이디 rewrite를 Next.js가 바깥 주소로 보고
# https로 자기에게 다시 요청하다 실패해 블로그 화면이 500이 된다.
set -e
exec ../node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-8440}"
