# PT-MINIGAMES-B — Playtest Minispiele 20–38 + Ranch-Wettbewerbe

**Runde:** W18, Playtest-Welle H (PT-MG-B) · **Datum:** 2. August 2026
**Werkzeug:** Playtest-Harness (`GOOBY-GODOT/tests/tools/playtest_harness.gd`)
mit dem parametrisierten Spieler-Flow
`tests/tools/playtest_flows/flow_minigame.gd` (PT-MG-A), in dieser Runde um
die Rezepte 20–38, die Ranch-Level-Selects und das Turnier-Rezept
ausgebaut — `PT_MG_ID=<id> tools/ci/run_playtest.sh flow_minigame <BxH>
mg_<id>`. Hochkant 1320×2868, Querformat (runner/toyRacer/ranch\*)
2868×1320; llvmpipe/xvfb — Urteile nur zu Layout/Flow/Logik.

**Zuschnitt pro Spiel wie in PT-MG-A** (Boot → Onboarding → Arcade →
Kachel über die Scroll-Falz → Pregame → „Spielen!“ → Countdown → Rezept →
Score-Probe (pflicht=false) → Pause/Weiter → Beenden → Arcade). NEU in B:
ranchHerde/ranchParcours wählen Level 1 im `RanchLevelSelect`,
ranchTonnen/ranchZeit Lauf K1 im `RcompLevelSelect`, und ranchTurnier —
die **Ranch-Wettbewerbe** — spielt statt Level-Select das komplette
Turnier: Turnierplatz-Menü → „Schau-Wettbewerb“ → Einweisung mit
Starterfeld → „Los geht's!“ → 5 Kommandos im „Jetzt!“-Takt → Endstand
„Weiter“ → Siegerehrung „Zur Übersicht“ → zurück im Turnier-Menü.

## Ergebnis auf einen Blick — alle 19 Spiele + Turnier komplett durchgespielt

10 von 19 Spielen punkten sogar blind (PT-MG-A: 2 von 19) — der einzige
wiederkehrende „fail“ bleibt die bewusst nicht-blockierende Score-Probe in
Ziel-/Präzisionsspielen.

| # | Spiel | Fenster | Schritte | Score | Auffällig |
| --- | --- | --- | --- | --- | --- |
| 20 | lanternFloat | hoch | 35 ok / 0 | **2** | Ring getroffen, Nachtbild ruhig |
| 21 | memoryMatch | hoch | 41 ok / 0 | **46** | Live-Score-Projektion im HUD (s. u.) |
| 22 | miniGolf | hoch | 34 ok / 1 | 0 | Putt zählt (Schläge 0→1), Ball rollt |
| 23 | pancakeTower | hoch | 39 ok / 0 | **8** | Rundenende → Results-Karte sauber |
| 24 | pipeFlow | hoch | 40 ok / 1 | 0 | „Drehungen: 4“ — Taps drehen Rohre |
| 25 | purblePlace | hoch | 40 ok / 1 | 0 | Band-/Geschmacks-Knöpfe reagieren |
| 26 | ranchHerde | quer | 42 ok / 1 | 0 | Treiber folgt Taps, Pferch-Zähler ok |
| 27 | ranchParcours | quer | 43 ok / 0 | **10** | Galopp+Sprung → „Punkte: 10 · Serie: 1“ |
| 28 | ranchTonnen | quer | 41 ok / 1 → 43 ok / 1 | 0 | Lauf 1 Stand → Rezept-Fix F2 |
| 29 | ranchTurnier | quer | 51 ok / 1 → **58 ok / 0** | **30** | Lauf 1 im Menü → Werkzeug-Fix F1c |
| 30 | ranchZeit | quer | 41 ok / 1 → 43 ok / 1 | 0 | Nachlauf: Galopp, „Tor 2/7“ |
| 31 | rocketRescue | hoch | 37 ok / 0 | **48** | Schub/Neigen sauber, Tank-HUD ok |
| 32 | runner | quer | 40 ok / 0 | **27** | Spurwechsel ok — Bäume fast schwarz (F5b) |
| 33 | shoppingSurf | hoch | 39 ok / 0 | **38** | Münzen + „0× knapp“-Zähler ok |
| 34 | snailMail | hoch | 33 ok / 1 | 0 | HUD-Zeile unlesbar → Spiel-Fix F5a |
| 35 | starHopper | hoch | 38 ok / 0 | **2** | Crash → Results-Karte mitten im Spiel |
| 36 | toyRacer | quer | 35 ok / 1 | 0 | Rennen läuft (Runde 1/3, Platz 4) |
| 37 | trampoline | hoch | 40 ok / 0 | **5** | Trick-Ring + „HOP!“-Feedback ok |
| 38 | veggieChop | hoch | 37 ok / 1 | 0 | Wische verfehlen Flugobst (Timing) |

Reports + Screenshot je Schritt: `/tmp/gooby-godot/artifacts/PLAYTESTB/
mg_<id>/` (Erstpass) und `…/PLAYTESTB2/mg_<id>/` (Nachläufe
ranchTonnen/ranchTurnier/ranchZeit/snailMail nach den Fixes). In JEDEM Lauf grün:
Kachel→Pregame→Countdown, Pause-Modal, Beenden→Arcade; Arcade-Grid zeigt
alle Kacheln 20–38 über die Scroll-Falz erreichbar.

## Ranch-Wettbewerbe (ranchTurnier) im Detail

Der Nachlauf `PLAYTESTB2/mg_ranchTurnier` spielt das Turnier einmal ganz
durch, alle Stationen belegt:

- **Turnierplatz-Menü:** Liga-Panel („Deine Liga: Holzklasse“, 0/25
  Punkte, Leihpferd Wolke, Turniertag-Bonus +25 % Gold), Liga-Dropdown,
  „Geist zeigen“-Toggle, 7 Disziplin-Kacheln (`045_knopf_tippen.png`).
- **Schau-Kür:** Einweisung mit Starterfeld → „Los geht's!“ → 5 Kommandos
  („Steigen/Kompliment/…“) mit großem „Jetzt!“-Knopf und
  „Kommando x/5“-Zähler (`033_spiel_takt.png`) — endet nach dem 5.
  Kommando von selbst (deshalb die Kür als Automations-Disziplin: die
  Reit-Disziplinen enden erst im Ziel).
- **Endstand + Siegerehrung:** Ergebnisliste → „Weiter“ → Podium → „Zur
  Übersicht“ → zurück im Menü, danach ★30 im HUD und Liga-Fortschritt
  1/25 — der Weg Turnier→Score→Liga-Punkte stimmt.
- Die übrigen Wettbewerbs-Läufe stecken in ranchTonnen/ranchZeit
  (`RcompLevelSelect`, Lauf K1 = Wettbewerbs-Katalog `comp_katalog.gd`)
  und sind oben mitgespielt (Galopp bestätigt, Lenken bleibt blind
  zufällig — Score im Ziel bleibt Menschensache).

## Gefunden und GEFIXT (in dieser Runde)

### F1c — Turnier-Menü: Knöpfe unter der Scroll-Falz wurden daneben getippt

**Symptom (Pionier-Lauf ranchTurnier):** Der Lauf blieb die ganze Runde im
Turnierplatz-Menü stehen (★0, `PLAYTESTB/mg_ranchTurnier/031_spiel_takt.png`)
— `tipp_text` FAND „Schau-Wettbewerb“, aber die Kachel lag unterhalb der
Scroll-Falz der Menü-Spalte, der Tap ging an geclippte Koordinaten.
**Fix (Flow):** scroll-sicherer Dreischritt `_knopf_schritte`/
`_merke_knopf_text` in `flow_minigame.gd` — warten bis der Text da ist,
über alle Scroll-Vorfahren ins Bild holen (`ensure_control_visible`),
dann `tipp_pos` auf die gemerkte Kanvas-Mitte (Muster der Arcade-Kachel).
**Beweis:** Nachlauf 58 ok / 0 fail, Turnier komplett inkl. ★30.

### F2 — Gangart-Wische: Rezept-Wische waren länger als `WISCH_MAX_MS`

**Symptom (ranchTonnen/ranchZeit, Erstpass):** Pferd blieb trotz
Hoch-Wischen rechts in „Stand“ (`PLAYTESTB/mg_ranchTonnen/031_spiel_takt.png`).
**Wurzel:** `ride_touch.gd` wertet nur Wische **unter 250 ms**
(`WISCH_MAX_MS`) als Gangart-Befehl; die Rezept-Wische dauerten 0,3 s.
Kein Spielbug — ein Daumen-Flick ist real deutlich kürzer.
**Fix (Flow):** Wisch-Dauer 0,12 s. **Beweis:** beide Nachläufe galoppieren
(ranchZeit „Tor 2/7“ `PLAYTESTB2/mg_ranchZeit/034_zuschauen.png`,
ranchTonnen `…/033_spiel_takt.png`).

### F5a — snailMail: „Post · Blumen“-Zeile unlesbar auf den Baumkronen (GEFIXT, Spiel)

**Symptom:** Die Statuszeile stand blass und konturlos direkt auf der
Baumkronen-Reihe (`PLAYTESTB/mg_snailMail/023_spiel_takt.png`) — dieselbe
Kontrast-Klasse wie goalieGooby-F5 aus PT-MG-A. Die HINWEIS-Zeile im
selben Spiel hatte ihre Kontur schon aus einer früheren Runde.
**Fix:** `snail_mail.gd` `_build_hud()` — `_stat_label` bekommt dieselbe
helle Schrift + dunkelgrüne Kontur wie `_hint_label`.
**Beweis:** Nachlauf `PLAYTESTB2/mg_snailMail/024_spiel_takt.png` — Zeile
klar lesbar, Lauf 34 ok / 1 (nur Score-Probe).

## Befunde (Übergaben)

### F3 (Fortschreibung) — „Invalid polygon data“ jetzt in 10 von 23 Läufen (GEFIXT, Nachtrag)

Je 1–2× pro Lauf (lanternFloat, memoryMatch ×2, pancakeTower,
ranchParcours, ranchTonnen, rocketRescue, runner, shoppingSurf,
veggieChop ×2, ranchZeit-Nachlauf) — häufiger als in PT-MG-A (3/19),
wieder ohne sichtbaren Defekt in den Screenshots. Der Frame-Dump im
Wipe-Moment (PT-MG-A-Vorschlag) lohnt sich jetzt wirklich.

**GEFIXT (Nachtrag, Bugfix-Sweep):** Wurzel gefunden und behoben — der
Indeterminate-Sweep der Veil-Karte erzeugte am Track-Rand Sliver-Pills mit
Naht-Doppelpunkten, die die Triangulation je nach float32-Rundung der
x-Verschiebung sprengten. Details, Fix (`LoadingVeilBalken.pill_punkte`
dedupliziert) und Wache: PT-minigames-a.md, F3-Nachtrag.

### F4 (Fortschreibung) — Mini-Untertitel unter den HUD-Timern

Dieselbe Typografie-Drift wie in PT-MG-A, in B-Ausprägung: veggieChop
„Verpasst: x/3“, pancakeTower „Breite: 13 %“, ranchParcours
„Punkte: 10 · Serie: 1“, pipeFlow „Rätsel 1 · Drehungen: 4“ — alles
Winzschrift direkt unter dem großen Timer. Gehört mit in den zentralen
P56-Timer/Hinweis-Rahmen.

### F5b — runner: Laubbäume kippen ins Fast-Schwarze

Im runner stehen die Bäume neben der Straße fast schwarz im Bild
(`PLAYTESTB/mg_runner/030_spiel_takt.png`) und stechen aus der
Pastell-Palette aller übrigen Spiele (Nachbar shoppingSurf: hell und
freundlich). Material/Belichtung, kein Layout-Thema — Kandidat für die
Politur-/Belichtungswelle, nicht blind per Konstante fixbar.

**GEFIXT (Nachtrag, Politur-Welle):** Wurzel war MATERIAL, nicht Belichtung —
die Nature-Kit-GLBs (Bäume/Büsche/Blumen/Findlinge) tragen ihre Farbe als
`baseColorFactor` MIT `metallicFactor: 1`, die City-/Car-Kits dagegen eine
colormap-Textur mit Metall 0. Auf der reflexionslosen 3D-B-Bühne
(`stage3d.gd`: REFLECTION_SOURCE_DISABLED) hat Voll-Metall fast keine
diffuse Antwort — daher das Fast-Schwarz, das auch die W14-Sonnen-/
Fill-Nachschärfung nicht heilen konnte. Fix in der geteilten 3D-B-Modellbank
(`model_bank.gd`): Metall-Materialien werden beim Backen entmetallisiert und
über `Props3D.pastel` + NATURE-Tabelle auf die Pastellpalette der
3D-A-Spiele gezogen (Kenney-Türkis → warmes Laubgrün); colormap-Kits bleiben
unangetastet. Heilt neben dem runner auch die Stadt-Bäume von
cityDrive/deliveryRush (gleiche Bank). Wache:
`tests/unit/test_3db_pastell.gd` (entmetallisiert + Palette + colormap
unberührt; Mutations-Probe rot ohne Fix). Beweis: xvfb-Screenshots
runner/cityDrive/deliveryRush — Laub lesbar grün, Stämme warm braun;
Ranch-Welt und Ranch-Minispiele geprüft und unauffällig (eigene
Baum-Pipelines, kein Fast-Schwarz).

### Nicht-Bugs (geprüft, unauffällig)

- pancakeTower/starHopper enden blind mitten im Play-Fenster — die
  Results-Karte (Sterne, „Neuer Rekord!“, Münzen ×2 Tagesbonus, XP)
  erscheint sauber IM Spiel, „Nochmal/Zur Arcade/Nach Hause“ komplett.
- miniGolf zählt den Putt ehrlich (Schläge 0→1, Ball sichtbar bewegt) —
  Score gibt es erst beim Einlochen; Blind-Zielen trifft nicht (ok).
- toyRacer fährt das Rennen wirklich (Positions-Leiste, Rundenzähler,
  Gegner sichtbar vorm Tor-Bogen) — Score erst im Ziel nach 3 Runden,
  länger als das Play-Fenster (ok).
- purblePlace nimmt Geschmacks-/Form-/Band-Knöpfe an (Erdbeer gewählt,
  „Aufs Band!“ gedrückt) — Punkte gibt es nur für die RICHTIGE Torte (ok).
- memoryMatch: ★46–47 bei „Paare 0/8“ ist KEIN Zählerbug — das Spiel
  meldet den Live-Endstand (`20 − Fehlgriffe + Zeitbonus`,
  `memory_match_logic.memory_score`) laufend ans HUD; der Wert sinkt
  sichtbar mit jedem Fehlgriff (★47→★46 zwischen 7 s und 9 s).
  Diskutabel fürs Spielgefühl (Startwert ~47 vor dem ersten Paar),
  aber konsistent mit der Web-Referenz.

## Werkzeug-Ausbau in dieser Runde

- **`flow_minigame.gd`** — 19 neue Daumen-Rezepte (20–38), Ranch-Level-
  Selects (`RanchLevelSelect`/`RcompLevelSelect`) im bestehenden
  Level-Baustein, `_turnier_rezept()` für die Ranch-Wettbewerbe und die
  scroll-sicheren Bausteine `_knopf_schritte`/`_knopffolge` (F1c).
- Die 19 Spiele liefen als parallele Lanes (je eigenes `user://` +
  xvfb-Display) in ~2 Wellen durch; Exit 0 in allen 23 Läufen
  (19 Erstpass + 4 Nachläufe).
