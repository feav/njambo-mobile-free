#!/bin/sh
set -u

STATE_DIR=/var/lib/njambo-backend-monitor
STATE_FILE="$STATE_DIR/state"
mkdir -p "$STATE_DIR"

now=$(date -u "+%Y-%m-%dT%H:%M:%SZ")
status=down
reason="unknown"

if docker inspect --format '{{.State.Status}}' njambo-backend 2>/dev/null | grep -qx running; then
  body=$(curl -sS --connect-timeout 3 --max-time 15 http://127.0.0.1:3001/actuator/health 2>/dev/null || true)
  code=$(curl -sS -o /dev/null --connect-timeout 3 --max-time 15 -w "%{http_code}" http://127.0.0.1:3001/actuator/health 2>/dev/null || true)
  if [ "$code" = "200" ] && printf "%s" "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"UP"'; then
    status=up
    reason="HTTP 200 /actuator/health, status UP"
  else
    reason="HTTP ${code:-000} /actuator/health, response unavailable or not UP"
  fi
else
  reason="Docker container njambo-backend is not running"
fi

previous=$(cat "$STATE_FILE" 2>/dev/null || true)
if [ "$status" != "$previous" ]; then
  if [ "$status" = "down" ]; then
    subject="[Njambo] Backend DOWN"
    message="Le backend de production est indisponible.\n\nHeure UTC : $now\nRaison : $reason\nServeur : api.njambo.fr\n"
  elif [ "$previous" = "down" ]; then
    subject="[Njambo] Backend RECOVERED"
    message="Le backend de production est de nouveau opérationnel.\n\nHeure UTC : $now\nContrôle : $reason\nServeur : api.njambo.fr\n"
  else
    message=""
  fi
  if [ -n "$message" ]; then
    {
      printf "To: feavfeav@gmail.com\n"
      printf "From: root@api.njambo.fr\n"
      printf "Subject: %s\n" "$subject"
      printf "Content-Type: text/plain; charset=UTF-8\n\n"
      printf "%b" "$message"
    } | /usr/sbin/sendmail -t
  fi
fi

printf "%s status=%s previous=%s reason=%s\n" "$now" "$status" "${previous:-none}" "$reason" >> /var/log/njambo-backend-monitor.log
printf "%s" "$status" > "$STATE_FILE"
