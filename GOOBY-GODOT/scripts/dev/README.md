# scripts/dev — Dev-Werkzeuge (Owner: W4-P5 INFRA)

Nichts hier ist Spiel-Content; alles ist debug-only bzw. Werkzeug.

## perf_overlay.gd — Performance-Overlay (Plan §2.4-14)

Kapsel oben links mit FPS, Frame-Zeit, Draw Calls + Primitiven
(`RenderingServer.get_rendering_info`), Node-Anzahl und VRAM.

- **Einschalten:** 3-Finger-Tap irgendwo auf den Screen ODER das
  AppSettings-Debug-Setting `dev.perf_overlay` (der Tap schreibt das
  Setting zurück, der Zustand überlebt also Neustarts).
- **Release:** In Nicht-Debug-Builds (`OS.is_debug_build() == false`)
  entfernt sich der Node in `_ready()` selbst — unsichtbar, null Kosten.
- **Autoload:** Request `PerfOverlay` liegt in
  `handoffs/project-godot-requests.md` (Orchestrator trägt ein). Bis dahin
  funktioniert das Skript auch manuell instanziert.
- **Tests:** `tests/unit/test_perf_overlay.gd`.

## perf_probe.gd — Messfahrt Stadt/Räume

Lädt `city_scene` + alle 5 Raum-Szenen, wartet auf `ready_for_reveal` und
misst über 60 Frames via `perf_overlay.snapshot()`. Braucht einen echten
Renderer:

```bash
xvfb-run -a godot --path . --rendering-method gl_compatibility \
  --rendering-driver opengl3 --script res://scripts/dev/perf_probe.gd
```

### Messwerte-Baseline (W4, 2026-07-25, Godot 4.4.1, xvfb/llvmpipe, 1280×720)

| Szene | Draw Calls | Primitive (Tris) | Nodes | VRAM MB |
|---|---|---|---|---|
| Stadt (city_scene, freie Fahrt) | 39 | 11 390 | 414 | 42,2 |
| Raum bathroom | 45 | 11 076 | 128 | 34,2 |
| Raum bedroom | 35 | 20 152 | 144 | 42,5 |
| Raum garden | 32 | 10 240 | 146 | 34,1 |
| Raum kitchen | 65 | 12 218 | 152 | 34,2 |
| Raum living | 57 | 19 710 | 170 | 34,4 |

Einordnung (Doc A §7-Budgets: ≤ ~120 Draw Calls, ≤ ~150k Tris mobil):
alle Szenen liegen komfortabel im Budget. FPS/Frame-Zeit aus diesem Lauf
sind NICHT aussagekräftig (Software-Rasterizer llvmpipe, ~5–8 FPS) — auf
echter Hardware zählen nur die Draw-Call-/Tris-/VRAM-Spalten; FPS bitte
auf dem Gerät mit dem Overlay selbst ablesen.

### Messwerte GOOBY-PERF (2026-08-02, Godot 4.4.1, xvfb/llvmpipe, 1280×720)

Gleicher Messaufbau wie W4 (`perf_probe.gd` über `run_godot_isolated.sh`).
Draw/Tris/Nodes = Max über 60 Frames; Zähler enthalten den Schattenpass
der einen Außen-Directional.

| Szene | Draw Calls | Primitive (Tris) | Nodes | VRAM MB |
|---|---|---|---|---|
| Stadt (city_scene, freie Fahrt) | 256 | 342 506 | 524 | 71,3 |
| Raum bathroom | 62 | 14 040 | 283 | 65,7 |
| Raum bedroom | 58 | 20 214 | 307 | 74,6 |
| Raum garden | 58 | 6 372 | 302 | 61,2 |
| Raum kitchen | 77 | 9 661 | 308 | 65,6 |
| Raum living | 80 | 10 962 | 346 | 66,1 |

Einordnung: Räume 58–80 Calls / ≤ 20k Tris — im ≤-150er-Raumbudget (§7),
Wachstum seit W4 (+15–23 Calls) = Content (Garten-Beete, Props, Leben).
Die Stadt ist seit FIX-5 bewusst dicht (Kulisse/Möblierung/Parker als
MultiMesh-Gruppen): 256 Calls liegen im eigenen Stadt-Budget ≤ 400
(`city_kulisse.gd::DRAW_CALL_BUDGET`, Heuristik + dieser Messlauf als
Nachweis); die 342k Tris sind MultiMesh-Instanzen + Schattenpass und
llvmpipe-seitig fillrate-, nicht draw-call-limitiert. VRAM ≤ 75 MB ≪ 350.
Wichtig: die Probe läuft OHNE Autoloads, also ohne `QualityService` —
gemessen wird das rohe Maximum (Schatten an, Skala 1,0); auf dem Gerät
zieht das Auto-Profil die Kosten weiter runter.

Boot-Proxy headless (`run_godot_isolated.sh godot --headless --quit`,
Autoloads + main.tscn + erster Frame, 4-Core-VM): 2 140 / 2 175 / 2 167 ms
≈ **2,16 s** — vor W16/BOOTPERF waren es ≈ 2,3 s (E4 §4), der Gewinn hält.
Bekannt und exit-only: die ObjectDB-Warnung beim Quit (1 suspendiertes
`_lade_welt`-GDScriptFunctionState, nur wenn mitten im Boot gequittet
wird — E4 §3, kosmetisch, wächst nicht).
