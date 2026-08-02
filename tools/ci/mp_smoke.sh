#!/usr/bin/env bash
# tools/ci/mp_smoke.sh — GOOBY-SERVER MP-Smoke: Server-Start + 2-Client-Handshake.
#
# Was der Smoke belegt (in dieser Reihenfolge, jede Zeile im Log ist ein Beleg):
#   1. GOOBY-SERVER startet als ECHTER eigener Prozess (node server.js) auf einem
#      freien Port mit Temp-DATA_DIR — kein In-Process-Testserver.
#   2. /health antwortet {"ok":true,...} (derselbe Check wie AMP-Monitoring).
#   3. ZWEI WebSocket-Clients (Anna + Ben) verbinden auf ws://…/ws und fahren den
#      HELLO→WELCOME-Handshake (TOFU-Auth): eigener friendCode (GOOBY-XXXX,
#      Anna ≠ Ben), heartbeatSec + features angesagt.
#   4. PING→PONG auf beiden Verbindungen (Envelope-Korrelation über re/seq).
#   5. Die beiden Clients sehen EINANDER: Freundschafts-Handshake
#      FRIEND_REQUEST → FRIEND_REQUEST_INCOMING → FRIEND_ACCEPT → FRIEND_ADDED
#      (beidseitig), danach PRESENCE_SET von Anna → FRIEND_PRESENCE-Push bei Ben.
#   6. Sauberer Shutdown: SIGTERM an den Server → beide Clients bekommen
#      GOING_DOWN {reason:SHUTDOWN} + Close 1001, Prozess endet mit Exit 0.
#
# Der Smoke nutzt bewusst NUR Nachrichten, die schon von den Unit-Tests
# (GOOBY-SERVER/test/hello.test.js, friends.test.js) gedeckt sind — er prüft
# nicht die Logik erneut, sondern dass der echte Prozess-Pfad (Boot, Port,
# HTTP+WS auf EINEM Listener, Signal-Handling) zusammenhält. Den großen
# Feature-Smoke (Ranch-MP inkl. Rejoin) gibt es separat:
# GOOBY-SERVER/tools/smoke-rmp.mjs.
#
# Aufruf:   bash tools/ci/mp_smoke.sh          (aus dem Repo-Root oder irgendwo)
# ENV:      MP_SMOKE_PORT   Port für den Server (Default 0 = OS wählt frei)
# Exit 0 = bestanden; jede andere Zahl = Beleg im Log darüber.
# CI: optionaler Job "mp-smoke" in .github/workflows/gooby-server.yml —
# läuft NUR bei manuellem workflow_dispatch, der Push-Pfad bleibt unverändert.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SERVER_DIR="$ROOT/GOOBY-SERVER"
cd "$SERVER_DIR"

echo "[mp-smoke] GOOBY-SERVER MP-Smoke (2-Client-Handshake) — $SERVER_DIR"

# Dependencies nur nachziehen, wenn sie fehlen (lokal liegen sie meist schon da;
# im CI übernimmt das npm ci gegen die eingecheckte package-lock.json).
if [ ! -d node_modules/ws ] || [ ! -d node_modules/express ]; then
	echo "[mp-smoke] node_modules unvollständig — npm ci"
	npm ci
fi

DATA_DIR="$(mktemp -d /tmp/gooby-mp-smoke-data.XXXXXX)"
SERVER_LOG="$(mktemp /tmp/gooby-mp-smoke-log.XXXXXX)"
SERVER_PID=""

cleanup() {
	if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
		kill -TERM "$SERVER_PID" 2>/dev/null || true
		wait "$SERVER_PID" 2>/dev/null || true
	fi
	rm -rf "$DATA_DIR" "$SERVER_LOG"
}
trap cleanup EXIT

# -- 1. Server als echter Prozess starten -----------------------------------
PORT="${MP_SMOKE_PORT:-0}" DATA_DIR="$DATA_DIR" node server.js >"$SERVER_LOG" 2>&1 &
SERVER_PID=$!
echo "[mp-smoke] Server gestartet (pid=$SERVER_PID, PORT=${MP_SMOKE_PORT:-0=frei}, DATA_DIR=$DATA_DIR)"

# Tatsächlichen Port aus der Boot-Zeile lesen ("läuft auf Port <n>") —
# bei PORT=0 vergibt ihn das OS, nur das Log kennt ihn.
PORT_ACTUAL=""
for _ in $(seq 1 100); do
	if ! kill -0 "$SERVER_PID" 2>/dev/null; then
		echo "[mp-smoke] FEHLGESCHLAGEN: Server-Prozess sofort beendet — Log:"
		cat "$SERVER_LOG"
		exit 1
	fi
	PORT_ACTUAL="$(sed -n 's/.*läuft auf Port \([0-9][0-9]*\).*/\1/p' "$SERVER_LOG" | head -n1)"
	if [ -n "$PORT_ACTUAL" ]; then break; fi
	sleep 0.1
done
if [ -z "$PORT_ACTUAL" ]; then
	echo "[mp-smoke] FEHLGESCHLAGEN: keine Boot-Zeile nach 10 s — Log:"
	cat "$SERVER_LOG"
	exit 1
fi
echo "[mp-smoke] Server läuft auf Port $PORT_ACTUAL"

# -- 2. /health (Node ≥ 18 hat fetch — kein curl nötig) ----------------------
HEALTH_OK=""
for _ in $(seq 1 50); do
	if node -e "fetch('http://127.0.0.1:$PORT_ACTUAL/health').then((r)=>r.json()).then((j)=>process.exit(j.ok?0:1)).catch(()=>process.exit(1))"; then
		HEALTH_OK=1
		break
	fi
	sleep 0.1
done
if [ -z "$HEALTH_OK" ]; then
	echo "[mp-smoke] FEHLGESCHLAGEN: /health antwortet nicht — Log:"
	cat "$SERVER_LOG"
	exit 1
fi
echo "[mp-smoke] /health ok"

# -- 3.–6. Zwei-Client-Handshake (nutzt test/helpers.js: WsClient/newIdentity) --
MP_SMOKE_WS_URL="ws://127.0.0.1:$PORT_ACTUAL/ws" \
	MP_SMOKE_SERVER_PID="$SERVER_PID" \
	node --input-type=module - <<'NODE'
import assert from 'node:assert/strict';
import { WsClient, newIdentity } from './test/helpers.js';

const wsUrl = process.env.MP_SMOKE_WS_URL;
const serverPid = Number(process.env.MP_SMOKE_SERVER_PID);
const log = (wer, text) => console.log(`[mp-smoke] [${wer}] ${text}`);

// 3. Beide Clients verbinden + HELLO→WELCOME (TOFU: neue Geräte, frische Secrets).
const a = await WsClient.connect(wsUrl);
const b = await WsClient.connect(wsUrl);
const idA = newIdentity('Anna', 'Flausch');
const idB = newIdentity('Ben', 'Knöpfchen');
const wA = await a.hello(idA);
const wB = await b.hello(idB);
for (const [wer, w] of [['A', wA], ['B', wB]]) {
  assert.equal(w.t, 'WELCOME', `${wer}: HELLO wird mit WELCOME beantwortet`);
  assert.match(w.d.friendCode, /^GOOBY-[A-HJ-NP-Z2-9]{4}$/, `${wer}: friendCode-Format`);
  assert.equal(typeof w.d.heartbeatSec, 'number', `${wer}: heartbeatSec angesagt`);
  assert.ok(Array.isArray(w.d.features) && w.d.features.length > 0, `${wer}: features angesagt`);
}
assert.notEqual(wA.d.friendCode, wB.d.friendCode, 'zwei Clients, zwei Identitäten');
log('A', `WELCOME als ${wA.d.friendCode} (heartbeat ${wA.d.heartbeatSec}s, features: ${wA.d.features.join(',')})`);
log('B', `WELCOME als ${wB.d.friendCode}`);

// 4. PING→PONG auf beiden Verbindungen (re/seq-Korrelation).
for (const [wer, c] of [['A', a], ['B', b]]) {
  const pong = await c.request('PING');
  assert.equal(pong.t, 'PONG', `${wer}: PONG`);
  assert.equal(typeof pong.d.serverTime, 'number', `${wer}: serverTime`);
  log(wer, `PING→PONG (serverTime=${pong.d.serverTime})`);
}

// 5. Die Clients sehen EINANDER: Freundschafts-Handshake + Presence-Push.
await a.request('FRIEND_REQUEST', { target: wB.d.friendCode });
await b.next('FRIEND_REQUEST_INCOMING');
log('B', 'FRIEND_REQUEST_INCOMING von Anna');
await b.request('FRIEND_ACCEPT', { target: wA.d.friendCode });
await a.next('FRIEND_ADDED');
await b.next('FRIEND_ADDED');
log('smoke', 'Anna und Ben sind befreundet (FRIEND_ADDED beidseitig)');
a.send('PRESENCE_SET', { kind: 'park' });
const presence = await b.next('FRIEND_PRESENCE');
assert.equal(presence.d.friendCode, wA.d.friendCode, 'Presence-Push kommt von Anna');
assert.equal(presence.d.online, true, 'Anna ist online');
assert.equal(presence.d.activity.kind, 'park', 'gesetzte Aktivität kommt an');
log('B', `sieht Annas Presence: online=${presence.d.online}, „${presence.d.activity.label}“`);

// 6. Sauberer Shutdown: SIGTERM → GOING_DOWN(SHUTDOWN) an beide + Close.
process.kill(serverPid, 'SIGTERM');
const downA = await a.next('GOING_DOWN', 5000);
const downB = await b.next('GOING_DOWN', 5000);
assert.equal(downA.d.reason, 'SHUTDOWN', 'A: GOING_DOWN reason');
assert.equal(downB.d.reason, 'SHUTDOWN', 'B: GOING_DOWN reason');
await a.waitClose();
await b.waitClose();
log('smoke', 'SIGTERM → GOING_DOWN(SHUTDOWN) an beide Clients, Sockets zu');
NODE

# Server muss nach dem SIGTERM aus dem Driver sauber (Exit 0) enden.
SERVER_EXIT=0
wait "$SERVER_PID" || SERVER_EXIT=$?
SERVER_PID=""
if [ "$SERVER_EXIT" -ne 0 ]; then
	echo "[mp-smoke] FEHLGESCHLAGEN: Server-Exit-Code $SERVER_EXIT — Log:"
	cat "$SERVER_LOG"
	exit 1
fi
echo "[mp-smoke] Server sauber beendet (Exit 0)"
echo "[mp-smoke] --- Server-Log ---"
sed 's/^/[mp-smoke] [server] /' "$SERVER_LOG"
echo "[mp-smoke] MP-SMOKE BESTANDEN: Boot + /health + 2x HELLO/WELCOME + PING/PONG + Freundschaft + Presence + SIGTERM/GOING_DOWN"
