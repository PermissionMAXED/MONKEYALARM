# PT-UI-LOOPS — Playtest Telefon / Blätter / Garderobe / Zufalls-Affe (+ Harness-Ausbau)

**Runde:** W17, Playtest-Welle (PT-UI-Agent) · **Datum:** 2. August 2026
**Werkzeug:** Playtest-Harness (`GOOBY-GODOT/tests/tools/playtest_harness.gd`,
Aufruf `tools/ci/run_playtest.sh <flow>|alle`), Leitformat quer 2868×1320
(iPhone 17 Pro Max), llvmpipe/xvfb — Urteile nur zu Layout/Flow/Logik,
nicht zu GPU-Feinheiten oder Performance (s. Harness-Kopfdoku).

## Ergebnis auf einen Blick (Abschluss-Lauf: ALLE 10 Flows PARALLEL)

`PLAYTEST_MAX_SEC=1800 tools/ci/run_playtest.sh alle` — 10 Spieler-Agents
gleichzeitig, je eigene Godot-Instanz, eigenes `user://`, eigenes Display
(der User-Wunsch „Subagents sollen das Spiel richtig SPIELEN, 10 parallel").

| Flow | Zuschnitt | Schritte | Ergebnis |
| --- | --- | --- | --- |
| `flow_home_basis` | Tür → Kühlschrank → Möhre → Hunger-Buchung | 21 | **21 ok / 0 fail** |
| `flow_baumodus` | Bett aus Lager → Zelle → Platzieren → Save-Beweis | 22 | **22 ok / 0 fail** |
| `flow_arcade` | Teestube → Gießen → Pause → Beenden → Heim | 28 | **28 ok / 0 fail** |
| `flow_telefon` **(NEU)** | IGohbie → Freunde-App → HomeBalken → Runterwisch zu | 19 | **19 ok / 0 fail** |
| `flow_quests_sheet` **(NEU)** | Quest-Blatt → Griff-Runterwisch zu → wieder auf → Dim-Tap zu | 20 | **20 ok / 0 fail** |
| `flow_garderobe` **(NEU)** | Hut-Tab → Beanie KAUFEN+anziehen → Münz-/Save-Beweis → Zurück | 20 | **20 ok / 0 fail** |
| `flow_affe_haus` **(NEU)** | 40 seeded Wild-Taps quers Wohnzimmer → „lebt noch"-Beweis | 15 | **15 ok / 0 fail** |
| `flow_schlaf` (PT-HOME-Welle) | Bett → Schlafen → Wecken | 29 | 25 ok / **4 fail** (s. F3) |
| `flow_stadt` (parallele Welle) | Stadt-Rundgang | 44 | **44 ok / 0 fail** |
| `flow_ball_apport` (parallele Welle) | Ball werfen/apportieren | 22 | **22 ok / 0 fail** |

Übersicht + Einzel-Reports + Screenshot je Schritt:
`/tmp/gooby-godot/artifacts/PLAYTEST/alle_093507_40598/` (`uebersicht.md`).
Echte Buchungen statt Optik geprüft: Beanie-Kauf senkt `economy.coins`
exakt um 100 und legt `cosmetics.outfits.equipped.hat = beanie` in den
Save; der Affe beweist danach „Router idle + GameState erreichbar".

## Gefundene und GEFIXTE Bugs (beide über den Playtest gefunden)

### B1 — Quest-Blatt kam nach dem ersten Schließen nur noch als leerer Stummel

**Symptom (Pionier-Lauf `flow_quests_sheet`):** Tagesquests öffnen → per
Griff-Runterwisch schließen → wieder öffnen ⇒ statt des Blatts hing ein
leerer Chrome-Stummel (nur Griff+Titel) am unteren Rand, das HUD war weg,
`DailyQuestPanel` nicht mehr im Baum. Ein DRITTES Öffnen hätte ins
Freigegebene gegriffen.
**Wurzel:** `PanelSheet.add_content()` räumt Alt-Inhalt per `queue_free`
weg — auch dann, wenn der „Alt-Inhalt" derselbe Node ist, der gerade
WIEDER eingehängt wird (Dauer-Nutzer wie der `DailyQuestService` halten
ihr Panel über close/open hinweg). Der Node war danach löschungs-pendent.
**Fix:** `scripts/ui/panel_sheet.gd` — Wieder-Einhängen desselben Nodes
ist jetzt idempotent (kein `queue_free` auf den neuen Inhalt). Wache:
`test_g7_sheets.gd::test_gleicher_inhalt_ueberlebt_wiederoeffnen`
(zwei volle close/reopen-Runden). Beweis end-zu-end: `flow_quests_sheet`
20/20 grün inkl. „wieder öffnen" und Dim-Tap-Schließen.

### B2 — Telefon-Runterwisch-zum-Schließen war in der Statuszeilen-Mitte tot

**Symptom (Pionier-Lauf `flow_telefon`):** Der Runterwisch auf dem Gerät
(P52-Geste „runter = Telefon zu") kam nie an — das Telefon blieb offen.
**Wurzel (per Hit-Test-Instrumentierung belegt):** der Füll-`Control`
zwischen Uhr und Münzen/Akku in `_baue_statusleiste()` stand auf dem
Control-Default `MOUSE_FILTER_STOP` und schluckte Press+Drags in der
GANZEN Mitte der Statuszeile — `_on_geraet_input` bekam nichts. Auch für
echte Spieler kaputt (die Statuszeile ist die natürliche freie Wischzone;
App-Kacheln und Scroll-Bereich fangen Gesten systembedingt ab).
**Fix:** `scripts/city/phone/phone_shell.gd` — Füller + Akku-Balken
(reine Anzeige) auf `MOUSE_FILTER_IGNORE`. Wache:
`test_g7_phone.gd::test_statuszeile_schluckt_keine_gesten`. Beweis
end-zu-end: `flow_telefon` 19/19 grün, der Wisch schließt.

## Weitere Befunde (Übergaben)

- **F1 „Was nun?"-Karte über der Küchentür** (deckt sich mit PT-HOME F1):
  bleibt an der UI-Welle (hint_lane). Flow-seitig entschärft: alle Flows
  drücken die Karte im Onboarding-Baustein weg (`wasnun_wegdruecken`),
  und `tipp_3d` wartet jetzt auf einen FREIEN Bildschirmpunkt und nennt
  einen verbleibenden UI-Deckel im FAIL beim Namen.
- **F2 Harness-Report log fälschlich `name = '<schrittname>'`** als
  Erwartungstext, wenn eine `warte_bis`-Bedingung ein Callable war —
  gefixt (`bedingung` hat Vorrang, optionaler `erwartung`-Text).
- **F3 `flow_schlaf` rot im 10er-Parallellauf** (solo beim PT-HOME-Agent
  29/29 grün): `bett_antippen` öffnete die Nachtkarte nicht — das Bett
  lag in diesem Lauf am rechten Rand nahe der HUD-Cockpit-Spalte (Beleg
  `flow_schlaf/024_bett_antippen_FAIL.png`). Übergabe an PT-HOME:
  Tipp-Punkt/Platzierungszelle unter Last prüfen (evtl. `tipp_3d`-Offset
  bzw. Zellwahl weiter weg von der HUD-Spalte).
- **F4 Sprechblasen-Abriss mitten im Wort** in einem Zwischenscreenshot
  („…als ich e" / „…für immer a", `base_flow_home_basis/011…png`) — kann
  Typewriter-Momentaufnahme sein; der P51-Sweep sollte einmal mit echten
  Blasen-Langtexten nachmessen. Beobachten, kein bestätigter Bug.

## Harness-/Werkzeug-Ausbau in dieser Runde

- **`tools/ci/run_playtest.sh alle [BxH]`** — spielt ALLE Flows parallel
  (je eigene Lauf-Id, `user://`, Display), schreibt
  `uebersicht.md` mit Exit/Schritt-Bilanz pro Flow, Gesamt-Exit = worst.
- **Neue Aktion `affe`** — seeded Zufalls-Taps im rel-Rechteck
  (Robustheits-Netz: Script-Errors ins Log, Hänger in den Watchdog,
  Nachbedingung z. B. „Router wieder ruhig"). Erst-Nutzer `flow_affe_haus`.
- **`tipp_3d` mit UI-Deckel-Wache** — wartet bis der projizierte
  Weltpunkt frei ist (Overlays räumen sich oft selbst weg) und benennt
  den Deckel im FAIL, statt stumm ins Leere zu tippen.
- **4 neue Flows** (`flow_telefon`, `flow_quests_sheet`, `flow_garderobe`,
  `flow_affe_haus`) — decken User-Feedback-Schwerpunkte ab: Swipe-Gesten
  (Telefon UND Sheet-System), Modal-Grammatik (Dim-Tap), Kauf-Loop mit
  echter Münz-Buchung, Monkey-Robustheit.
