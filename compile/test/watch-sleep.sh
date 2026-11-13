#!/bin/sh
# Polls GET /health (which never starts a container) until every compile
# container is asleep, printing a timestamped line each time.
#   sh test/watch-sleep.sh [ip-to-pin] [max-minutes]
IP="${1:-}"
MAX="${2:-8}"
RESOLVE=""
[ -n "$IP" ] && RESOLVE="--resolve compile.esp32bench.dev:443:$IP"
END=$(( $(date +%s) + MAX * 60 ))
while [ "$(date +%s)" -lt "$END" ]; do
  BODY=$(curl -s $RESOLVE https://compile.esp32bench.dev/health)
  echo "$(date -u +%H:%M:%S) $(printf '%s' "$BODY" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(" ".join(i["name"] + "=" + i["state"] for i in d["instances"]))')"
  case "$BODY" in
    *'"ready"'*|*'"starting"'*) sleep 30 ;;
    *) echo "all asleep"; exit 0 ;;
  esac
done
echo "still awake after $MAX minutes"
exit 1
