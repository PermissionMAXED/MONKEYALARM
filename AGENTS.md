# AGENTS.md

Arbeitsregeln für Agents in diesem Repo (GOOBY Godot-Rewrite).

## GOOBY-GODOT: Preflight-Pflicht vor jedem Push

- **Vor JEDEM Push, der `GOOBY-GODOT/**`, `tools/ci/**` oder
  `.github/workflows/gooby-godot.yml` berührt, MUSS `bash tools/ci/preflight.sh`
  lokal grün durchlaufen.** Das Skript spiegelt exakt die CI
  (gdformat --check, gdlint, Import-bis-vollständig via
  `tools/ci/check_imports.py`, beide Test-Runner, Boot-Smoke) und bricht mit
  klarem Fix-Hinweis ab. Hintergrund: 10 von 11 roten CI-Runs (W6/W7) waren
  vergessene `gdformat`-Läufe. Schnellvarianten: `--lint-only` (nur
  Format+Lint), `--no-tests` (bis inkl. Import-Gate).
- Temporäre Probe-/Debug-`.gd`-Skripte vor dem Push löschen oder formatieren —
  ALLES git-Getrackte unter `GOOBY-GODOT/` läuft durch gdlint/gdformat, auch
  `tests/` und `tools/`.
- Die `.ipa`-Verifikation (`tools/ci/verify_ipa.py`) leitet ihre Erwartungen
  (Orientierungen, Bundle-Id, Min-iOS, Device-Family) aus
  `GOOBY-GODOT/export_presets.cfg` ab — Preset-Änderungen brauchen KEINE
  Workflow-Anpassung mehr. Sie druckt am Ende
  „.ipa gebaut: X MB, Y Dateien im PCK" als Erfolgs-Beleg.
  Größenwacht (CI-36): die fertige .ipa wird zusätzlich gegen
  `tools/ci/ipa_baseline.json` verglichen — Wachstum ab +10 % WARNUNG,
  ab +50 % ROT. Gewolltes Wachstum: `size_bytes` in der Baseline auf den
  im Log gedruckten Byte-Wert setzen.
- MP-Smoke des Multiplayer-Servers: `bash tools/ci/mp_smoke.sh` startet den
  ECHTEN GOOBY-SERVER als eigenen Prozess (node server.js, freier Port,
  Temp-DATA_DIR) und belegt /health, den 2-Client-HELLO→WELCOME-Handshake,
  PING/PONG, Freundschafts-Handshake + Presence-Push und den sauberen
  SIGTERM-Shutdown. CI: nur als manueller workflow_dispatch-Job „mp-smoke"
  in `gooby-server.yml` — der Push-Pfad bleibt unverändert. Der große
  Feature-Smoke bleibt `GOOBY-SERVER/tools/smoke-rmp.mjs`.
- Zeitabhängige Logik/Tests: Zeit und Zufall IMMER injizieren
  (`Clock`-Muster von `game_state.gd`, RNG als Parameter) — keine
  OS-Uhr/`randomize()` in testbarer Kernlogik.

## Geteilte Module — wiederverwenden statt neu erfinden

- Minigame-HUD-Typografie: `MinigameHudTypo`
  (`GOOBY-GODOT/scripts/minigames/ui/hud_typo.gd`, reine static-Fabrik) ist
  DIE Quelle für Timer-/Unterzeilen-/Hinweis-Styles und Milchglas-Plates des
  P56-Rahmens — KEINE lokalen Plate-Fabriken oder Inline-Styleboxen mehr
  anlegen (Wache: `tests/unit/test_g7_rahmen_typo.gd`).
- Verfolgerkamera-Kollision der Fahrspiele:
  `GOOBY-GODOT/scripts/minigames/games/_3db_stage/chase_cam.gd` (`clip_xz`,
  PURE Statik, headless testbar) kürzt den Kamera-Boom vor der ersten Wand
  — von deliveryRush/cityDrive genutzt (Wache
  `tests/unit/test_3db_chase_cam.gd`); NICHT verwechseln mit der älteren
  Stadt-Kamera `scripts/city/chase_cam.gd` (`ChaseCam`, W3a, gedämpftes
  Follow ohne Wand-Clip).
- Orte-/Laden-Ambience: `OrtLeben`
  (`GOOBY-GODOT/scripts/city/ambience/ort_leben.gd`) ist DAS
  wiederverwendbare Besucher-System der Stadt-Orte
  (Tages-Seed-deterministisch, Wegpunkt-Schlendern, `kasse_punkt`-Käufer
  mit `kunde_kauft`-Signal, Sprüche aus `city_leben.sprueche.<domain>`);
  neue Orte docken über ~15 Zeilen `OrtScene._leben_konfig()` an (Muster
  REHWEI/Baumarkt/Flughafen, Wache `tests/unit/test_g7_ort_leben.gd`) —
  keine eigenen Ambient-Systeme bauen.
- DLC Welle B: McGooby (Kauf-Gate + Belegstation + Bühne) und Goo-und-Bye
  (Großmarkt + Preise + Onkel Alwin) leben unter
  `GOOBY-GODOT/scripts/dlc/<dlc>/`; Verträge/Details in
  `docs/godot-rewrite/DLC-MCGOOBY.md` + `DLC-GOO-UND-BYE.md`, Balance live
  über `content/dlc/data/balance.json`.

## Cursor Cloud specific instructions

- **Toolchain (frische VM):** Godot 4.4.1 via `bash tools/ci/install_godot.sh`
  (nach `/usr/local/bin/godot`); gdtoolkit via `pip3 install --user "gdtoolkit==4.*"`
  (`~/.local/bin` in den PATH — non-interaktive Shells brauchen
  `export PATH="$HOME/.local/bin:$PATH"`); Server-Deps via `npm install` in
  `GOOBY-SERVER/` (sonst schlagen die 2 Netz-Integrationstests der Hauptsuite
  fehl: „Cannot find package 'express'"). Blender 4.0.2 via apt (nur für
  `tools/blender/`-Pipelines nötig).
- **Die VM hat wenige Kerne** — parallele Godot-Instanzen vermeiden; die volle
  Preflight (`bash tools/ci/preflight.sh`) dauert ~10–15 min. Einzelne
  Testdateien laufen ohne den Runner über ein Wrapper-Skript nach dem Muster
  von `tests/run_tests.gd` (SceneTree-Skript per absolutem Pfad an
  `--script` übergeben; Aufruf immer über `tools/ci/run_godot_isolated.sh`).
- **Import-Cache-Gotcha:** Neue `class_name`-Skripte/Assets brauchen EINMAL
  `godot --headless --path GOOBY-GODOT --import`, sonst wirft der Test-Runner
  Parse-Errors (staler global_script_class_cache); erzeugte `.uid`/`.import`
  gehören MIT committet. Parallele `--import`-Läufe vermeiden (Cache-Race).
- **Repo-Umzug (W16):** Das Projekt lebt jetzt im Repo
  `MedusaV9/MinecraftBubbleShieldMod` auf dem Branch
  `cursor/gooby-godot-loop-2c10` (voller Verlauf des alten Branches
  `cursor/gooby-godot-rewrite-d1d8` aus `MedusaV9/CustomServerPrivate` wurde
  übernommen). `main` dieses Repos enthält ein ANDERES Projekt (Minecraft-Mod
  „Bubble Shield", Java/Gradle) — auf diesem Branch nicht anfassen. Der User
  schreibt live in `UserFeedback.md` (auch per Web-Commit → vor dem Push
  fetchen/rebasen) — Datei vor und nach jeder Runde lesen, Erledigtes abhaken.
- **CI:** Jeder Push auf `GOOBY-GODOT/**` baut die unsignierte .ipa (Artefakt
  `GOOBY-godot-unsigned-ipa`, Job `ios-ipa` auf macos-15, ~10-12 min).
  Versionierte GitHub-Releases: Tag `ipa-v<semver>` pushen (Job `release`).
  `gh` nur lesend nutzen (`gh run list/view`).
- **Headless ist MultiMesh WRITE-ONLY** (Dummy-Renderer):
  `MultiMesh.get_instance_transform()` liefert Identity, `buffer` ist leer —
  gebaute Platzierungen lassen sich headless NICHT aus MultiMeshes
  zurücklesen. Stattdessen den Testhaken `RanchBau.log_transforms` nutzen
  (Muster: `tests/unit/test_orientierung.gd`, die Orientierungs-Probe zu
  UserFeedback §1). Render-Beweise (Screenshots) gehen ohne `--headless`
  über `tools/ci/run_godot_isolated.sh xvfb-run -a godot --path GOOBY-GODOT
  --script <werkzeug>`.
