# UserFeedback — dein direkter Draht zum Agenten

**So funktioniert's:** Schreib unten unter „Neu von dir" einfach rein, was dich
stört, was fehlt oder was du dir wünschst — Stichworte reichen, kein Format nötig.
Der Agent liest die Datei vor und nach jeder Arbeitsrunde, hakt Erledigtes ab und
schreibt dazu, WAS er gemacht hat.

| Zeichen | Bedeutung |
|---|---|
| `[ ]` | offen |
| `[~]` | der Agent arbeitet gerade daran |
| `[x]` | erledigt (mit Erklärung darunter) |
| `[?]` | Rückfrage an dich |
| `[-]` | bewusst zurückgestellt (mit Begründung) |

---

## 1. Neu von dir

> **Hier reinschreiben.** Stichworte reichen, z. B. „HUD im Querformat zu weit links"
> oder „Taxi-Sound zu laut". Der Agent hakt sie ab und schreibt dazu, was er gemacht hat.



_(NEU seit W16: Das Projekt ist umgezogen — es lebt jetzt im Repo
`MedusaV9/MinecraftBubbleShieldMod` auf dem Branch `cursor/gooby-godot-loop-2c10`,
mit komplettem Verlauf. Alle Updates/Builds laufen ab jetzt über dieses Repo.
Diese Datei bleibt dein direkter Draht: einfach unten reinschreiben.)_


- [x] **„Alle Assets immer richtig rotiert und richtig rum"** → Orientierungs-
      Audit über alle 674 GLB/GLTF-Modelle (headless vermessen: Fuß-Ursprung,
      nichts versenkt/schwebt/liegt falsch) UND über die Platzierungs-Systeme
      (Stadt-Kulisse, Home-Deko/Girlanden, Ranch-Welt, Funkelpark). Die
      Modelle selbst waren alle richtig herum (Kits nutzen Fuß-Ursprung;
      Ausnahmen wie Räder/Wandhalter sind Absicht) — aber DREI echte
      Dreh-Fehler steckten in der Ranch-Welt und sind gefixt: (a) der
      Aussichtszaun am Hügelkamm stand als radiale SPEICHEN statt als
      geschlossener Ring, (b) das Geländer der See-Aussicht stand als „Kamm"
      (jede Latte einzeln Richtung See gedreht) statt durchgehend quer,
      (c) alle 3 Weidegatter lagen PARALLEL neben dem Weg statt quer über
      ihm. Damit das nie wieder passiert, wacht jetzt eine dauerhafte
      **Orientierungs-Probe** (tests/unit/test_orientierung.gd): Boden-
      Modelle stehen auf dem Fuß, die Stadt-Kulisse steht aufrecht (kein
      Kippen/Scheren/Spiegeln), Zaun-KETTEN laufen längs ihrer Linie
      (fängt „Speichen"/„Kamm" sofort), Gatter stehen quer zum Weg.

- [x] **„nutze / downloade dir endlich mal mehr Modelle — aber nur wenn der
      Stil zu unserem Spiel passt!!" (+ Unity-Store-Links + Temp-Mail-Tipp)**
      → 12 kuratierte CC0-Modelle aus Kenney- und Quaternius-Kits sind drin,
      alle account-frei geladen und mit Lizenz-Datei direkt im Asset-Ordner:
      der Urlaubs-STRAND hat jetzt echte Palmen (3 Sorten, Kenney Nature
      Kit), ein Segelboot draußen auf dem Meer, zwei Bojen und ein
      Ruderboot im Sand (Kenney Watercraft Kit); in den BERGEN ersetzen ein
      echtes Stoff-Zelt und eine Lagerfeuer-Steinstelle (Kenney Survival
      Kit) die alten Bordmittel-Primitive, dazu ein Wanderweg-Wegweiser;
      im Rocket-Rescue-Minigame hängt statt der nackten Kugel ein echter
      Low-Poly-Planet am Himmel und ein gestrandetes Raumschiff-Wrack liegt
      in der Kulisse (Quaternius Ultimate Space Kit). NEU als Dauer-Wache:
      `tools/assets/style_gate.py` prüft ALLE 686 Modelle im Repo (Lizenz-
      Datei vorhanden, Tri-/Dateigrößen-Budget, Texturgröße, aufrecht,
      steht auf dem Fuß) — der erste Lauf fand 21 ECHTE Fehler im Bestand
      (fehlende colormap.png in kenney-suburb/kenney-food/gfree/star_hopper:
      die Modelle waren still GRAU statt bunt), alle gefixt. Die Quellen-
      Übersicht mit allen Lizenzen steht in docs/ASSET-SOURCES.md. ZU
      DEINEN LINKS: der Unity Asset Store geht NICHT — auch „free" Assets
      binden per EULA an die Unity-Engine, in unserem Godot-Spiel wäre das
      eine Lizenzverletzung. Und Accounts per Temp-Mail lege ich nicht an
      (verstößt gegen die Nutzungsbedingungen der Seiten). Die sichere
      Alternative sind Kenney/Quaternius/Poly Pizza: echtes CC0, kein
      Account nötig, und der Low-Poly-Stil passt genau zu uns.




- [x] **Dein Feedback vom 1. August (mit 7 Screenshots, iPhone quer):** UI-Full-
      Rework, dynamisches UI mit Animationen (z. B. Baumenü → andere Knöpfe
      verschwinden), ALLE Bugs fixen, Subagents sollen das Spiel richtig SPIELEN
      (10 parallel, jeder eigene Instanz), iPhone 17 Pro Max + Querformat als
      Leitformat, Modal-Menüs + Swipen/Wischen fixen, Läden sind zu leer (echte
      Orte mit animierten Chars!), alles fühlt sich wie eine Dev-Demo bzw. wie
      einzelne Spiele statt EIN Gooby-Spiel an.
      → **Welle G7 „SPIELGEFÜHL" ist KOMPLETT GELANDET** (alle Pakete P50–P59,
      Kurz-Erklärungen unten in „In Arbeit"): HUD-Knöpfe gleiten im Baumenü
      animiert weg und kommen zurück, Sprechblasen reißen nie mehr mitten im
      Wort ab, das Telefon hat Icons/Labels/Wisch-Gesten, EIN Sheet-System mit
      Runterwischen-zum-Schließen überall, Garderobe + Gestalten poliert,
      REHWEI/Baumarkt/IKEA haben animierte Kunden-Goobys + Kassen-NPC, alle 38
      Minispiele laufen im selben Gooby-Rahmen (Ein-Spiel-Gefühl), iPhone 17
      Pro Max quer ist das Leitformat (UI-Audit jetzt 204 Screens / 0 Befunde)
      und die Subagents SPIELEN das Spiel wirklich: eigene Instanz pro Spieler,
      10 parallel, 3 Playtest-Reports (Haus, UI-Loops, Stadt/Reise) — dabei
      4 echte Bugs gefunden UND gefixt. Deine 7 Screenshot-Befunde sind ALLE
      behoben: HUD-Kacheln schneiden Wörter ab („IGohbi/Garder/Gestalt"),
      Sprechblasen brechen mitten im Wort („Ohh, wird das sch"), Tagesquests-
      Blatt liegt ÜBER den Status-Leisten, IGohbie-Telefon hat ein kaputtes
      Dunkel-Icon, Gestalten-Liste schneidet „Briefkasten" ab, Baumodus =
      Knopf-Salat (der bekannte 97-Befunde-Wurzelfix, MIT Weggleit-Animation)
      — jeder Punkt hat jetzt eine Dauer-Wache im Test, damit er nicht
      zurückkommt.

_(Runden W14 UND W15 sind FERTIG — Details unten in „Erledigt". Aktueller Stand:)_

- [x] **W16 / Welle G2 FERTIG (1. August):** 13 Umsetzungs-Pakete gelandet,
      voller Testlauf grün (3024 Tests / 0 rot). Im Einzelnen:
      **(a) Update-Kanal aufs neue Repo** (Client-Config + Pack 1.1.0 + Doku
      samt Zugangsschlüssel-Migration),
      **(b) UI-Rework Fundament „Inhaltsspalte"** — Hintergrund vollflächig,
      Knöpfe/Inhalte gedeckelt in der Mitte; 7 Menü-Screens + Einstellungen
      umgestellt, automatische Zentrier-Prüfung wacht jetzt über alle Screens,
      **(c) Ladebildschirm im Alt-Look** — Szenenwechsel-Karte 1:1 nach der
      alten Web-Version (Cover-Zone, hüpfender Sticker, Teal-Balken, Tipps)
      **plus der rosa Blütenblätter-Wipe** als Übergang (26 Blüten/Blätter
      reiten der Wisch-Kante voraus, exakt die alten Web-Kurven),
      **(d) Arcade-Fix** — die 5 Ranch-Wettbewerbe haben echte Cover statt
      „?"-Platzhalter,
      **(e) 5 Minispiel-Polituren** — starHopper, trampoline, hideSeek,
      cityDrive und die Ranch-Arena (Überstrahlung raus, Publikum rein),
      **(f) Boot schneller** — erster Pixel ~55 ms früher, Welt-Laden mit
      echtem Fortschritt + vorgewärmter Musik (kein Ruckler in der Öffnung),
      **(g) 11 Prozess-/Robustheits-Fixe** (stapelnde Klick-Animationen,
      Zeitzonen-Fehler im Schnupfen-Wetter, schlafende Hintergrund-Prozesse,
      Speicher-Rettung aus Backups).
- [x] **W16 / Welle G3 FERTIG (1. August):** 12 Umsetzungs-Pakete gelandet,
      voller Testlauf grün (3078 Tests, alle Störfeuer beseitigt — u. a. 416
      wiederkehrende Fehlerzeilen im Testlauf auf 0 gebracht). Im Einzelnen:
      **(a) Inhaltsspalte ausgerollt** auf Arcade, IKEA-Katalog, Garderobe +
      Gestalten (mit Hochformat-Stapel) und das Album (Rail wird hochkant zur
      Chip-Leiste) — Hintergrund bleibt vollflächig, Knöpfe/Inhalte mittig,
      **(b) 12 Stadt-Orte** bekommen eine zentrierte Knopfleiste in der
      Daumenzone statt Ecken-Knöpfen; „geschlossen" (GOOBY-FREE) sieht man
      jetzt am Ort statt nur als Toast,
      **(c) Sozial + Post fühlbar** — alle Knöpfe drücken sich (Squish + Sound
      + Haptik nach fester Grammatik), Brief-Schreibfeld verwirft nichts mehr
      ohne Nachfrage, Ungelesen-Zähler als hübsche Kapsel,
      **(d) 137 Text-Feinschliffe** (Apostrophe, Gedankenstriche, ein Ding =
      ein Name, wärmerer Tonfall) über 50+ Dateien,
      **(e) Haptik-Stärke** (dezent/normal/stark) wirkt jetzt wirklich,
      **(f) carrotGuard poliert** (Möhren-Reihe fliegt sichtbar, Kombo-Pips,
      König-Banner, Timer-Urgenz, Intro-Beat),
      **(g) Server-CI + ehrliche Doku**, **(h) Trailer-Vorarbeiten**
      (Storyboard v4, 4 neue Aufnahme-Treiber, Zahlen-Fixes).
- [x] **W17 / Welle G4 FERTIG (1. August):** 18 Pakete gelandet, voller Testlauf
      grün (**3235 Tests / 0 rot**, UI-Audit **21 Screens × 4 Formate = 0 Befunde**).
      Das UI-Rework ist damit in der Fläche angekommen:
      **(a) Baumodus** — alle Werkzeuge in EINEM Dock unten-mittig (Daumenzone),
      **(b) IGohbie-Telefon** skaliert endlich mit (kein 420er-Überstand mehr),
      Fotomodus-Sucher in der Safe-Area,
      **(c) Reise-Strecke** — Abflugtafel/Reise-App/Bordkarte auf realer Breite,
      Weltengooby-Fortschritt „n/9 bereist" + Stempel,
      **(d) Radio/Kino/GOB.TY/Geschichten** — alle Knöpfe endlich fingergroß,
      **(e) Ranch-Mehrspieler hat jetzt einen sichtbaren Einstieg im Spiel**
      (Hof-Knopf → Raum anlegen/beitreten/Code teilen),
      **(f) Level-Auswahlen + Brettspiele** mittig mit gepinntem Fertig-Knopf,
      **(g) Boot-Ladebalken als Möhren-Pill im Alt-Web-Look** samt Papier-Ladekarte
      und „Lädt… NN%", **(h) Onboarding/Quests/Geburtstags-Feier** poliert,
      **(i) 7 Minispiel-Polituren** (teaParty, carrotCatch, bubblePop+bunnyHop,
      danceParty, fishingPond, goalieGooby, rocketRescue — Intro-Beats, lesbare
      HUDs, Jubel-Momente), **(j)** zentraler Fix: Punkte-Texte/Ringe treffen
      jetzt in ALLEN Spielen den gemeinten Punkt statt im Creme-Rand zu kleben,
      **(k)** Test-Runner gehärtet (ein Tippfehler in einer Testdatei kann den
      Lauf nicht mehr dauerhaft aufhängen).
- [x] **W17 / Welle G5 FERTIG (1. August):** 13 Pakete gelandet, voller Testlauf
      grün (**3387 Tests / 0 rot**, String-Parität 25 962 Checks / 0). Die großen
      Brocken aus deiner Liste sind jetzt SPIELBAR:
      **(a) DLC „Goo und Bye" Welle A** — im DLC-Hub freigeschaltet (ab Level 12,
      2500 Münzen, Kauf direkt im Angebots-Sheet): erster begehbarer Laden mit
      komplettem Tag-Loop Nachschub → Regal einräumen → Laden öffnen →
      Kundenstrom → Kassensturz; Onkel Alwin kommt jeden Tag um 9 und kauft
      GENAU eine Möhre, die Kasse piept sein Gebrabbel,
      **(b) DLC „McGooby" Welle A** — Probeschicht frei (kein Kauf-Gate, Welle B
      bringt das): Grill-Station mit taktilem Patty-Wenden (rosa → goldbraun →
      Kohle, „JETZT wenden!"), 10 Parodie-Rezepte (GoobyMac, Gurken-Deluxe mit
      7 Gurken …), Kassensturz mit Trinkgeld-Combo,
      **(c) GvZ-PvP übers Netz** — Gooby verteidigt, ein Freund schickt die
      Zombie-Wellen (Lockstep wie GOB-NOM, Matsch-Budget, Überlebens-Timer);
      das Server-Modul kommt in G6, bis dahin zeigt das Panel freundlich
      „Offline",
      **(d) Trailer 5.1 neu aufgenommen** — 62 s im neuen Look, alle 34 Clips
      frisch (Möhren-Ladebalken-Opening, Kühlschrank 2.0, Marktstand-Kamera,
      GvZ mit sichtbaren Zombies, Outro „38 Minispiele"),
      **(e) 11 Minispiele poliert** (goobySays, memoryMatch, lanternFloat,
      miniGolf, pancakeTower, pipeFlow, ghostHunt inkl. Datei-Entflechtung,
      burgerBuild, deliveryRush, shoppingSurf, toyRacer — Intro-Beats, lesbare
      Banner, Motor-/Fluss-Momente, Reduced-Motion sauber),
      **(f) Kino-Untertitel/Skip in der Safe-Area + Freunde-App im Telefon**
      (echtes Telefon-Layout mit Code-Teilen, Anfragen, Online-Punkten),
      **(g) UI-Wache ausgedehnt auf 34 Screens × 4 Formate** — die Alt-Screens
      bleiben bei 0 Befunden; die neue Abdeckung hat einen dicken Alt-Fisch
      gefangen: das Home-HUD bleibt im Baumodus sichtbar und liegt über dem
      Bau-Dock (97 Befunde, EIN Wurzel-Problem) → wird in G6 gefixt.

- [x] **DLC-Umsetzung „Goo und Bye" + „McGooby"** — Welle A beider Fundamente ist
      mit G5 gelandet und spielbar (s. o.); Welle B (Großmarkt-Fahrt, Preis-Schieber,
      weitere Stationen, Kauf-Gate McGooby) ist der nächste Ausbau-Schritt
- [x] **Minispiel-Qualität, Gruppe 3** — die notierten Kandidaten (starHopper-Bühne,
      trampoline-Gym, carrotGuard-HUD, hideSeek-Wiese, cityDrive-Feedback,
      Ranch-Arena-Überstrahlung) sind seit Welle G2/G3 alle umgesetzt; der Rest-
      Batch läuft in G5
- [x] **GvZ-PvP übers Netz** — Client komplett (Lockstep, Panel, End-Overlay);
      nur das kleine Server-Modul (gvzmp.js nach gobnom-Muster) folgt in G6
- [x] **Trailer-Refresh** — `trailer/GOOBY-5.1-Godot-Trailer.mp4` (62 s, 1080p60),
      alle 34 Clips mit dem neuen UI neu aufgenommen, 12 Abnahme-Stills gesichtet
- [-] **Dynamic Island / Live Activities + iOS-Homescreen-Widget** — braucht native
      Extensions in einer SIGNIERTEN App (Sideload-.ipa kann das nicht registrieren).
      Ehrlich zurückgestellt; Godot-Andockpunkte existieren.

---

_(gerade nichts offen — alle bisherigen Punkte stehen unten unter „Erledigt")_

- [x] **verbessere den Aufbau der Feedback Md**
      Neu gegliedert: 1. Neu von dir (hier reinschreiben), 2. In Arbeit,
      3. Wo das Spiel steht (Testen/Spielstand/Offenes/Trailer auf einen Blick),
      4. Erledigt mit Erklärung. Keine Doppelungen mehr, klare Reihenfolge.
- [x] **verbessere das UI von Gooby**
      Jeder Screen einzeln bewertet und nachgezogen: klare Hierarchie (eine Hauptsache
      pro Bild), einheitliche Kopfzeilen, illustrierte Leerzustaende statt leerer
      Flaechen, animierte Hintergruende mit eigener Farbstimmung, Freundescode als
      Blickfang. Die automatische UI-Pruefung (15 Screens x 4 Geraeteformate) bleibt
      bei 0 Befunden.
- [x] **Baumodus-Kulisse + Haus von aussen sehen**
      Diagnose der alten Kulisse: eine Ringstrasse lag 4 m an der Wand, mit Autos die
      groesser waren als der Raum - das las sich als Kreisverkehr um eine Insel. Neu:
      eigenes Grundstueck mit Zaun und Weg, EINE Strasse hinter Vorgarten und Gehweg,
      Nachbarhaeuser in richtiger Groesse, Baumreihen, Horizont. Im Garten steht jetzt
      dein Haus mit Dach im gewaehlten Stil daneben (die Haustuer sitzt exakt ueber der
      Gartentuer), Raeume haben Deckenbalken bzw. Dachschraegen, hinter Tueren sieht man
      den Nachbarraum, und aus Kuechen-/Badfenster blickt man in den Garten.
- [x] **Post-Processing + echte Gefuehle wie bei Animal Crossing**
      12 klar lesbare Emotionen mit Gesicht, Koerperhaltung, Bewegung, Ton und
      Symbol ueber dem Kopf: Schreck (Ausrufezeichen), Freude, Begeisterung,
      Ueberraschung, Verlegenheit, Trotz, Traurigkeit, Muedigkeit, Neugier, Stolz,
      Angst, Verliebtheit (Herz). Sie kommen von selbst - Schreck beim Donner,
      Verliebtheit beim Lieblingsessen, Stolz nach einem Rekord - und die starken
      bekommen einen Kamera-Zoom mit Zeitlupe. Dazu ein Effekt-Stapel: Vignette,
      Tageszeit-Toenung, Bloom, Tiefenschaerfe, Farbstoss bei starken Gefuehlen -
      in den Einstellungen abschaltbar, Kosten nur +1 Draw-Call.

---

## 2. In Arbeit

### Runde W18 — LÄUFT (Stand 2. August)

Welle G7 „SPIELGEFÜHL" ist komplett gelandet (alle Pakete unten abgehakt,
dein 1.8.-Feedback damit umgesetzt). W18 macht weiter mit den Spieler-
Playtests, den Planner-Ideen und den restlichen G6-Paketen:

- [~] **Welle H: PLAYTEST ×10** — läuft: die Spieler-Agents haben ihre
      Bereiche KOMPLETT durchgespielt — Haus (Füttern/Bau/Schlaf, flow_schlaf
      29/29 grün), UI-Loops (10 Flows parallel: Telefon, Tagesquests-Blatt,
      Garderobe-Kauf, Affen-Chaostest … — 9/10 grün, das flow_schlaf-Rot des
      Parallel-Laufs ist als Altlast an die Home-Welle übergeben),
      Stadt/Läden/Reise (flow_stadt 44/44 grün inkl. echter Urlaubs-Buchung),
      NEU alle 38 MINISPIELE (PT-MG-A: Spiele 1–19; PT-MG-B: Spiele 20–38
      plus die Ranch-WETTBEWERBE komplett bis zur Siegerehrung) und NEU die
      META-FEATURES (PT-META: DLC-Hub, Telefon-Apps, Radio, Garderobe,
      Tagesquests, Erfolge — alle sechs end-zu-end grün mit Save-Beweisen);
      Reports unter `docs/playtests/`. Dabei ECHTE Bugs gefunden und sofort
      gefixt (unten abgehakt). Als Nächstes: DLC-Läden, Progression,
      Onboarding.
- [ ] **Welle I: 30+ Ideen-Planner** — 10 Planner parallel, jeder liefert
      10+ priorisierte Ideen für seinen Bereich (≈100+ Ideen), konsolidiert
      zur Roadmap
- [ ] **Wellen J+: Umsetzung** — Playtest-Bugs + beste Planner-Ideen + die
      restlichen G6-Pakete (DLC-Ladebildschirme); schon raus: Ball-Wurf,
      Warn-Sweep, CI-Release-Notes, DLC Welle B BEIDER Läden, McGooby-Bühne,
      Alwin-NPC — und jetzt auch Audio-Feel (Dialog-Ducking) und der
      Doku-Refresh (alles direkt unten abgehakt)

**Schon in W18 gelandet** (vorgezogene Warteschlangen-Pakete + Playtest-Funde):

- [x] **Audio-Feel: Dialog-Ducking + Laden-Ambience** — solange eine
      Sprechblase spricht, treten Musik (−6 dB) und Laden-Gemurmel (−5 dB)
      mit weichen Flanken zurück und kommen danach weich wieder;
      Ambience-Loops blenden 0,9 s ein statt hart zu schneiden, lange Betten
      starten an zufälliger Stelle (klingt nie zweimal gleich) und das
      REHWEI/Baumarkt/Kino/Flughafen-Gemurmel skaliert mit der ECHTEN
      Besucherschar; beide Regeln stehen verbindlich in AUDIO-GRAMMATIK.md,
      8 neue Dauer-Wachen.
- [x] **Szenenwechsel-Audit: kein Weg am Wipe vorbei** — Audit über alle
      782 Produktions-Dateien bestätigt: JEDE Reise läuft über den
      Veil-/Tür-Wipe des Routers, einzige sanktionierte Ausnahme ist der
      Soft-Restart-Reboot (jetzt dokumentiert); eine neue Rückbau-Wache
      lässt keinen Direkt-Szenenwechsel mehr durch (Mutations-Probe:
      die Wache schlägt sofort an).
- [x] **Squish + Sound + Haptik KOMPLETT (Audio-Grammatik)** — alle ~120
      restlichen nackten Knöpfe in 54 Screens drücken sich jetzt (Squish +
      Tap), gesperrte Knöpfe sagen zentral „Nö" (Fehlerton + Warn-Haptik +
      Schütteln statt still zu verpuffen), und jeder Knopf spielt GENAU
      EINEN Klang nach der festen Grammatik (Zurück/Auswahl/Bestätigen/
      Kauf/Schalter …); eine repo-weite Quelltext-Wache verhindert neue
      nackte Buttons.
- [x] **P56-Typo: Minispiel-HUDs im EINEN Rahmen** (Playtest-Fund F4) —
      Timer/Unterzeile/Hinweis der 7 abweichenden Spiele (basketBounce,
      burgerBuild, gardenRush, veggieChop, pancakeTower, pipeFlow,
      ranchParcours) ziehen Typografie UND Milchglas-Plates jetzt aus der
      zentralen Rahmen-Fabrik; dabei den „bildschirmhohe Riesen-Plate"-
      Layoutfehler an der Wurzel gefixt (Godots Umbruch-Cache klemmte
      Hinweis-Boxen auf über 1300 px Höhe).
- [x] **GvZ-PvP-Server gehärtet** — Lobby-Leck gefixt (wer nach dem
      Annehmen offline ging, sperrte BEIDE Spieler dauerhaft), Hash-Flut
      gedeckelt, Aktions-Nachrichten auf strikte Form geprüft (kein
      Schmuggel-Seitenkanal), Ergebnis-Klemme + Einladungs-Hygiene;
      6 neue Wachen, Server-Suite jetzt 157/157 — dazu ein neuer MP-Smoke,
      der den ECHTEN Server bootet und den 2-Client-Handshake abfährt.
- [x] **Playtest-Fund F3 „Invalid polygon data" an der Wurzel gefixt** —
      der sporadische Zeichen-Fehler in Wipe-Momenten kam vom Sweep der
      Lade-Pill (kollabierende Kappen erzeugten Doppelpunkte, die die
      Triangulation je nach Rundung ablehnte); die Pill-Punkte werden jetzt
      dedupliziert und der Boot-Balken teilt dasselbe Rezept; 6
      instrumentierte Playtest-Lanes: vorher 2 Treffer, nachher 0.
- [x] **Doku-Refresh** — STATUS.md komplett neu auf den ehrlichen
      Post-W18-Stand (78/79 Web-Features, Lücken ehrlich kuratiert, tote
      Links ersetzt) + EVAL-VOLLSTAENDIGKEIT.md auf Revision W18 („Web-
      paritätisch, Politur-/Playtest-Phase"); IOS-BUILD.md/UPDATES.md gegen
      den echten CI-Workflow abgeglichen (Größenwacht, UNVERIFIED-Artefakt,
      Concurrency, Schedule-Vorbehalte).
- [x] **DLC „Goo und Bye" Welle B: Großmarkt + eigene Preise** — der Laden
      lernt Einkaufen und Preise machen: Bestellzettel mit ±-Steppern und
      Staffelrabatt ab 10 Stück einer Ware (der Kauf bucht ATOMAR — bei
      Pleite passiert NICHTS), dazu ein Preis-Schieber je Warengruppe
      (±30 % um den Richtwert, Live-Beispiel „5 → 4"), der WIRKLICH an der
      Kasse piept; 7 neue Dauer-Wachen, Subset 26/26 grün.
- [x] **DLC „McGooby" Welle B: Kauf-Gate + Belegen-Station + Bühne** — das
      Eckgrundstück wird jetzt WIRKLICH gekauft (3000 Münzen ab Level 14,
      Angebots-Sheet über „Grundstück ansehen" im DLC-Hub), und die Schicht
      hat ihre zweite Station: nach dem Grillen wird der Burger Lage für
      Lage BELEGT (Fehlgriffe kosten Punkte), beide Stationen laufen über
      die neue Schicht-Bühne; 18 Wachen inkl. Zwei-Stationen-Durchspiel.
      (Ein Index-Race der Parallel-Lanes hatte 12 Dateien des Pakets
      verschluckt — per Nachzügler-Commit vollständig nachgeliefert.)
- [x] **Onkel Alwin ist im Laden SICHTBAR** (Gag-Vertrag §6.3) — er kommt
      um 9, hat eine 5-Schritte-Tagesroutine mit tickendem Uhrzeit-Zettel
      („9:02 · poliert im Vorbeigehen ein Regal — blitzblank!"), poliert
      WIRKLICH das Tages-Regal (es hüpft mit Glanz-Ton) und lässt sich
      antippen: 12 Gags rotieren wiederholungsfrei durch den Tag, mit
      Gebrabbel-Piep und Freuden-Hopser; Subset 22/22 grün.
- [x] **CITY-2 „Orte lebendig 3" gelandet** — der Flughafen hat Reisende
      (einer checkt WIRKLICH am Schalter ein), im Zentrum steht das NEUE
      Kino „GOOBYWOOD" (Tagesfilm-Programm, Ticket 15 Münzen, flackernde
      Leinwand) und der GOOBERANDO-Fahrer ist lebendig (Dienst-Käppi,
      Papiertüte, Fahrer-Sprüche); Details oben beim P55-Ausbau in der
      G7-Liste.
- [x] **Playtest-Funde Minispiele gefixt** (PT-MG-A/B, alle 38 Spiele +
      Ranch-Wettbewerbe) — die Verfolger-KAMERA in deliveryRush/cityDrive
      steckte bei Wandkontakt sekundenlang IN der Hausgeometrie (Vollbild
      dunkel, nur HUD — jetzt an der Wand abgefangen), der goalieGooby-
      Trefferflash war auf dem hellen Rasen unlesbar (dunkleres Band +
      Kontur), Gangart-Wische auf der Ranch wurden als zu langsam verworfen
      (das Pferd blieb im Stand — Wisch-Fenster korrigiert, es galoppiert),
      und das „Post/Blumen"-Label in snailMail war auf den Baumkronen
      unlesbar; Reports: `docs/playtests/PT-minigames-a.md` +
      `PT-minigames-b.md`.
- [x] **Playtest-Funde Meta-Features gefixt** (PT-META) — drei echte
      Spiel-Bugs: das Settings-Overlay blieb nach Reisebeginn als
      unsichtbarer Deckel über der DLC-Bibliothek liegen (verschluckte alle
      Taps), nach einem Radio-Senderwechsel war der Schließen-Knopf
      unauffindbar, und geschlossene DLC-Detail-Sheets blieben unsichtbar
      im Baum zurück (Leck pro Besuch); Report: `docs/playtests/PT-meta.md`,
      Voll-Lauf danach 3511 Tests / 0 rot.
- [x] **Spielstand-Import gegen Müll gehärtet (Fuzz + Backup-Beweis)** —
      über 130 mutierte/kaputte Eingaben (Transfer-Texte, echte
      GOOBY5-Codes, bplist-Zufallsbytes, eine 8-MiB-Riesendatei) crashen
      NIE und korrumpieren NIE still einen Spielstand; dazu der bewiesene
      REIHENFOLGE-Beweis, dass das Backup des ALTEN Standes schon auf
      Platte liegt, BEVOR der Import schreibt; SAVE-TRANSFER.md auf den
      Ist-Stand gebracht.
- [x] **Performance-Governor nachgestellt + Messlauf** — ProMotion-Geräte
      mit 120-Hz-Deckel fallen nicht mehr grundlos auf „Mittel" (neue
      Spitzenstufe hoch120, erste Bremsstufe ist nur noch 120→60), die
      FPS-Notbremse misst jetzt ECHTE Frame-Zeit (die Zeitlupe hatte reale
      Einbrüche maskiert), 6-GB-Geräte werden korrekt eingestuft und der
      Schatten-Atlas ist gedeckelt; Messlauf: Stadt 256 Draw-Calls
      (Budget 400), Boot ~2,16 s.
- [x] **iPhone-Build (.ipa) grün + bewacht** — der ios-ipa-Lauf baut grün
      durch; NEU wacht `verify_ipa.py` über die fertige .ipa (Größen-
      Baseline 188,9 MB aus dem grünen Lauf), der CI-Gate-Wächter prüft
      die Job-Bedingung semantisch statt am Wortlaut, und das Root-README
      hat eine konkrete Download-Anleitung („Spielen / Testen (iPhone)").
- [x] **Ball-Wurf & Apport auf Web-Parität** (G6-Paket) — Gooby FLITZT jetzt
      mit dem alten Web-Tempo (2,2 m/s) zum Ball statt zu schlendern, schaut
      dem geworfenen Ball live hinterher, macht einen Antritts-Hopser und
      trabt nach der Freude auf seinen Platz zurück; Skript-Läufe (Tür-Reise/
      Fütter-Anmarsch) werden vom Apport nie gekapert. Ein eigener Spieler-
      Flow wirft den Ball per echtem Flick und beweist, dass Zähler, Spaß und
      Gewicht wirklich gebucht werden.
- [x] **Stadt-Playtest-Blocker: Reise-Cutscene** — der Stadt-Spieler-Agent
      fand einen ECHTEN Blocker: nach „Gute Reise!" hing die Abflug-Cutscene
      ewig über dem Flughafen — kein Urlaub, und die 190 G waren weg (das
      Schließen des Boarding-Pass-Sheets riss den Cutscene-Abschluss mit ins
      Grab). Gefixt (der Abschluss überlebt das Sheet-Aufräumen) + Bug-
      Wächter-Test; Playtest-Lauf 3 danach 44/44 grün.
- [x] **CI-Release-Notes-Automatik** — der Release-Body war bisher nur ein
      Hand-Gerüst („Was ist neu?"), das nie gepflegt wurde; jetzt werden die
      Notes automatisch aus den Commits seit dem letzten Release-Tag
      generiert (verlinkte Kurz-Hashes, „… und N weitere" mit Vergleichs-
      Link, bricht lieber sauber ab als Müll zu veröffentlichen).
- [x] **Warn-Sweep** (G6-Paket) — 5 echte Headless-Fehler aus Suite-/CI-Logs
      auf 0 gebracht (u. a. ein Godot-4.4-Fallstrick, durch den ein Testpfad
      still nie betreten wurde, und ein Settings-Flake).
- [x] **P50-Nacharbeiten (Audit-Rest)** — das Bau-Dock startet in Ruhelage
      und die Kamera-Leiste weicht dem wachsenden Dock aus, die Onboarding-
      Tour-Karte duckt sich MIT dem HUD, die Minispiel-Ergebniskarte bleibt
      über der Home-Indicator-Kante → das UI-Audit ist damit KOMPLETT GRÜN
      (204 Screens, 0 Befunde — vorher 23).
- [x] **P56-Ausbau: Brettspiele enden im Rahmen** — Schach und Schiffe
      versenken hatten am Partie-Ende noch eigene Mini-Panels/Toasts statt
      des Ein-Spiel-Gefühls; jetzt teilen beide EIN Partie-Ende-Overlay im
      Minigame-Rahmen-Look (dieselbe Abdunkelung wie Pause/Ergebnis, Creme-
      Karte, Gooby-Sticker jubelt bei Sieg und steht bei „Bewegung
      reduziert", EINE Knopf-Reihe mit der primären Aktion zuerst, Sieg-/
      Niederlage-Klang des Rahmens). Brettspiel-gerecht: ein Tipp auf die
      Abdunkelung legt die Karte beiseite, damit man die Schlussstellung
      nachbetrachten kann; Revanche/Neue Partie/Verlassen laufen über die
      bewährten Wege (Revanche sperrt, wenn der Gegner weg ist). Intro und
      Pause bleiben bewusst Szenen-Sache — Brettspiele sind rundenbasiert,
      die Auswahl-/Setup-Phase IST der Auftakt. Dauer-Wächter-Test plus
      Sichtungs-Capture im Leitformat dazu.

---

### Welle G7 „SPIELGEFÜHL" — FERTIG (Runde W17, gelandet 2. August)

_Transparenz-Hinweis von damals bleibt stehen: die am 31.7. gestartete Welle G6
ist einem VM-Neustart zum Opfer gefallen, bevor sie integriert/committet war —
kein Stand verloren gegangen außer der unfertigen Subagent-Arbeit; die
G6-Pakete wurden neu einsortiert (zwei davon sind oben schon gelandet)._

- [x] **P50 HUD-Dynamik** — dein Wunsch wörtlich: beim Baumenü GLEITEN die
      HUD-Knöpfe animiert weg (und kommen animiert zurück); bei offenen
      Blättern/Modals (z. B. Tagesquests) weicht/dimmt das HUD statt
      durchzuscheinen; HUD-Kachel-Labels werden nie mehr abgeschnitten
      („IGohbi/Garder/Gestalt" → passende Beschriftung), „Wo ist mein
      Gooby?"-Chip inklusive.
      → GELANDET: gestaffeltes Weggleiten (180 ms, bei „Bewegung reduziert"
      sofort), das HUD weicht bei JEDEM offenen Blatt (robust auch bei
      mehreren gleichzeitig), Labels werden per Font-Messung eingepasst
      statt abgeschnitten; dazu die W18-Nacharbeiten oben (Bau-Dock-
      Ruhelage, Tour-Karte, Ergebniskarte).
- [x] **P51 Sprechblasen + Text-Fit** — „Ohh, wird das sch" ade: Blasen
      wachsen/wickeln sauber, nie mehr mitten im Wort enden; Text-Fit-Sweep.
      → GELANDET: die Blase misst ihren Text, wächst bis zur Wohlfühl-
      Maxbreite, bricht nur an WORT-Grenzen und reserviert die Endgröße vor
      dem Typewriter (kein Nachruckeln); Dauer-Wache mit den längsten
      DE/EN-Sprüchen.
- [x] **P52 IGohbie-Telefon-Rework** — kaputtes Dunkel-Icon, unklare Symbole,
      App-Labels, Öffnen-Animation, Wisch-zum-Schließen.
      → GELANDET: das Dunkel-Icon war ein SVG-Füllfehler (gefixt), alle
      App-Kacheln haben Icon + nie abgeschnittenes Label, Öffnen-Pop +
      App-Slide, Wischen links = zurück ins Grid, runter = Telefon zu; die
      Statuszeile schluckt keine Wisch-Gesten mehr (Playtest-Fund).
- [x] **P53 Modal/Sheet-System + Swipe** — EIN einheitliches Blatt-Verhalten
      überall: Slide-in/out, Hintergrund-Dim, runterwischen = schließen
      (inkl. Radio-Like-Offscreen-Fix).
      → GELANDET: alle Blätter teilen EIN Verhalten — Slide-up + Dim (das
      Taps dahinter blockiert), Runterwischen am Griff zieht das Blatt echt
      mit (Schwelle: schließen oder zurückschnappen), Dim-Tap schließt; der
      Radio-Like-Offscreen-Altbefund ist an der Wurzel gefixt, und der
      Playtest-Fund „Tagesquests-Blatt kommt beim zweiten Öffnen leer hoch"
      gleich mit.
- [x] **P54 Garderobe + Gestalten poliert** — abgeschnittene Kategorien
      („Briefkasten"), Scroll-Hinweise, Karten-Layout, Kauf-Feedback.
      → GELANDET: „Briefkasten" wird nie mehr hart abgeschnitten (Scroll-
      Fade-Kante + Endpolster), Zeilen ≥ 44 pt, Kategorie-Chips swipebar,
      Kauf mit Squish + Konfetti-Tick — und Kopfschütteln + Fehlerton,
      wenn's zu teuer ist.
- [x] **P55 Läden lebendig, Teil 1** — REHWEI + IKEA werden ECHTE Orte:
      animierte Kunden-Goobys, Kassen-NPC, Ambiente-Sound, Deko.
      → GELANDET: REHWEI und der Baumarkt sind jetzt ORTE — Besucher-Goobys
      (tages-deterministisch, mit Farb-/Hut-Varianten) schlendern, gucken in
      Regale und haben Emoji-Momente, ein Kassen-NPC tippt/winkt/piept, dazu
      Türglöckchen + Markt-Gemurmel; das IKEA-Schaufenster lebt (wandelnde
      Silhouetten). Weitere Orte anschließen kostet ~20 Zeilen Konfiguration.
      → SHOPS-1-Ausbau: in REHWEI geht ein Ambient-Kunde jetzt WIRKLICH zur
      Kasse und bezahlt (Frau Rehwald piept + winkt, einmal pro Runde); der
      IKEA-Katalog klingt nach Möbelhaus (Tür-Pling + leises Gemurmel) und
      bringt rotierende Laden-Durchsagen über der Vitrine („Bitte nicht auf
      den Ausstellungsbetten einschlafen. Danke!“, DE/EN).
      → CITY-2-Ausbau „Orte lebendig 3": der Flughafen hat jetzt Reisende
      (einer checkt am Schalter ein — der Schalter-Gooby piept), die Stadt
      hat ein NEUES Kino „GOOBYWOOD" im Zentrum (Frau Lumi Leinwand an der
      Popcorn-Kasse, Tagesfilm-Programm mit Parodie-Titeln wie „Möhrenkrieg:
      Eine neue Knolle", Ticket 15 Münzen → die Leinwand flackert und Gooby
      bekommt Spaß, Ambient-Kinogänger inklusive Popcorn-Käufer), und der
      GOOBERANDO-Fahrer ist lebendig (orangenes Dienst-Käppi, Papiertüte,
      Winken/Freuen, rotierende Fahrer-Sprüche — „Erstmal Goobyn!").
- [x] **P56 Ein-Spiel-Gefühl** — einheitlicher Minispiel-Rahmen (Intro/
      Outro/Pause im Gooby-Look überall) + einheitliche Szenen-Übergänge,
      damit sich nichts mehr wie ein Fremd-Spiel anfühlt.
      → GELANDET: alle 38 Spiele laufen im selben Gooby-Rahmen — rein/raus
      immer über den Haus-Wipe, einheitliches Pregame (Creme-Karte, Cover,
      Mini-Gooby), gleicher Countdown, Pause + Ergebnis in EINEM Look mit
      gleicher Knopf-Reihenfolge und gleicher Münz-/XP-Zähl-Animation; eine
      Registry-Wache stellt sicher, dass kein Spiel den Rahmen umgeht.
- [x] **P57 iPhone-17-Pro-Max-Leitformat (2868×1320 quer)** — UI-Wache +
      Konformitätstests aufs neue Leitformat, plus die 17 bekannten
      Audit-Restbefunde (RMP-Tippflächen, Onboarding-Knöpfe offscreen).
      → GELANDET: 2868×1320 quer ist das Leit-Format des UI-Audits (plus
      Hochformat, jetzt 34 Screens × 6 Formate), die 17 Altbefunde sind
      gefixt (RMP-Tippflächen auf ≥ 44 pt, Onboarding-Knöpfe zurück im
      Bild); nach den P50-Nacharbeiten steht das Audit auf 204 Screens /
      0 Befunde.
- [x] **P38R GvZ-PvP-Server** — Relaunch des verlorenen Pakets (gvzmp.js
      nach gobnom-Muster inkl. Node-Tests).
      → GELANDET: Einladung über die Freundesliste, deterministischer
      Start-Handshake (Server-Seed + Seitenwahl), Desync-Wächter pro Tick,
      Wiedereinstiegs-Frist bei Verbindungsabbruch, doppelt-sichere
      Belohnung; 151 Server-Tests grün — der seit G5 fertige Client läuft
      ohne Änderung, das „Offline"-Panel ist Geschichte.
- [x] **P58 Playtest-Harness + Pionier-Spieler** — baut das „Subagent
      spielt das Spiel"-Werkzeug (eigene Instanz, echte Eingaben,
      Screenshot-Serie, Hänger-/Fehler-Detektor) und spielt den ersten
      kompletten Durchlauf im Leitformat → Bug-Report Nr. 1.
      → GELANDET: die Harness bootet das ECHTE Spiel im Leitformat (eigenes
      Spielstand-Verzeichnis pro Lauf, 10 parallel möglich), tippt/wischt
      wie ein Spieler, macht nach jedem Schritt einen Screenshot und
      schreibt Markdown-Bug-Reports; der Pionier-Lauf fand sofort einen
      echten Blocker (Arcade-Zurück startete eine frische Runde samt
      0-Punkte-Belohnungs-Farm) — an der Wurzel im Router gefixt.
- [x] **P59 Playtest-Ausbau „Subagents spielen"** — `run_playtest.sh alle`:
      JEDER Flow ist ein eigener Spieler-Agent, alle 10 laufen PARALLEL (je
      eigenes user:// + Display, Übersichts-Tabelle am Ende); 4 neue Spieler
      (Telefon, Tagesquests-Blatt, Garderobe-Kauf, Affen-Chaostest) + neue
      Harness-Fähigkeiten (UI-Deckel-Wache bei 3D-Taps, Affen-Aktion). Dabei
      2 ECHTE Bugs gefunden UND gefixt: das Tagesquests-Blatt kam beim
      zweiten Öffnen als leerer Stummel hoch (PanelSheet zerstörte
      wiederverwendete Inhalte), und die Telefon-Statuszeile schluckte den
      Runterwisch-zum-Schließen. Report: `docs/playtests/PT-ui-loops.md`

_(Die Warteschlange „Danach sofort" von damals ist in die W18-Liste oben
gewandert — Welle H läuft bereits, Ball-Wurf und Warn-Sweep sind gelandet.)_

---

## 3. Wo das Spiel gerade steht

| | |
|---|---|
| **Qualität (Stand 2.8., W18)** | Hauptsuite **3529 Tests / 0 rot** (letzter sauberer Voll-Lauf; der jüngste 3530er-Lauf hatte nur ein bekanntes fremdes In-Flight-Rot), Server-Tests **157 / 0**, UI-Audit **204 Screens / 0 Befunde** — Leitformat iPhone 17 Pro Max quer (2868×1320) |
| **Playtests** | Subagents SPIELEN das Spiel wirklich (eigene Instanz, echte Taps/Wische, Screenshots): Reports unter `docs/playtests/` (PT-home, PT-ui-loops, PT-stadt, PT-minigames-a/b, PT-meta), Start per `tools/ci/run_playtest.sh alle` |
| **Testen** | GitHub → Actions → Lauf „GOOBY Godot" → Artefakt `GOOBY-godot-unsigned-ipa` herunterladen, mit AltStore/Sideloadly installieren. Anleitung: `docs/godot-rewrite/IOS-BUILD.md` — Release-Notes werden jetzt automatisch aus den Commits generiert |
| **Spielstand von früher** | Einstellungen → Spielstand → „Alten Spielstand übertragen"; Anleitung: `docs/godot-rewrite/SAVE-TRANSFER.md` |
| **Was noch offen ist** | `docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md` (ehrliche Feature-Matrix) |
| **Trailer** | `trailer/GOOBY-5.1-Godot-Trailer.mp4` (neu, W17-Look) — Vorgänger 5.0 bleibt daneben liegen |

---

## 4. Erledigt

Chronologisch nach Meldung; die Erklärung steht jeweils darunter.

- [x] **Runde W15 (31. Juli): Updates über DIESES Repo + 9 weitere Pakete**
      **App-Updates laufen jetzt komplett über dieses Repo** (dein Wunsch): Pack-Releases
      per Tag `packs-v*` (rollender `updates`-Release), der Client lädt über die
      GitHub-API mit Zugangsschlüssel (Einstellungen → Updates → „GitHub-Token";
      da das Repo privat ist, brauchen Freunde einen Lese-Token von dir — Anleitung
      in docs/UPDATES.md §6a), und der ipa-Release-Job pflegt latest_native jetzt
      automatisch. KEINE Extra-Repo-Aktion mehr nötig!
      Außerdem: **Gooby im Urlaub besuchen** (Strand/Berge/Stadt-Szenen + Raumstation,
      Streicheln/Foto/Muschel-Sammeln/Souvenir-Spot, 24 neue Urlaubs-Sprüche);
      **Minispiel-Gruppe 2 poliert** (purblePlace-UI-Redesign, ranchHerde-Treiben mit
      Einfluss-Ring, rocketRescue-Kamera, gardenRush-Kulisse, danceParty-Publikum,
      AC-Level-Menüs mit Sterne-Stempeln); **4 neue Garten-Crops** (Radieschen, Mais
      mit Wind-Empfindlichkeit, Aubergine, Kürbis) → das Gemüse-Sammelset ist jetzt
      8/8 erspielbar und ALLE 4 Sammlungen sind komplettierbar; **GOB-NOM-Coop übers
      Netz** (2 Geräte, Lockstep mit Desync-Wächter + Rejoin — zugleich die Vorlage
      für GvZ-PvP); **Kamera fährt jetzt wirklich DURCH die Tür** beim Raumwechsel
      (additiv geladener Zielraum, Gooby läuft voraus; Fallback auf den Wisch bei
      Reduced-Motion/Low-End); **Wochenmarkt-Eigenstand** (Stand bestücken, Preise
      per Slider, deterministische Verkaufs-Sim mit Tagestrend „Heute lieben alle
      Kürbisse!", Abrechnungs-Karte) + 3 neue Craft-Rezepte mit 3D-Vorschau
      (Vogelhäuschen, Kräuterkasten der wöchentlich Markt-Ware liefert, drehendes
      Windrad); **danceParty-Timing-Kalibrierung** (Audio-Latenz-Ausgleich + 8-Beat-
      Antipp-Kalibrierung); **HDR-Glow-Auto-Downgrade** auf schwachen Geräten;
      **GOB-NOM-Level-EDITOR** im Godot-Editor (Level visuell bauen, Solver-Check);
      **neue Gooby-Clips phone_up/phone_tap** (Selfie-Emote echt) + Streichel-Übermut-
      Gag („Paus-e-e!"); **30 von 38 Minispielen sind jetzt bit-genau gegen die alte
      Web-Version zertifiziert** (vorher 12). Qualität: 3.010 Haupt-Tests, 24.815
      UI-Checks, 140 Server-Tests — alles grün, Preflight grün.

- [x] **Runde W14 (31. Juli): dein komplettes Feedback vom Morgen — 12 Arbeitspakete**
      **UI-Full-Rework:** Buttons/Karten exakt an der alten Web-Version geeicht (Press-Squish
      0.94 mit Feder-Overshoot, wärmere dicke Outlines), NEUE animierte runde ACNH-Sprechblasen
      (Pop-In-Wackler, Atmen, Buchstaben-Typewriter, Sprech-Schwanz) überall, haptisches
      Feedback auf JEDEM Knopf (abschaltbar unter Einstellungen → Haptik), und Notifications
      können Goobys Bubble strukturell nie mehr überlappen (Anker-Zonen + Ausweich-Logik, per
      Test bewiesen). Alle Screens reworked: Settings (6 Icon-Gruppen), Arcade, Profil (inkl.
      Reisepass-Hochkant-Fix — lief 40 % übers Canvas!), Album (Off-Screen-Sticker gefixt),
      HUD (Daumen-Zeile unten/Cockpit-Spalte quer nach Design-Doc), IKEA (Preis-Pillen statt
      abgeschnittener Preise), Radio/Codes/News/Pause/Galerie im Einheits-Look.
      **Ladebildschirm:** Beim App-Start jetzt ein generiertes Vollbild-Coverartwork
      (Gooby + Garten/Stadt/Ranch-Panorama) mit ECHTEM Möhren-Ladebalken (an die realen
      Boot-Phasen gekoppelt) + 10 knuffige Sprüche, dann Kreis-Wipe-Öffnung auf Gooby ins
      Spiel; der Szenenwechsel-Veil wurde mitpoliert (hüpfender Gooby, Fortschritts-Punkte).
      **Kühlschrank 2.0:** Regal-Grid mit echten 3D-Vorschauen, Kategorien-Chips,
      Vorrats-Badges, Stat-Pillen — und eine richtige Fütter-Sequenz: die Speise schwebt zu
      Gooby, er mampft in 3 Bissen mit Krümeln und Sound, Lieblingsessen macht verliebt.
      **Gooby lebendiger:** 120+ neue deutsche Text-Lines (Tageszeiten, Wetter, Reaktionen
      auf alle neuen Features, Selbstgespräche), NEU: Antwort-Chips — du kannst Gooby
      antworten und er reagiert (12 Mini-Dialoge), 3 Gebrabbel-Melodien (fragend/aufgeregt/
      schläfrig).
      **Decke weg beim Umschauen:** Kamera von oben = Decke/Balken/Dachschräge faden sanft
      aus (Decken-Lampen im Baumodus als 30-%-Geister). **Stadt-Feinschliff:** Top-5-Diagnose
      gefixt (Pastell-Fassaden-Varianz, Laternen-Lichtkegel nachts, begrünte Vorplätze,
      weiche Distrikt-Übergänge, möblierter Wochenmarkt).
      **Mehrspieler-Settings:** Server + Port + Secret jetzt ganz normal in den Einstellungen
      (mit „Verbindung testen"-Knopf); Secret wird serverseitig geprüft (GOOBY_JOIN_SECRET).
      **DEV-Tools-Werkzeugkasten:** 6 Tabs — Spielstand (Coins/XP/Sticker/Fixtures), Zeit
      (Uhr-Offset + „Nächster Tag"), Events (jedes sofort auslösen + Wetter-Override),
      Gegenstände (durchsuchbare Item-Vergabe), Netz (Config-Dump, Log, Outbox), Perf-Overlay.
      **DLC-Hub:** Einstellungen → DLC mit großen Cover-Karten (Ranch = verfügbar/installiert,
      „Goo und Bye" + „McGooby" = BALD mit generierten Coverarts + spoilerarmen Teasern);
      beide neuen Riesen-DLCs sind fertig durchdesignt (je ~600-700 Zeilen Design-Doc mit
      20-Perspektiven-Ideensammlung, Kern-Loops, Mitarbeiter-Gags, Multiplayer, Technik-Plan).
      **Minispiel-Qualitätspass:** Alle 38 Spiele bewertet (5 Achsen); die 6 schwächsten tief
      poliert — dabei ECHTEN Bug gefunden: die 3 Ranch-Wettkampf-Spiele hatten unsichtbares
      HUD! Dazu GvZ-Intro + Mäher-Fix, starHopper-Forgiveness, runner-Licht, 7 Quick-Wins
      (danceParty-Bahnen sichtbar, deliveryRush-Leuchtkugel, u. a.).
      Qualität: Haupt-Runner 2872 Tests grün, UI-Runner 24027 Checks grün, Preflight grün.

- [x] **Runde W13, Welle A+B (30./31. Juli): Backlog-Großputz — 20 Arbeitspakete**
      Jeder Push baut jetzt automatisch eine frische unsignierte .ipa (Artefakt
      `GOOBY-godot-unsigned-ipa`; Läufe 30592927997 + 30597075885 grün). NEU/GEFIXT:
      Ball werfen & apportieren ist zurück (Web-Physik 1:1, Wohnzimmer); die 4
      Sammlungssets (Fische/Gemüse/Sehenswürdigkeiten/Leckereien) sind wieder im Album
      sichtbar UND werden von Angeln/Ernte/Lieferungen/Füttern echt befüllt; sichtbarer
      Regen/Schnee/Gewitter jetzt auch in Haus (durchs Fenster), Garten und Stadt; die
      Stadt liest echtes Wetter statt Dauer-Sonne; GvZ-Sticker sind endlich erspielbar
      (L5/L10/L15-Meilensteine, 2 neue Sticker „Zaunheld" + „Nutella-Kommandant") und
      der Geheimcode GOLDIGOLD schaltet Goldi frei; „Wo ist mein Gooby?" springt zu ihm
      und er erzählt, was er gerade tut; der Auge-Knopf markiert alle anklickbaren
      Objekte (Rim-Glow + Pfeile); Radio: Bordmusik ohne Kauf nur pausierbar, Sender/Skip
      erst nach IKEA-Kauf, dazu „Was läuft?"-Ticker; Ranch ab Level 15 kaufbar + 4
      Ranch-Random-Events (ausgebüxtes Pferd, Heudieb, Hufschmied, Karottenregen); 9 neue
      Speisen inkl. Nutella + die Küchen-Nougatschleuse aus dem Web ist zurück;
      Post/Mail-Multiplayer komplett (Briefe + Fotos + Geschenke an Freunde, Quota,
      offline-Outbox); GOOBERANDO mit 3 Restaurants und echtem Fahrer auf der Karte;
      Guber kostet 30 (Surge-Gag 18–20 Uhr: 45); City Drive ist jetzt eine echte
      Arcade-Runde mit Score/Strikes, Autos haben Stats, die im Pregame stehen;
      Reisepass 2.0 (Flip-Karte, eigenes Passfoto aus der Galerie, Stempelseite,
      MRZ-Gag) + Abflugtafel im Split-Flap-Look + Boarding-Pass; Raumstation GOOB-1
      als betretbarer Ort (2 Arcade-Terminals, Low-Gravity-Hopser); Weltengooby-Titel
      bei 9/9 Zielen + 48-h-Erholungs-Boost + GOOBY-FREE-Shop am Flughafen; Besucher
      schlafen abends auf der Couch; Coop-Fahrt mit synchronem Radio; Geschichten-Stunde
      mit 6 Büchern/14 neuen Geschichten + Abnutzung; Schüttel-Secret (3 Stufen bis zum
      Ragdoll-Flug + Geheim-Sticker „Ganz blümerant"); Decken-Bau-Layer + spannbare
      Girlanden (Wimpel/Lichterkette/Pompons); Sticker-Rarity-Effekte (Gold glitzert,
      Konfetti+Jingle); Galaxie-Fellfarbe mit Sternen-Shader; Klopapier-Mumie-Event;
      Buchstaben-Typewriter in Dialogen; 5 Kauf-Bugs gefixt (Geld weg ohne Leistung —
      Lambda-Capture-Falle); alte Debug-Instrumentierung entfernt; STATUS.md/Doku auf
      den ehrlichen Ist-Stand gebracht.

- [x] **Stelle immer sicher das die Github Actions runs erfolgreich sind.**
      ALLE DREI JOBS GRUEN (Lauf 30285924723: lint, linux-checks, ios-ipa). Die .ipa liegt als
      Artefakt bereit (188 MB, gewachsen durch Ranch/Musik/Modelle). Damit das so bleibt:
      tools/ci/preflight.sh faehrt lokal exakt dieselben Pruefungen vor jedem Push, und der
      iOS-Job baut jetzt auch dann, wenn Tests rot sind (dann mit Hinweis im Artefaktnamen) - du
      bekommst immer eine .ipa.

- [x] **Erstelle mal richtige Skyboxen selber**
      prozeduraler Himmel-Shader mit 7 Stimmungen (klarer Morgen, Mittag, goldene Stunde,
      Abendrot, Nacht mit Sternen, bedeckt, Gewitter), blendet weich zwischen Tageszeit und
      Wetter.

- [x] **Mach das der Boden auch etwas Textur hat also mal rau ist oder uneben statt das alles nur hunderprozent gerade flächen sind.**
      mehrstufiges Gelände-Rauschen (Großformen + Hügel + Feinstruktur), Bodentextur-Variation
      (Grasbüschel, Erdstellen, Trampelpfade, Kies, Matsch nach Regen) und kleine Unebenheiten.

- [x] **Du kannst dir ja von vielen UIs oder Modelen erst bilder generieren und sie danach nach bauen damit du mehr infos hast wie so etwas ca. aussieht.**
      genau so gemacht: für das Gooby-Modell wurde die alte Web-Version gerendert und
      Bild-für-Bild verglichen, das Ranch-Artwork wurde generiert und danach nachgebaut.

- [x] **Der Trailer ist noch nicht perfekt und vorallem ist das gameplay etwas zu low quality also irgendwie ist das pixelig**
      Ursache gefunden: die Clips wurden in 960x540 aufgenommen und auf 1080p hochskaliert, MSAA
      war aus, und es gab drei verlustbehaftete Kompressionsstufen. Jetzt nativ 1920x1080, MSAA
      4x, verlustfreie Zwischenbilder, ein einziger Endencode mit CRF 16.

- [x] **Die Ranch ist nicht "belebt" genug und irgendwie fehlt so ein richtiges Feeling also Berge, Landschaften, Dinge zum erkunden.**
      Ranch-Openworld massiv erweitert: begehbares Bergmassiv (Gipfel ~90 m) mit Serpentine,
      Plateau, Schlucht mit Hängebrücke und Bergsee, dazu 7 neue Zonen (Lavendelwiese, Nebelmoor,
      Turmruine, Muschelbucht, Apfelgarten, Kornfeld, Strand), Wegenetz mit Wegweisern und
      Rastplätzen, 9 Entdeckungsorte.

- [x] **Viele Regionen sehen noch recht kahl aus also da fehlt so das du Scenerie besser gemacht hast wie zb mehr Bäume, hier und dort blumen,büsche etc**
      neue Streu-Bibliothek verteilt Bäume, Büsche, Blumen, Gräser, Steine und Farne in Gruppen
      statt gleichmäßig - angewendet auf Ranch UND Stadt (Straßenbäume, Blumenkästen, Hecken,
      Grünstreifen, Efeu).

- [x] **Jedes Spiel muss 3D sein**
      alle 36 Minispiele sind jetzt echte 3D-Szenen mit Kamera, Umgebung, Licht und Schatten -
      geprüft durch einen Test, der für jedes Spiel Kamera + Umgebung + Geometrie verlangt.

- [x] **Gooby braucht sein altes Model aus der alten vor Godot version wieder. (Du kannst dir ja einfach den anderen Branch anschauen)**
      das Original ist zurück: alle Proportionen wurden am Web-Quellcode gemessen und im
      Blender-Modell wiederhergestellt (Kopfanteil, Augengröße, Ohren, Wangen). Nebenbefund: die
      Farbpalette war doppelt kodiert und dadurch übersättigt - auch behoben.

- [x] **Viele UI Elemente sind noch nicht polished**
      UI-Prüfung über 15 Screens x 4 Gerätformate fand 430 Befunde - alle behoben (0 verbleibend).
      Dazu Mikro-Animationen: federnde Panels, gestaffeltes Einblenden, hochzählende Zahlen.

- [x] **Der Stadt fehlt auch sceneriere**
      Stadt bekam Alleen, Hecken, Blumenkästen, Grünstreifen, Efeu an Fassaden und
      Park-Verdichtung.

- [x] **Manche Autos schweben**
      Ursache: die Fahrbahn-Kacheln lagen mit ihrer Dicke über Null, die Fahrzeuge aber auf Null.
      Behoben, plus ein Test der für alle Fahrzeuge Bodenkontakt prüft.

- [x] **Viele UI Sachen sind meist ganz ganz außen am Rand und Skalieren nicht wirklich mit der gerät größe**
      zentrale Skalierung an der kurzen Bildschirmkante durchgesetzt, Safe-Area überall
      respektiert, Tippflächen auf mindestens 44 pt gebracht.

- [x] **Viele UI Sachen sind einfach nervig zuerreichen zb bei einem Mini Spiel kann das Pause Menü wenn man es öffnet auch nur ein Modal in der Mitte öffnen.**
      das Pause-Menü ist jetzt eine kompakte, mittige Karte über Abdunkelung (max. 62 % Breite) -
      für alle 36 Spiele auf einmal, inklusive echtem Einfrieren und 3-2-1 beim Fortsetzen.

- [x] **Das Rennen lässt alle in einander fahren?**
      Karts haben jetzt echte gegenseitige Kollision (sanftes Abdrängen + Tempoverlust statt
      Durchfahren), mit Test der den Bug erst nachweist und dann den Fix.

- [x] **Die Seele des Spiels fehlt.**
      Diagnose ergab: es gab zwar 43 Sprueche, aber keinen ZUSTAND. Goobys Gesicht fiel nach jedem
      Moment auf happy zurueck - bei leeren Stats riss er noch Witze. Jetzt: eine traege Laune
      (Halbwertszeit Stunden) faerbt Gesicht, Ohrenstellung, Lider, Bewegungstempo, Stimmlage und
      Idle-Auswahl. Dazu Absicht statt Zufall (Hunger -> er geht zum Kuehlschrank und schaut dich
      an), Blick der dir folgt, und Erinnerungen aus echten Erlebnissen.

- [x] **Du musst checken das die Builds wirklich erfolgreich sind statt immer Fehler kommen.**
      Ursachen analysiert (10x Formatierung, 8x eine veraltete iOS-Prüfung). Es gibt jetzt
      tools/ci/preflight.sh, das lokal exakt dieselben Prüfungen fährt wie die CI - vor jedem
      Push.

- [x] **Die kompletten Rückblicke Cutsecenen fehlen**
      Rückblick-Kino im Querformat und 5 Cutscenes sind gebaut (Aufwachen, Schlafengehen, Abreise,
      Urlaubsankunft, Einkaufsfahrt).

- [x] **Es fehlt fast alles von da vor und was da ist ist einfach nur schlechter, das einzig gute ist das Bau System der Rest sonst ist kacke.**
      unabhängige Prüfung: von 79 Features der alten Version sind jetzt 53 vollständig, 16
      teilweise, 10 fehlen - dazu sieben Spiele, die es vorher gar nicht gab. In dieser Runde neu:
      Profil, 44 Erfolge, Tagesbonus, 24 Tagesquests, Schlaf/Krankheit/Tierarzt, Funkelpark,
      Radio, Codes, Galerie, Postkarten.

- [x] **Das Ganze Spiel ist viel zu unfertig.**
      Vollstaendigkeit gegenueber der alten Version: von 53 auf 70 der 79 Features (5 teilweise, 3
      offen, 1 bewusst gestrichen). Neu in dieser Runde: Profil, 44 Erfolge, Tagesbonus, 24
      Tagesquests, gefuehrtes Onboarding, Schlaf/Krankheit/ Tierarzt, Funkelpark, Radio, Codes,
      Galerie, Postkarten, Arcade-Modifikatoren. Alle 'Bald'-Platzhalter sind beseitigt (per Test
      abgesichert).

- [x] **Das Spiel hat keine Seele**
      43 Seele-Momente gebaut: Gooby grüßt mit deinem Namen nach Tageszeit, vermisst dich nach
      längerer Abwesenheit, kommentiert Wetter und Neuanschaffungen, hat Lieblingsessen, feiert
      Geburtstage und Jubiläen, erinnert sich an echte Erlebnisse, macht Unsinn wenn man nicht
      hinsieht.

- [x] **Das Spiel ist nur eine Alpha.**
      Das Urteil der unabhaengigen Pruefung lautet jetzt: 'Inhaltlich komplettes Spiel mit wenigen
      dokumentierten Restluecken - kein Alpha-Zustand mehr.' Die drei ehrlich offenen Punkte
      (Ball-Wurf, Sammlungsset-UI, Gyro-Parallax) stehen in
      docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md.

- [x] **Alle Spiele sind grauen Haft.**
      siehe Politur oben - jedes Spiel wurde vorher/nachher bewertet und alles unter 4 von 5
      verbessert.

- [x] **Baue wirkliche 3D Spiele und nicht so 2D zeug.**
      erledigt, alle 36 Spiele sind 3D.

- [x] **Stelle sicher das wirklich alles 3D ist und nicht 2D**
      per Test abgesichert: jede Spielszene braucht Kamera, Umgebung, Licht und mindestens drei
      3D-Objekte.

- [x] **Das neue Gooby model ist nicht so toll wie das alte, nutze das alte bitte wieder.**
      siehe oben - das alte Modell ist wiederhergestellt und in allen Ansichten geprüft (Haus,
      Editor, Garderobe, Minispiele, Ranch).

- [x] **Es ist irgendwie nicht alles so gut gebackportet worden nur so gerusht ohne ohne Liebe zum detail.**
      die Vollständigkeitsprüfung listet jetzt jedes Feature der alten Version mit Belegstellen
      auf beiden Seiten - offene Punkte stehen in docs/godot-rewrite/EVAL-VOLLSTAENDIGKEIT.md.

- [x] **Jedes Game hat nicht genug Polish.**
      dito - plus zentral verbesserte Momente (Countdown, Ergebnisbildschirm mit hochzählenden
      Punkten, Sternen, Rekord-Feier), die auf alle Spiele gleichzeitig einzahlen.

- [x] **Das ganze UI ist null wie davor**
      Theme gegen die alte Web-CSS geeicht (Schattenfarben, Radien, Federungskurve, Stat-Pillen
      mit Icons) und animierte Hintergründe mit eigener Farbstimmung je Bereich.

- [x] **Es gibt viele Bugs.**
      systematischer Durchlauf: Godot-Meldungen von 7 Fehlern und 533 Warnungen auf 1 und 5
      gesenkt (Lambda-Captures, Navigations-Sync, Speicherlecks, GPU-Readback, veraltete
      Materialeigenschaft).

- [x] **Warum ist sovieles keine richtigen Assets sondern nur premetives?**
      23 eigene Blender-Modelle gebaut (Kassettentüren mit Klinke, Fensterrahmen, Duschvorhang,
      Duschkopf, Shed, Werkstatt, Gewächshaus, Sprinkler) und 6 fertige Modelle eingebunden; dazu
      Wanddeko (Lichtschalter, Steckdosen, Heizkörper, Bilderrahmen).

- [x] **Es fehlt der polish. Nimm dir mehr Subagents die auch sowas wie Dopamin, Sounddesign und feeling bewerten und verbessern sollen.**
      unabhängiger Prüf-Agent hat Dopamin, Sound und Spielgefühl gemessen; die Befunde wurden
      umgesetzt: Belohnungen von 9 auf 24 pro Erstflow, kein Musikstück clippt mehr, Loop-Nähte
      von 95 dB auf 6 dB, Türwechsel von 918 auf 455 ms, Nochmal-Start von 2450 auf 509 ms.

- [x] **Verbessere den Remotion Trailer massiv vor allem mit dem neuen was du alles geändert hat hat sich ja auch das aussehen geändert also baue den Trailern nochmal besser**
      komplett neu gebaut: 54,6 s, alle 27 Clips neu aufgenommen (der alte zeigte noch das falsche
      Gooby-Modell), mit Ranch-Kapitel, Bergmassiv, neuen Zonen, Wetter, Dorf, Turnier und
      Multiplayer.

- [x] **Deine Ganze Arbeit bisher ist viel zu wenig und es kommt mir so vor als ob du keine Mühe bisher hattest. Gib dir mehr Mühe und nimm mehr Subagents und mehr Teams die gemeinsam ansachen arbeiten statt nur 6-8 Subagents. Du kannst wirklich 20-30 nutzen.**
      auf bis zu 9 gleichzeitige Agents pro Welle hochgezogen, plus unabhängige Bewerter-Agents
      für Dopamin, Sounddesign und Vollständigkeit.

- [x] **Verbessere nochmal die Gooby Ranch sowie Seceneriere ich will das es richtig schönes aussehen gibt es soll auch berge und terrain etc geben baue die OpenWorld da richtig nochmal mehr aus.**
      siehe Bergmassiv + 7 neue Zonen oben.

- [x] **Verbessere jedes Minispiel nochmal mit jeweils 3 Subagents Fable 5 Max Thinking als Model nutzen unbedingt damit die Arbeit wirklich perfekt wird.**
      alle 36 Spiele durch Politur-Agents gelaufen: echte Kulissen mit Tiefe, Gooby als sichtbarer
      Mitspieler, korrigierte Belichtung (die Bühnen waren rund 40 Luma-Stufen zu hell),
      Belohnungsmomente, Ton.
