# PT-STADT — Playtest Stadt / Läden / Reise

**Runde:** W17, Playtest-Welle (PT-CITY-Agent) · **Datum:** 2. August 2026
**Werkzeug:** Playtest-Harness (`GOOBY-GODOT/tests/tools/playtest_harness.gd`,
Aufruf `tools/ci/run_playtest.sh <flow>`), Leitformat quer 2868×1320
(iPhone 17 Pro Max), llvmpipe/xvfb — Urteile nur zu Layout/Flow/Logik,
nicht zu GPU-Feinheiten oder Performance (s. Harness-Kopfdoku).

## Ergebnis auf einen Blick

| Loop | Flow | Schritte | Ergebnis | Echte Buchung geprüft |
| --- | --- | --- | --- | --- |
| Stadt (Fahrt) → REHWEI (Kauf) → Flughafen (Reise) | `flow_stadt` **(NEU)** | 44 | **44 ok / 0 fail** (Lauf 3) | Auto bewegt sich > 3 m; `economy.coins` sinkt beim Möhrenkauf (130 → 125); Reise: 375 → 185 (−190 = Strand 180 + Taxi 10), `vacation.phase == away`, `destId == beach`, Route zurück `home/living`, Wohnzimmer zeigt „Wo ist mein Gooby?“ |

Drei Läufe: Lauf 1 (7 Fails, alles Flow-Handwerk: Dialog-/Scroll-Mechanik),
Lauf 2 (3 Fails → ein ECHTER Blocker gefunden, s. F1), Lauf 3 nach den Fixes
komplett grün. Keine SCRIPT-ERROR-Zeilen (nur die bekannten llvmpipe-Warnungen
V-Sync/Orientation und der ObjectDB-Leak-Hinweis beim Prozess-Ende).
Reports + Screenshots unter
`/tmp/gooby-godot/artifacts/PLAYTEST/pt_city_lauf1|lauf2|lauf3/`.

**Neu in dieser Runde:** `tests/tools/playtest_flows/flow_stadt.gd` — Boot →
Onboarding → Stadt über den HUD-Reise-Knopf → Ausparken + kurze freie Fahrt
(Bewegungs-Check + Lenk-Halte) → REHWEI (Prompt → Betreten → Dialog
„Einkaufen!“ → Kauf im HaendlerSheet → Raus) → Flughafen → Reise-App →
Glitzermeer → Buchen → Taxi → Boarding-Pass „Gute Reise!“ → Abflug-Cutscene →
zuhause. Ehrlich dokumentierte Harness-Eingriffe (llvmpipe schafft nur wenige
FPS, Blindfahrten über die große Stadt sind mit synthetischen Taps nicht
steuerbar): Teleport an die Parkplätze über die öffentlichen Test-Hooks
`auto.teleport`/`set_frozen`, Testgeld +250 ᴳ (Strand kostet 190, nach
Onboarding+Kauf standen erst 125 ᴳ da) und `debug.taxi_warte_s = 4`
(Dev-Key). Prompt/Betreten/Läden/
Reise laufen exakt wie beim echten Spieler.

## Befunde

### F1 — BLOCKER: „Gute Reise!“ fraß 190 ᴳ und ließ den Spieler in der ewigen Abflug-Cutscene stehen (GEFIXT)

Der Höhepunkt des Moduls war kaputt: Reise buchen (Geld wird sofort in
`_on_buchen` abgebucht) → Taxi → Boarding-Pass → „Gute Reise!“ → die
Abflug-Cutscene startet — und endet NIE. Kein Urlaub gebucht, keine Heimfahrt,
190 ᴳ weg (Beleg: `pt_city_lauf2/041_gute_reise_FAIL.png` — Cutscene samt
„Überspringen“-Knopf klebt dauerhaft über dem Flughafen-UI; nach 242 s
Timeout stand die Route weiter auf `city/ort/flughafen`).

- **Ursache:** „Gute Reise!“ schließt das Boarding-Pass-Sheet, dessen
  closed-Handler den ReiseApp-Layer freigibt. Die `fertig`-Verbindung der
  Cutscene zeigte auf DIESE Instanz und starb am Frame-Ende leise mit —
  der komplette Abschluss (Urlaub buchen, Taxi abschließen, heim routen)
  hing an ihr.
- **Fix (`scripts/city/travel/reise_app.gd`):** Abschluss als STATISCHE
  Methode `_cutscene_abschliessen`, die alles Nötige gebunden bekommt und
  das Sheet-Aufräumen überlebt. Guard-Test
  `test_w13b_reisepass.gd::test_cutscene_abschluss_ueberlebt_sheet_aufraeumen`
  (echte `_spiele_cutscene`-Verdrahtung, App wird vor `fertig` freigegeben).
- **Beweis:** Lauf 3 `gute_reise` OK (35 s inkl. Cutscene), `urlaub_pruefen`
  OK, Hauptsuite 3452/0 grün.

### F2 — Geclippte Sheet-Listen: Blind-Taps treffen den Backdrop und schließen das Sheet (Flow gehärtet; Optik s. F3)

Im Leitformat quer ragen HaendlerSheet-Sortiment und Reise-Ziel-Liste unter
die Falz ihrer ScrollContainer. Ein Tap auf die (unsichtbare) Knopf-Position
trifft den PanelSheet-Backdrop — das Sheet schließt kommentarlos, statt zu
kaufen/buchen (Belege: `pt_city_lauf1/032_reise_buchen_FAIL.png`,
`pt_city_lauf2/029_ware_kaufen_FAIL.png`). Für Spieler kein Bug (die
scrollen ja hin), für Automations-Taps schon: der Flow scrollt jetzt über
ALLE ScrollContainer-Vorfahren (`ensure_control_visible`), und der
Buchen-Knopf der Bestätigungsseite heißt jetzt `BuchenKnopf`
(`reise_app.gd`, ein Zeilen-Fix) — `tipp_text("Buchen")` war doppeldeutig.

### F3 — Bestätigungsseite: Überschrift oben angeschnitten (Optik, klein) — GEFIXT (W19)

„Gooby fliegt für 3 Tage: Glitzermeer“ wird auf der Buchungs-Bestätigung am
oberen Scroll-Rand angeschnitten (Beleg: `pt_city_lauf3/038_ziel_glitzermeer.png`).
Rein optisch, alles bleibt lesbar/bedienbar — ursprünglich »an die UI-Welle«.

**Fix (W19, `scripts/city/travel/reise_app.gd` + `scripts/ui/panel_sheet.gd`):**
Wurzel war der Scroll-Rest der Ziel-Liste — der ScrollContainer kennt keine
Ansichten und KLEMMT den alten Offset nur an der neuen (kürzeren)
Bestätigungs-Höhe fest, statt oben zu starten (xvfb-Messung im Leitformat:
Offset 1032 → geklemmt 187, Überschrift 175 px überm Fenster). Jetzt merkt
sich die Reise-App die zuletzt gebaute Ansicht und scrollt das Sheet bei
einem ECHTEN Ansichtswechsel über das neue `PanelSheet.scroll_nach_oben()`
an den Anfang; Re-Renders derselben Ansicht (Taxi-Countdown-Tick, Rotation)
behalten die Scroll-Position des Nutzers. Wache:
`test_w13b_reisepass.gd::test_ansichtswechsel_startet_oben_statt_titel_anzuschneiden`.

### F4 — Laden-Schilder überlappen sich in flachen Kamerawinkeln (Optik, klein) — GEFIXT (W19)

Bei der Fahrt schieben sich die 3D-Ortsschilder benachbarter Läden
perspektivisch übereinander (REHWEI/GOOBYTHEKE/IKEA-Schriftzüge stapeln sich,
Beleg: `pt_city_lauf3/016_fahrt_pruefen.png`). Aus Fahrersicht kurzzeitig
unleserlich, sortiert sich beim Näherkommen — ursprünglich »beobachten«.

**Fix (W19, `scripts/city/ui/ort_schild.gd`):** Verdeck-Dämpfung — liegt ein
deutlich näheres Schild aus Kamerasicht fast in derselben Richtung
(Winkel < 4° voll, bis 10° Rampe; das andere mindestens 6 m näher), blendet
das FERNERE weich aus. Das vorderste Schild bleibt immer voll lesbar, die
hinteren tauchen beim Näherkommen/seitlichen Versatz von selbst wieder auf
(rein geometrisch, deterministisch — kein Flackern zweier gleich weiter
Nachbarn). Wachen: `test_vis2_ort_schild.gd::test_verdeck_daempfung_pur` +
`::test_naeheres_schild_blendet_fernes_in_gleicher_sichtlinie_aus`.

## Ausdrücklich KEINE Bugs (geprüft)

- **Münz-Mathematik:** 130 ᴳ vor dem Kauf (Start 100 + Onboarding-/
  Tagesbonus-Belohnungen, Sheet-Kopf `028_muenzen_merken.png`); Möhre 5 ᴳ
  → 125; +250 Testgeld = 375; Reise 180 + Taxi 10 → 185 im Wohnzimmer.
  Jede Abbuchung exakt.
- **Dialog-Optionen erscheinen „verzögert“:** Die Knöpfe („Einkaufen!“ …)
  kommen erst, wenn die Typewriter-Bubble fertig ist (Tap 1 = Zeile komplett,
  Tap 2 = weiter) — gewollte Mechanik (`OrtDialogView._on_bubble_finished`),
  kein Hänger. Der Flow tippt sie wie ein Spieler durch.
- **„Wo ist mein Gooby?“ nach der Heimkehr:** Wohnzimmer ohne Gooby, Knopf
  unten links, Werte eingefroren — genau das versprochene Urlaubs-Verhalten
  (`pt_city_lauf3/044_abschluss_wohnzimmer.png`).
- **Taxi-Countdown:** „Noch 59 s zum Einsteigen!“ hinter dem Boarding-Pass
  zählt korrekt; mit Dev-Key 4 s Wartezeit kam das Taxi pünktlich.
