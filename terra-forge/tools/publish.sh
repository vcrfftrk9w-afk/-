#!/bin/sh
# Builds the place and publishes it to Roblox through Open Cloud.
# The API key (universe-places: write) is not stored here: the cloud environment's
# network secret adds the x-api-key header to requests to apis.roblox.com.
# Without that secret, pass the key yourself: ROBLOX_API_KEY=... tools/publish.sh
set -e
cd "$(dirname "$0")/.."

UNIVERSE_ID=10773769947
PLACE_ID=97574477911316

python3 tools/check_luau.py
python3 tools/build_place.py

if [ -n "$ROBLOX_API_KEY" ]; then
	set -- -H "x-api-key: $ROBLOX_API_KEY"
fi
curl -sS -m 180 -X POST \
	"https://apis.roblox.com/universes/v1/$UNIVERSE_ID/places/$PLACE_ID/versions?versionType=Published" \
	-H "Content-Type: application/xml" "$@" \
	--data-binary @build/TerraForge.rbxlx \
	-w "\nHTTP %{http_code}\n"
