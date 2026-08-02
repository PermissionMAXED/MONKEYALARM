# STATUS — GOOBY-Godot-Rewrite (ehrlicher Ist-Stand)

Stand: **nach W18 (2. August 2026)** — nach den Wellen W1–W5 (M1-Kern), Mega-Eval +
Fix-Wellen, W6–W12 (Games/IPA, Ranch-DLC, Feedback, Polish, Complete, Final/IPA, Visuals,
Emotionen/Trailer), den REST-1…5-/FERTIG-1-Pässen, W13 A/B/C (Backlog-Großputz, 30 Pakete),
W14 (User-Feedback: UI-Full-Rework u. v. m.), W15 (Update-Kanal über dieses Repo + 9 weitere Pakete),
W16 (Wellen G2/G3: Inhaltsspalte, Ladebildschirm, Textpflege), W17 (Wellen G4/G5/G7:
UI-Rework in der Fläche, DLC-Fundamente, GvZ-PvP, Trailer 5.1, „Spielgefühl“ P50–P59)
und **W18 (Welle H: Subagent-Playtests, DLC-Welle B beider Läden, CI-Ausbau)**.
Quellen: `GODOT-PLAN.md` (bindend), `EVAL-VOLLSTAENDIGKEIT.md` (Revision W18),
`UserFeedback.md` (Wellen-Logbuch mit allen Paket-Erklärungen), die Playtest-Reports
unter `docs/playtests/` sowie Test-Runner- und CI-Ausgaben. Dieses Dokument sagt ehrlich,
**was fertig ist** und **was offen ist** — die historische Backlog-Liste steht in
`GODOT-PLAN.md` §6 (dort mit ✅-Annotationen für Erledigtes).

## Gesamtbild in Zahlen

- **Vollständigkeit (Revision W18):** 78 von 79 prüfbaren Web-Features vollständig,
  1 offiziell gestrichen (Gooby Welt) — die früheren Restpunkte (Ball-Wurf,
  Sammlungsset-UI, Gyro-Parallax, Wetter-FX, Fotomodus-Werkzeuge, Nougatschleuse,
  City Drive als Arcade-Runde) sind seit W13 alle im Code nachweisbar geschlossen.
  Einziger Katalog-Rest: die Web-Speise `corn-dog` hat weiterhin kein 3D-Asset
  (Details in `EVAL-VOLLSTAENDIGKEIT.md`, Revision W18).
- **Tests (Stand W18):** Voll-Lauf **3.511 Haupt-Tests / 0 rot** (nach den
  PT-META-Fixen), **157 Server-Tests / 0 rot** (nach der GvZ-PvP-Härtung),
  UI-Audit **204 Screens / 0 Befunde**
  im Leitformat iPhone 17 Pro Max quer (2868×1320); der W1c-UI-Runner lag zuletzt
  dokumentiert bei 24.815 Checks (Stand W15). `gdlint`/`gdformat` sauber, alles
  headless reproduzierbar.
- **CI:** `gooby-godot.yml` grün **inklusive `ios-ipa`-Job** — jeder Push baut eine
  forensisch verifizierte, unsignierte .ipa (Artefakt `GOOBY-godot-unsigned-ipa`,
  ~189 MB, Größenwacht CI-36 gegen `tools/ci/ipa_baseline.json`). Dazu seit W17/W18:
  Release-Notes-Automatik aus den Commits (CI-37), automatischer
  `latest_native`-Bump im Release-Job (W15), Concurrency-Regeln (CI-35),
  nächtlicher Schedule-Lauf (CI-38, s. Lücken) und Status-Badge im Root-README.
  Sideload-Runbook: `docs/godot-rewrite/IOS-BUILD.md`.
- **Spiele:** 38 startbare Arcade-Spiele — 31 Web-Spiele (inkl. City Drive als
  echte Arcade-Runde seit W13) + GvZ + GOB NOM + 5 Ranch-Spiele; dazu 2
  Netz-Brettspiele (Schiffe versenken, Schach) und die beiden spielbaren
  DLC-Loops (s. u.). 30 der 38 Spiele sind bit-genau gegen die alte Web-Version
  zertifiziert (W15; vorher 12).
- **Playtests:** Subagents SPIELEN das Spiel real (eigene Instanz, echte
  Taps/Wische, Screenshots): 6 Reports unter `docs/playtests/` (PT-home,
  PT-ui-loops, PT-stadt, PT-minigames-a, PT-minigames-b, PT-meta), Start per
  `tools/ci/run_playtest.sh alle`. Die Läufe fanden echte Blocker (u. a.
  Reise-Cutscene-Hänger, Belohnungs-Farm über Arcade-Zurück, Settings-Deckel
  über der DLC-Bibliothek) — alle gefixt, je mit Dauer-Wache.

## Was ist fertig (W1–W18)

| Bereich | Geliefert | Ehrliche Anmerkung |
|---|---|---|
| Fundament/Engine | Godot-4.4.1-Projekt, SceneRouter (EIN Transition-System; seit W15 fährt die Kamera beim Raumwechsel wirklich DURCH die Tür — additiv geladener Zielraum, Fallback auf den Wisch bei Reduced-Motion/Low-End), OrientationService, zwei Test-Runner, Playtest-Harness (P58/P59), CI (Import→Tests→Lint→Boot-Smoke→ios-ipa→Release) | Echtes iPhone-Profiling steht weiter aus (User-Action) |
| Gooby/Charakter | Blender-Pipeline → `gooby.glb` (Rig, Morphs), Gebrabbel-Stimme, Soul-/Mood-System, 12 expressive Emotionen + Postprocessing-Stack (W12), 8 neue Rig-Clips (W13: dance, tomato_throw, ceiling_cling …) + phone_up/phone_tap (W15), Schüttel-Secret mit Ragdoll-Flug + Geheim-Sticker (W13) | P2-Clips/PhysicalBone-Ragdoll bleiben M3 |
| UI/Meta-Loop | UI-Full-Rework (W14: Web-geeichte Tokens, AcBubble, Haptik) + Inhaltsspalte (W16) + Welle G7 „Spielgefühl“ (HUD-Dynamik, Sprechblasen ohne Wortabriss, IGohbie-Telefon-Rework, EIN Sheet-System mit Runterwischen, Ein-Spiel-Rahmen für alle 38 Spiele); Profil mit Abschluss-Karte, 44 Erfolge, Tagesquests (Pool 24) + Tagesbonus-Streak, Stickeralbum (144 Sticker) **inkl. der 4 Sammlungssets mit Claim** (W13) + Rarity-FX, Reisepass 2.0 + Abflugtafel, Codes, Galerie mit Export, Postkarten + Tagespaket, Radio mit Kauf-Gates, News, Settings inkl. Mehrspieler-Settings + Dev-Werkzeugkasten (W14), DE führend + EN-Parität | Garderobe ist weiterhin über HUD-Knopf UND Spiegel erreichbar — der alte H-Doc-Entscheid (Knopf entfernen?) ist nie gefallen |
| State/Save | Save v5 (atomar, 3 Backups, Recovery), Migrationskette Web v0–v4→v5, Umzugskoffer-Codec, iOS-Legacy-Import komplett; W18: Import-Fuzz + Backup-vor-Import-Beweis (`SAVE-TRANSFER.md` synchron) | Recovery-Hinweis-Toast beim Boot weiterhin unverdrahtet (String `system.recovered_backup` + `state_loaded`-Signal existieren, kein Konsument) |
| Haus/Bau/Garten | 5 Räume, Baumodus mit RUG/FLOOR/SURFACE/WALL **+ CEILING-Layer & spannbare Girlanden** (W13), Garage + Layout-Presets (W13), 207+ Möbel + Lager, Haus von außen, Kühlschrank 2.0 mit Fütter-Sequenz (W14), Ball-Wurf & Apport auf Web-Parität (W13+W18), Nougatschleuse (W13), Werkstatt + Crafting (8 Rezepte, W15 +3), Garten 2.0 + 4 neue Crops (W15: Radieschen/Mais/Aubergine/Kürbis → alle 4 Sammlungen komplettierbar), Wochenmarkt-Eigenstand mit Verkaufs-Sim (W15) | Keller/Etage/Balkon = M3 |
| Stadt/Orte | 15×12-Stadt mit Verkehr/Fußgängern/Tag-Nacht, sichtbares Wetter (Regen/Schnee/Gewitter, W13), begehbare Orte inkl. Tierarzt, Baumarkt, Autohaus, Wochenmarkt, Raumstation GOOB-1 (W13) und **NEU Kino „GOOBYWOOD“** (W18); Läden LEBENDIG (G7/W18: Ambient-Kunden, Kassen-NPCs, Flughafen-Reisende, GOOBERANDO-Fahrer); GOOBERANDO-Vollausbau mit 3 Restaurants + Fahrer-Sim (W13); IGohbie-Phone mit 7 Apps (inkl. Freunde-App, G5); Fotomodus MIT Pose-/Emotions-/Rahmenwerkzeugen (W13) + Gyro-Parallax (W13); Urlaub mit 9 Zielen, Weltengooby, Erholungs-Boost, GOOBY-FREE-Shop (W13) und „Gooby im Urlaub besuchen“ (W15) | — |
| Minigames | Framework (Host/Pregame/Results/JuiceKit, GoobyRng bit-identisch), 38 startbare Spiele im EIN-Spiel-Rahmen (G7/P56, Registry-Wache), City Drive als Arcade-Runde + Auto-Stats (W13), Endless-Modi, Modifier-Engine, GvZ-Kampagne (Sticker/Goldi-Code seit W13 verdrahtet), GOB NOM inkl. Level-Editor (W15), 30/38 bit-genau Web-zertifiziert (W15), danceParty-Latenz-Kalibrierung + HDR-Glow-Auto-Downgrade (W15) | Playtest-Übergaben offen: sporadisches „Invalid polygon data“, Mini-Untertitel unter HUD-Timern, runner-Bäume zu dunkel (s. `docs/playtests/PT-minigames-b.md`) |
| Ranch-DLC (W6–W9) | Open World (Bergmassiv + 16 Zonen), 12 Pferderassen, 13 NPCs, 27 Quests, Bau-Grid, Dorf, 7 Wettbewerbe + Liga, Wetter-FX, 5 Ranch-Minigames, Ranch-MP mit sichtbarem Einstieg im Spiel (G4), **Freischalt-Level 15** + 4 Ranch-Random-Events (W13) | — |
| Neue DLCs (W14–W18) | DLC-Hub (W14) + 2 Design-Docs (`DLC-GOO-UND-BYE.md`, `DLC-MCGOOBY.md`); **„Goo und Bye“ spielbar** (Welle A+B: Laden-Tag-Loop, Großmarkt + Preis-Schieber, Onkel Alwin sichtbar mit Tagesroutine + 12 Antipp-Gags); **„McGooby“ spielbar** (Welle A+B: Grill-Probeschicht, Kauf-Gate 3000 Münzen/L14, Belegen-Station + Schicht-Bühne) | Weitere Ausbau-Wellen der beiden DLCs sind geplant, nicht versprochen |
| Funkelpark (W10) | Plaza, Coaster, Riesenrad, Autoscooter, Karussell, Naschgassen-Stände | — |
| Cosmetics | 93 Einträge inkl. Galaxie-Fell mit Sternen-Shader (W13), Garderobe mit Live-Vorschau (G7-poliert), Pack-Format | — |
| Updates/Packs | **Updates laufen komplett über dieses Repo** (W15): Pack-Releases per Tag `packs-v*` (rollender `updates`-Release), Client lädt per GitHub-API mit Lese-Token (Einstellungen → Updates), `latest_native`-Bump automatisch im ipa-Release-Job; PackLoader + Boot-Guard (2-Crash-Regel), Handbuch `docs/UPDATES.md` | Repo ist privat → Freunde brauchen einen Lese-Token (`docs/UPDATES.md` §6a); ein realer Ende-zu-Ende-Release-Test auf einem Endgerät steht aus (User-Action: Sideload + Rückmeldung) |
| Server | `GOOBY-SERVER/`: express+ws, JSON-Storage, TOFU, Freunde+Presence (i18n seit W13), GoobyPal inkl. Verlaufs-Liste (W13), **Post/Mail + InstantGooby** (W13), Codes, Events, Analytics, Besuche + Besucher-Couch + Coop-Fahrt mit Radio-Sync (W13), Brettspiele (Schiffe versenken + Schach), GOB-NOM-Netz-Coop (W15), **GvZ-PvP** (`gvzmp.js`, G7), Ranch-MP, Webpanel + Account-Umzugs-Code (W13), Join-Secret (W14) — 157 Tests grün + MP-Smoke-Skript (`tools/ci/mp_smoke.sh`) | Kein öffentlicher Produktiv-Server: Betrieb selbst hosten (`GOOBY-SERVER/README.md`); TOFU statt CA-Pinning; Matchmaking bewusst nur Freunde |
| Trailer | `trailer/GOOBY-5.1-Godot-Trailer.mp4` (62,4 s, 1080p60, W17-Look, 34 Clips neu) — Vorgänger 5.0 liegt daneben | Track bewusst instrumental (dokumentierte Abwägung) |
| Qualität/Hygiene | Alle EVAL-2-Engine-Befunde B1–B11 behoben (B4 via Leak-Gate `tests/tools/leak_gate.gd` über alle 38 Spiele, B11 mit Wächter in `test_w13_gvz_wiring.gd`), E2E-„erste Stunde“-Test (W13), Warn-Sweep W18 (5 Headless-Fehler → 0), Orientierungs-Probe + Asset-`style_gate.py` (W17) | „0 rote Tests“ heißt weiterhin nicht „0 Logzeilen“ — s. Playtest-Übergaben |

## Bekannte Lücken (nicht verschweigen)

- **Natives Notification-Plugin fehlt** — bei geschlossener App kommt nichts an
  (dokumentierter Andockpunkt `_os_schedule()` in
  `GOOBY-GODOT/scripts/platform/notification_service.gd`). Dynamic
  Island/Live-Activities + Homescreen-Widget sind bewusst zurückgestellt
  (brauchen eine SIGNIERTE App, Sideload kann das nicht).
- **Recovery-Hinweis-Toast beim Boot unverdrahtet:** String
  (`system.recovered_backup`) und Signal (`state_loaded`) existieren, aber kein
  Konsument zeigt den Hinweis an. Die Recovery selbst funktioniert und ist
  getestet.
- **`corn-dog`** ist die letzte Web-Speise ohne 3D-Asset im Katalog.
- **Echtes iPhone-Profiling steht aus** (User-Action: .ipa sideloaden,
  Rückmeldung); Store-/Dauer-Signing gibt es bewusst nicht (Sideload-Modell).
- **CI-Schedule-Vorbehalt (CI-38):** GitHub feuert Cron-Läufe nur aus dem
  Workflow-Stand des Default-Branches — `main` trägt derzeit kein
  `.github/workflows/`, der nächtliche Lauf ist also Vorleistung.
- **Playtest-Übergaben offen** (aus `docs/playtests/`): sporadisches
  „Invalid polygon data“ (10/23 Minigame-Läufe, Frame-Dump lohnt),
  Mini-Untertitel kollidieren bei 4 Spielen mit HUD-Timern
  (P56-Rahmen-Kandidat), runner-Bäume fast schwarz (Belichtungswelle).
- **GvZ-Coop-Level existieren nicht** (PvP übers Netz ist komplett; Coop war
  nie gebaut). GOB-NOM-Coop läuft lokal UND übers Netz.
- **Ein realer Pack-/IPA-Release-Durchlauf Ende-zu-Ende auf einem Endgerät**
  ist noch nicht passiert (Automatik ist gebaut und getestet, aber der letzte
  Beweis am iPhone fehlt — User-Action).
- **Garderobe-Doppelweg:** HUD-Knopf UND Spiegel öffnen die Garderobe; der im
  H-Doc angedachte Rückbau des Knopfs ist ein weiterhin offener User-Entscheid.

## Mehrspieler + Save-Transfer — ehrlicher Ist-Stand

**Funktioniert JETZT** (Client + Server zusammen getestet; 157 Server-Tests grün):

- Verbindung: HELLO/WELCOME (TOFU), PING/PONG, Reconnect mit Backoff,
  Offline-Outbox, Verbindungsanzeige; Server/Port/Secret normal in den
  Einstellungen mit „Verbindung testen“ (W14), Secret serverseitig geprüft.
- Freunde: Freundescode, Einladung/Annahme, Presence-Liste (i18n), Freunde-App
  im IGohbie-Telefon (G5).
- Besuche: Haus-Snapshot, beide Goobys sichtbar, Besucher-Couch-Regel,
  Coop-Fahrt mit synchronem Radio (W13).
- GoobyPal: Münztransfer mit Tageslimit 250 inkl. Verlaufs-Liste im Client (W13).
- **Post/Mail + InstantGooby** (W13): Briefe/Fotos/Item-Geschenke an Freunde
  mit Quota + Offline-Outbox, InstantGooby-Feed.
- **Schiffe versenken + Schach KOMPLETT** (Vollpartie, Emotes/Tomate, Aufgeben,
  Revanche, Rejoin); Partie-Ende seit W18 im einheitlichen Minigame-Rahmen.
- **GvZ-PvP übers Netz KOMPLETT** (G5-Client + G7-Server `gvzmp.js`:
  Lockstep, Desync-Wächter, Rejoin-Frist, idempotente Belohnung).
- **GOB-NOM-Coop übers Netz** (W15, 2 Geräte, Lockstep + Rejoin).
- **Ranch-MP**: Besuche, Gruppen-Ausritte, 3 Live-Kurse, Ghost-Leaderboards —
  mit sichtbarem Einstieg am Hof (G4).
- Analytics + Webpanel (inkl. Pal-Ledger/Spiele/Ranch/Bans, W13),
  Account-Umzugs-Code.
- Save-Transfer: Umzugskoffer-Codec, bplist-Legacy-Import, Auto-Import beim
  Erststart; W18-Härtung: Import-Fuzz + Backup-vor-Import-Beweis
  (`SAVE-TRANSFER.md`).

**Fehlt noch (ehrlich):** kein öffentlicher Produktiv-Server (selbst hosten,
`GOOBY-SERVER/README.md`); Matchmaking/zufällige Gegner bewusst nicht (nur
Freunde); TOFU statt CA-Pinning; GvZ-Coop-Level existieren nicht.

## Wellen-Chronik W13–W18 (Kurzfassung — Details in `UserFeedback.md`)

- **W13 A/B/C (31. Juli, 30 Pakete):** Backlog-Großputz — u. a. Ball-Wurf,
  Sammlungssets im Album, Wetter-FX überall, 9 Speisen + Nougatschleuse,
  Post/Mail + InstantGooby, GOOBERANDO-Vollausbau, City Drive als
  Arcade-Runde, Reisepass 2.0, Raumstation GOOB-1, Decken-Layer + Girlanden,
  Galaxie-Fell, Foto-Werkzeuge + Gyro-Parallax, E2E-„erste Stunde“-Test +
  Leak-Gate, B11-Fix, Ranch-Level 15.
- **W14 (31. Juli, 12 Pakete):** UI-Full-Rework, Boot-Cover, Kühlschrank 2.0,
  120+ Lines + Antwort-Chips, Mehrspieler-Settings + Dev-Werkzeugkasten,
  DLC-Hub + 2 DLC-Design-Docs, Minigame-Qualitätspass.
- **W15 (31. Juli):** Update-Kanal über DIESES Repo, Gooby im Urlaub besuchen,
  4 Garten-Crops, GOB-NOM-Netz-Coop, Tür-Kamerafahrt, Wochenmarkt-Eigenstand,
  GOB-NOM-Editor, 30/38 Spiele Web-zertifiziert.
- **W16 (1. August, Wellen G2/G3, 25 Pakete):** UI-„Inhaltsspalte“,
  Ladebildschirm im Alt-Look + Blütenblätter-Wipe, 12 Orte-Knopfleisten,
  137 Text-Feinschliffe, Haptik-Stärke, Boot schneller.
- **W17 (1.–2. August, Wellen G4/G5/G7):** UI-Rework in der Fläche
  (Baumodus-Dock, Telefon, Reise-Strecke), DLC-Fundamente „Goo und Bye“ +
  „McGooby“ SPIELBAR, GvZ-PvP komplett, Trailer 5.1, 18 Minispiel-Polituren,
  Ein-Spiel-Gefühl, iPhone-17-Leitformat (UI-Audit 204 Screens/0),
  Playtest-Harness + „Subagents spielen“. (Die am 31.7. gestartete Welle G6
  fiel einem VM-Neustart zum Opfer und wurde transparent neu einsortiert.)
- **W18 (2. August, Welle H):** 6 Playtest-Reports (Haus, UI-Loops, Stadt,
  Minispiele ×2, Meta) mit echten, sofort gefixten Bugs; DLC-Welle B beider
  Läden (Großmarkt/Preise, Kauf-Gate/Belegen/Bühne, Onkel Alwin sichtbar);
  Ball-Apport-Webparität; Save-Import-Fuzz; CI-Ausbau (Release-Notes,
  Größenwacht, Concurrency, Schedule, Badge); Warn-Sweep; Kino GOOBYWOOD +
  lebendige Orte; Perf-Governor-Tuning.

## Wirklich noch offen (M3/Backlog — vollständig in `GODOT-PLAN.md` §6)

- **User-Actions:** echtes iPhone-Profiling; realer Ende-zu-Ende-Release-Test
  (Pack + .ipa am Gerät); Entscheid Garderobe-HUD-Knopf.
- **Braucht Signing (M3):** natives Notification-Plugin, ActivityKit-Live-Activity,
  Homescreen-Widget, Taxi-Live-Activity.
- **Engine (M3):** LightmapGI-Option, Shader-Warmup-Quad, PhysicalBone-Ragdoll,
  P2-Clips, Laufband-Gag, GOBBULL-Zocken.
- **Updates (M3):** RSA-Signierung der Manifeste, Mirror #2 über den Node-Server.
- **Haus (M3):** Keller/Etage/Balkon.
- **Stadt (M3):** Ambient-Audio-Distrikte, Traffic-Vollausbau.
- **Minigames:** Web-Zertifizierung der restlichen 8 Spiele (30/38);
  Playtest-Übergaben (Polygon-Warnung, Untertitel-Kollisionen, runner-Licht).
- **Netz (M3):** Companion-App-Modus; GvZ-Coop-Level (falls je gewünscht).
- **Prozess:** Welle I (Ideen-Planner → Roadmap) und weitere DLC-Ausbau-Wellen
  laufen als nächstes (s. `UserFeedback.md` §2).
