# PT-MINIGAMES-A — Playtest Minispiele 1–19 (Arcade-Reihenfolge)

**Runde:** W18, Playtest-Welle H (PT-MG-A) · **Datum:** 2. August 2026
**Werkzeug:** Playtest-Harness (`GOOBY-GODOT/tests/tools/playtest_harness.gd`)
mit dem NEUEN parametrisierten Spieler-Flow
`tests/tools/playtest_flows/flow_minigame.gd` — `PT_MG_ID=<id>
tools/ci/run_playtest.sh flow_minigame <BxH> mg_<id>`. Hochkant-Spiele im
Leitformat 1320×2868, Querformat-Spiele (gvz/gobnom/goalieGooby/
harborHopper) 2868×1320; llvmpipe/xvfb — Urteile nur zu Layout/Flow/Logik,
nicht zu GPU-Feinheiten oder Performance (s. Harness-Kopfdoku).

**Zuschnitt pro Spiel (ein Spieler-Agent, frischer Save):** Boot →
Onboarding → Arcade → Spiel-Kachel (über die Scroll-Falz geholt) → Pregame
→ „Spielen!“ → Countdown → spielspezifisches Daumen-Rezept (Taps/Wische/
Halten dort, wo die Steuerung sie erwartet) → Score-Signal-Probe
(pflicht=false) → Pause → Weiter → Pause → „Beenden“ → ggf. Results
„Zur Arcade“ → zurück in der Arcade. GvZ/Gobnom wählen vorher Level 1 im
spielinternen Level-Select.

## Ergebnis auf einen Blick — alle 19 Spiele einmal komplett durchgespielt

Der einzige wiederkehrende „fail“ ist die bewusst nicht-blockierende
Score-Signal-Probe (blinde Daumen-Rezepte punkten in Timing-Spielen selten
— cityDrive ★10 und hideSeek ★2 beweisen den Weg Spiel→Score→HUD).

| # | Spiel | Fenster | Schritte | Score | Auffällig |
| --- | --- | --- | --- | --- | --- |
| 1 | teaParty | hoch | 34 ok / 1 | 0 | — |
| 2 | carrotCatch | hoch | 34 ok / 1 | 0 | Korb folgt dem Drag sauber |
| 3 | gvz | quer | 43 ok / 1 | 0 | Lauf 1 rot → Harness-Fix F1 |
| 4 | gobnom | quer | 39 ok / 1 | 0 | Lauf 1 rot → Harness-Fix F1 |
| 5 | basketBounce | hoch | 34 ok / 1 | 0 | Timer/Hinweis ohne Plate (F4) |
| 6 | bubblePop | hoch | 38 ok / 1 | 0 | Polygon-Log-Fehler (F3) |
| 7 | bunnyHop | hoch | 40 ok / 1 | 0 | Crash → Results-Karte sauber |
| 8 | burgerBuild | hoch | 38 ok / 1 | 0 | Hinweis-Typo klein/blau (F4) |
| 9 | carrotGuard | hoch | 40 ok / 1 | 0 | — |
| 10 | cityDrive | hoch | 34 ok / 0 | **10** | Münzen + Checkpoint-Pfeil ok |
| 11 | danceParty | hoch | 40 ok / 1 | 0 | Bühne/Bahnen sauber |
| 12 | deliveryRush | hoch | 33 ok / 1 | 0 | Kamera in Wand (F2) |
| 13 | fishingPond | hoch | 38 ok / 1 | 0 | Diorama + Tiefe-Anzeige ok |
| 14 | gardenRush | hoch | 34 ok / 1 | 0 | Mini-Timer/-Hinweis (F4) |
| 15 | ghostHunt | hoch | 40 ok / 1 | 0 | — |
| 16 | goalieGooby | quer | 36 ok / 1 | 0 | „Tor kassiert…“ blass (F5) |
| 17 | goobySays | hoch | 37 ok / 1 | 0 | Fehler → Results-Karte sauber |
| 18 | harborHopper | quer | 34 ok / 1 | 0 | Horn-Meldung „TUUUT!“ ok |
| 19 | hideSeek | hoch | 41 ok / 0 | **2** | Tierchen-Fang + Welle ok |

Reports + Screenshot je Schritt: `/tmp/gooby-godot/artifacts/PLAYTEST/mg_<id>/`
(Erstpass) und `.../PLAYTEST2/mg_<id>/` (Nachläufe der 5 Spiele nach den
Werkzeug-Fixes). In JEDEM Lauf geprüft und grün: Kachel→Pregame (inkl.
„Kostet 8 Energie pro Runde“), Countdown, Pause-Modal (Weiter/Neustart/
Ton/Hilfe/Beenden), Beenden→Arcade-Route; bei bunnyHop/goobySays zusätzlich
das natürliche Rundenende mit Results-Karte (Sterne, Münzen, Tagesbonus,
XP, Nochmal/Zur Arcade/Nach Hause).

## Gefunden und GEFIXT (Werkzeug, in dieser Runde)

### F1 — Harness tippte Controls in Spiel-SubViewports am falschen Punkt

**Symptom (Pionier-Läufe gvz/gobnom):** `level_starten` rot — der Tap auf
die Level-1-Kachel kam nie an, der Level-Select blieb offen
(`PLAYTEST/mg_gvz/023_level_starten_FAIL.png`).
**Wurzel:** Der MinigameHost rendert das Spiel in einen SubViewport mit
Pillar-/Letterbox-Offset (`_layout_stage`). `get_global_rect()` von
Controls IM Viewport liefert VIEWPORT-Koordinaten — der rohe Tap ging um
den Stage-Offset daneben. Host-eigene UI (Pause/Beenden) war nie betroffen.
**Fix:** `playtest_harness.gd` — neues `canvas_punkt(control)` bildet die
Control-Mitte über ALLE SubViewportContainer-Ebenen nach außen ab (Offset +
Stretch-Skala je Ebene); `tipp_text`/`tipp_name`/`eingabe`/Nebenbei-Taps
nutzen es, `flow_minigame` für die gemerkte Level-Kachel ebenso.
**Beweis:** Nachlauf gvz 43 ok/1, gobnom 39 ok/1 — Level 1 startet, das
Gefecht bzw. die Backstube ist bespielbar.

### F1b — Eigener Flow-Bug (ehrlich): untypisierte Rezept-Listen

Im Pionier-Pass verloren cityDrive/deliveryRush/goobySays ihre
Spiel-Schritte: `Array[Dictionary] + [rohes Literal]` macht den Ausdruck
untypisiert, die Zuweisung schlug mit `SCRIPT ERROR: Trying to assign an
array of type "Array" …` leise fehl (die Läufe waren trotzdem „grün“, weil
der Rest des Flows lief). Fix: typisierter Baustein `_warteschritt()`;
Nachläufe spielen alle drei Spiele wirklich.

## Befunde (Übergaben)

### F2 — deliveryRush: Verfolgerkamera clippt bei Wandkontakt ins Gebäude

Lenkt man den Lieferwagen in eine Hausecke, steht die Chase-Kamera für
~2–4 s IN der Geometrie — Vollbild dunkelbraun/schwarz, nur HUD sichtbar,
danach fängt sie sich (Belege `PLAYTEST2/mg_deliveryRush/020…` Route ok →
`022_spiel_halte.png` Vollbild-Wand → `024_zuschauen.png` erholt). Ein
Spieler ist kurz komplett orientierungslos. Übergabe an die
Minigame-Welle: Kamera-Kollision/Naheclip fürs deliveryRush/cityDrive-
Kameramuster (cityDrive im Lauf ohne Wand-Moment, dasselbe Rig).

### F3 — „Invalid polygon data, triangulation failed“ in Wipe-Momenten

Je 1× in 3 von 19 Erstpass-Läufen (bubblePop, cityDrive, gobnom), immer im
Übergangs-Moment (Beenden→Arcade bzw. Force-Reveal nach Router-Timeout),
Quelle `canvas_item_add_polygon`. Die Veil-Wipe-Polygone selbst sind
sauber: eine Headless-Probe triangulierte `clip_punkte_rein/raus` über
u=0…1 in drei Fenstergrößen sowie Blüten-/Blatt-Stempel ohne Befund. In
den 5 Nachläufen trat der Fehler nicht auf. Kosmetisch (kein sichtbarer
Defekt in den Screenshots) — beobachten; nächster Schritt wäre ein
Frame-Dump im Wipe-Moment.

### F4 — HUD-/Hinweis-Typografie driftet zwischen den Spielen

teaParty/carrotCatch/fishingPond/danceParty/hideSeek zeigen Timer und
Hinweiszeile auf Milchglas-Plates (gut lesbar); basketBounce zeichnet
beide OHNE Plate (Timer blass auf Himmel, Hinweis klein und blau,
`PLAYTEST/mg_basketBounce/022_spiel_wisch.png`), burgerBuild ähnlich
(`…/mg_burgerBuild/024_spiel_tap.png`), gardenRush nutzt Mini-Kapseln mit
sehr kleiner Schrift (`…/mg_gardenRush/022_spiel_halte.png`). Kandidat für
den P56-„Ein-Spiel-Gefühl“-Rahmen: Timer/Hinweis einmal zentral stylen.

### F5 — goalieGooby: „Tor kassiert…“-Meldung fast unlesbar

Blassgelbe Schrift direkt auf hellem Rasen in der Feldmitte
(`PLAYTEST/mg_goalieGooby/024_spiel_wisch.png`). Plate oder dunkler
Kontrast-Layer würde reichen.

### F6 — SceneRouter-Hard-Timeout unter Parallellast

In `mg_gobnom` (Erstpass, 4 Godot-Instanzen parallel) griff beim Boot der
10-s-Force-Reveal (`SceneRouter: Hard-Timeout … 'home/living'`). Kein
Hänger, Lauf lief grün weiter — Last-Artefakt der Test-VM, nur beobachten.

### Nicht-Bugs (geprüft, unauffällig)

- bunnyHop-Crash und goobySays-Fehlversuch enden sauber in der
  Results-Karte mitten im Spiel (Sterne/Münzen/Tagesbonus/XP korrekt
  angezeigt, „Zur Arcade“ führt zurück).
- Die Arcade zeigt „38 Spiele“, alle 19 Kacheln 1–19 sind über die
  Scroll-Falz erreichbar (Kachel-Scroll via `ensure_control_visible`).
- Pause hält wirklich an (Timer stand in allen Stichproben), „Weiter“
  läuft nahtlos weiter, „Beenden“ bucht zurück zur Arcade-Route.
- Energie-Preis steht im Pregame („Kostet 8 Energie pro Runde“,
  `PLAYTEST/mg_teaParty3/017_pregame_ansehen.png`).

## Werkzeug-Ausbau in dieser Runde

- **`flow_minigame.gd`** — EIN parametrisierter Spieler-Flow für alle
  Arcade-Spiele (`PT_MG_ID`), mit spielspezifischen Daumen-Rezepten
  (Halten/Wischen/Tippen je Steuerung), Level-Select-Baustein für
  GvZ/Gobnom und Score-Signal-Probe. Die 19 Spiele liefen als 4 parallele
  Lanes (je eigenes `user://` + Display) in ~25 min durch.
- **`playtest_harness.canvas_punkt()`** — SubViewport-sichere
  Tap-Koordinaten für alle `tipp_*`-Aktionen (F1).
