#!/usr/bin/env bash
# Playtest-Wrapper (G7-P58, ausgebaut G7-P59): startet Playtest-Läufe der
# Harness GOOBY-GODOT/tests/tools/playtest_harness.gd (Doku im Datei-Kopf
# dort) — echtes Spiel (main.tscn) unter xvfb/llvmpipe, eigenes user:// pro
# Lauf (über run_godot_isolated.sh), Log-Tee und Log-Befund-Anhang an
# report.md.
#
# Nutzung: tools/ci/run_playtest.sh <flow>|alle [BxH] [lauf-id]
#   <flow>    z. B. flow_home_basis (Datei in tests/tools/playtest_flows/)
#   alle      ALLE Flows aus tests/tools/playtest_flows/ (ohne flow_basis)
#             PARALLEL spielen (ein Spieler-Agent pro Flow) und am Ende eine
#             Übersicht schreiben: $OUT_BASE/alle_<Zeit>/uebersicht.md
#   [BxH]     Fenster, Default 2868x1320 (Leitformat quer; hoch: 1320x2868)
#   [lauf-id] Ordnername unter /tmp/gooby-godot/artifacts/PLAYTEST/
#             (Default <flow>_<Zeit>_<PID> — parallele Läufe: einfach weglassen)
#
# Parallel (10 Instanzen): jede bekommt automatisch eigene Lauf-Id, eigenes
# user:// und ein eigenes xvfb-Display (xvfb-run -a):
#   tools/ci/run_playtest.sh alle            # bequem: alles auf einmal
#   for f in flow_home_basis flow_baumodus flow_arcade; do
#     tools/ci/run_playtest.sh "$f" & done; wait
#
# Exit-Codes: 0 alles ok, 1 Pflicht-Schritt fehlgeschlagen, 2 Watchdog,
# 3 Konfigurationsfehler, 124 harter timeout(1)-Abbruch. Bei `alle` gilt der
# schlechteste Code aller Flows.
set -uo pipefail

FLOW="${1:?Nutzung: run_playtest.sh <flow>|alle [BxH] [lauf-id]}"
RES="${2:-2868x1320}"
OUT_BASE="${PLAYTEST_OUT:-/tmp/gooby-godot/artifacts/PLAYTEST}"
MAX_SEC="${PLAYTEST_MAX_SEC:-900}"

cd "$(dirname "$0")/../.."
FLOW_DIR="GOOBY-GODOT/tests/tools/playtest_flows"

# ── Modus `alle`: jeder Flow ist ein eigener Spieler-Agent, alle parallel ────
if [ "$FLOW" = "alle" ]; then
	STAMP="$(date +%H%M%S)_$$"
	SAMMEL="$OUT_BASE/alle_$STAMP"
	mkdir -p "$SAMMEL"
	FLOWS=()
	for f in "$FLOW_DIR"/flow_*.gd; do
		name="$(basename "$f" .gd)"
		[ "$name" = "flow_basis" ] && continue
		FLOWS+=("$name")
	done
	if [ "${#FLOWS[@]}" -eq 0 ]; then
		echo "[run_playtest] keine Flows in $FLOW_DIR gefunden" >&2
		exit 3
	fi
	echo "[run_playtest] 'alle': ${#FLOWS[@]} Flows parallel -> $SAMMEL"
	PIDS=()
	for name in "${FLOWS[@]}"; do
		"$0" "$name" "$RES" "alle_${STAMP}/${name}" \
			>"$SAMMEL/${name}.out" 2>&1 &
		PIDS+=($!)
	done
	WORST=0
	{
		echo "# Playtest-Übersicht — alle_$STAMP"
		echo ""
		echo "- Fenster: $RES — ${#FLOWS[@]} Flows parallel (je eigenes user:// + Display)"
		echo ""
		echo "| Flow | Exit | Schritte | Report |"
		echo "| --- | --- | --- | --- |"
	} >"$SAMMEL/uebersicht.md"
	for i in "${!FLOWS[@]}"; do
		name="${FLOWS[$i]}"
		wait "${PIDS[$i]}"
		code=$?
		[ "$code" -gt "$WORST" ] && WORST=$code
		schritte="$(grep -oE "Schritte: [0-9]+ ok / [0-9]+ fail" \
			"$SAMMEL/$name/report.md" 2>/dev/null | head -1 || true)"
		echo "| $name | $code | ${schritte:-?} | $name/report.md |" \
			>>"$SAMMEL/uebersicht.md"
		echo "[run_playtest] $name -> Exit $code (${schritte:-kein Report})"
	done
	echo "[run_playtest] Übersicht: $SAMMEL/uebersicht.md (Gesamt-Exit $WORST)"
	exit "$WORST"
fi

# ── Einzel-Lauf ──────────────────────────────────────────────────────────────
LAUF="${3:-${FLOW}_$(date +%H%M%S)_$$}"
OUT="$OUT_BASE/$LAUF"
mkdir -p "$OUT/user-data"

# Harter Not-Aus 90 s über dem Harness-Watchdog (falls Godot selbst hängt).
PLAYTEST_FLOW="$FLOW" PLAYTEST_LAUF="$LAUF" PLAYTEST_OUT="$OUT_BASE" \
	PLAYTEST_SIZE="$RES" PLAYTEST_MAX_SEC="$MAX_SEC" \
	CIWATCH_USER_DATA_ROOT="$OUT/user-data" \
	timeout -k 15 "$((MAX_SEC + 90))" \
	tools/ci/run_godot_isolated.sh xvfb-run -a godot --path GOOBY-GODOT \
	--rendering-method gl_compatibility --rendering-driver opengl3 \
	--audio-driver Dummy --resolution "$RES" \
	--script res://tests/tools/playtest_harness.gd 2>&1 | tee "$OUT/lauf.log"
CODE="${PIPESTATUS[0]}"

# Log-Befunde (Godot-Fehlerausgabe = Fundgrube) an den Report anhängen.
{
	echo ""
	echo "## Log-Befunde (aus lauf.log)"
	echo ""
	echo '```'
	grep -nE "SCRIPT ERROR|USER ERROR|^ERROR|WARNING" "$OUT/lauf.log" \
		| grep -v "at: \|libEGL warning" | head -80 || echo "keine ERROR/WARNING-Zeilen"
	echo '```'
} >>"$OUT/report.md" 2>/dev/null

echo "[run_playtest] Lauf '$LAUF' fertig (Exit $CODE) -> $OUT/report.md"
exit "$CODE"
