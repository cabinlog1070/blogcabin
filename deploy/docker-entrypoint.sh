#!/bin/sh
# 컨테이너 시작: 운영 서버를 PORT(기본 8440)에서 연다
set -e
exec node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-8440}"
