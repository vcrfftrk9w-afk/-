#!/bin/sh
# Все тесты режима без Roblox Studio. Нужен luau CLI: https://github.com/luau-lang/luau/releases
set -e
cd "$(dirname "$0")/.."
LUAU=${LUAU:-luau}
python3 tests/make_bundle.py
$LUAU tests/sim_test.luau
$LUAU tests/server_smoke.luau
$LUAU tests/client_smoke.luau
