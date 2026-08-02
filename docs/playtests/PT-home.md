# PT-HOME — Playtest Haus (Füttern / Bau / Schlaf)

**Runde:** W17, Playtest-Welle (PT-HOME-Agent) · **Datum:** 2. August 2026
**Werkzeug:** Playtest-Harness (`GOOBY-GODOT/tests/tools/playtest_harness.gd`,
Aufruf `tools/ci/run_playtest.sh <flow>`), Leitformat quer 2868×1320
(iPhone 17 Pro Max), llvmpipe/xvfb — Urteile nur zu Layout/Flow/Logik,
nicht zu GPU-Feinheiten oder Performance (s. Harness-Kopfdoku).

## Ergebnis auf einen Blick

| Loop | Flow | Schritte | Ergebnis | Echte Buchung geprüft |
| --- | --- | --- | --- | --- |
| Füttern (Tür → Kühlschrank → Möhre) | `flow_home_basis` | 21 | **21 ok / 0 fail** | `gooby.stats.hunger` steigt nach dem Mampfen |
| Bau (Bett aus Lager platzieren) | `flow_baumodus` | 22 | **22 ok / 0 fail** | `home.rooms.living.items` enthält `bedSingle` |
| Schlaf (Bettzeit → Schlafen → Wecken) | `flow_schlaf` **(NEU)** | 29 | **29 ok / 0 fail** | `gooby.sleep.sleeping` = true, nach „Sanft wecken“ wach + `grumpyUntil` gebucht |

Keine SCRIPT-ERROR-Zeilen in den drei Läufen (nur die bekannten
llvmpipe-Warnungen V-Sync/Orientation und der ObjectDB-Leak-Hinweis beim
Prozess-Ende). Reports + Screenshots je Lauf unter
`/tmp/gooby-godot/artifacts/PLAYTEST/pt_fuettern2|pt_bau|pt_schlaf/`.

**Neu in dieser Runde:** `tests/tools/playtest_flows/flow_schlaf.gd` — erbt
die kompletten Baumodus-Schritte und hängt den Schlaf-Kreislauf an
(Bett antippen → Nachtkarte → „Schlafen gehen“ → Zähneputz-Ritual +
Einschlaf-Kino → Save-Beweis → „Sanft wecken“ → Grumpy-Beweis). Einziger
Nicht-Spieler-Eingriff: Zeitraffer `gooby.stats.energy` → 55 (frischer Save
startet bei 90, das Bett ist da zu Recht gesperrt — `Sleep.can_sleep` < 70).

## Befunde

### F1 — „Was nun?“-Karte fängt den Tür-Tap ab (im ersten Lauf ein Blocker)

Im Leitformat quer liegt die „Was nun?“-Hinweiskarte (oben mittig,
`WhatsNextHint`, `mouse_filter STOP`, 14 s Auto-Hide, tippbar → öffnet das
Tagesquests-Blatt) GENAU über der Küchentür. Der Tür-Tap des ersten
Füttern-Laufs traf die Karte, statt der Tür-Bestätigung öffnete sich das
Tagesquests-Blatt, der Rest des Laufs fiel kaskadierend durch
(Beleg: `pt_fuettern/012_tuer_zur_kueche_tippen_FAIL.png`).

- **Für Spieler:** ärgerlich, aber kein Blocker — untere Türhälfte tippen
  oder die Karte per × wegdrücken. Bis zu 14 s „verdeckte“ Tür pro Vorschlag.
- **Fix (Flow, diese Welle):** `flow_basis.gd` drückt die Karte wie ein
  Spieler per × weg (`wasnun_wegdruecken`); die Harness wartet bei `tipp_3d`
  jetzt auf einen freien Bildschirmpunkt und nennt den UI-Deckel beim Namen
  (P58-Härtung, parallel gelandet). Wiederholungslauf: 21/21 grün.
- **Offen (Spiel-Design, klein):** die `hint_lane` der Karte kann Welt-Ziele
  (Türen) verdecken. Denkbar: Karte beim Tap auf verdeckte 3D-Ziele
  durchlässig machen oder die Lane tiefer legen. Kein trivialer Fix — an die
  nächste UI-Welle.
- **GEFIXT (UI-Welle, Nachtrag):** die Karte ist jetzt genau dann
  durchlässig, wenn HINTER dem Tap-Punkt ein Welt-Tap-Ziel liegt
  (`whats_next_hint._input` prüft per Kamera-Ray gegen die neue Gruppe
  `DoorTransition.TAP_ZIEL_GRUPPE` und schaltet die Karte für genau dieses
  Event auf `MOUSE_FILTER_IGNORE`; das × behält als eigener STOP-Button
  Vorrang). Wache:
  `test_uifinal_polish.gd::test_hint_laesst_tap_auf_verdeckte_tuer_durch`.

### F2 — Harness-Report nannte bei Callable-Bedingungen den falschen Text (gefixt)

`_bedingung_text` prüfte den `name`-Schlüssel VOR `bedingung` — bei
`warte_bis`-Schritten (Quelle = ganzer Schritt) meldete der FAIL-Report
irreführend `name = 'hunger_gestiegen'` statt der echten Erwartung.
Gefixt in `playtest_harness.gd` („bedingung“ zuerst, eigener
`erwartung`-Text wird angezeigt).

### F3 — Onboarding-Karten sitzen links der Mitte (bekannt, weiter offen)

Willkommen/Editor-Karten stehen im Leitformat bei ~42 % statt 50 %
(Beleg: `pt_fuettern2/001…006`). Bekannter Pionier-Befund (G7), gehört zur
UI-Welle — hier nur bestätigt, nicht gefixt.

**GEFIXT (UI-Welle, Nachtrag):** Wurzel war NICHT das Karten-Layout,
sondern `UiScale.safe_insets_canvas` unter xvfb: das Fenster (2868×1320)
ist größer als der virtuelle X-Screen (1280×1024), `get_display_safe_area()`
liefert den GANZEN Screen — daraus wurden Fake-Insets rechts/unten
(15-%-Deckel → Safe-Zentrum exakt bei 42,5 %), die JEDE safe-zentrierte UI
nach links oben schoben. Fix: eine Safe-Area, die den kompletten Screen
umschließt, ist kein Cutout → Insets 0 (`UiScale.safe_area_hat_cutout`,
pure; echte Notches bleiben unangetastet). Wache:
`test_fix1_ui_scale.gd::test_safe_area_ohne_cutout_zaehlt_nicht_als_notch`;
Beweis: Wiederholungslauf `flow_home_basis`, Welcome-Karte mittig.

### F4 — Sprechblasen überlappen im Baumodus die Aktionsleiste (Optik, niedrig)

Goobys Sprechblasen („Platzier dein Bett! …“) legen sich über die obere
Bau-Knopfzeile (Drehen/Platzieren/Abbrechen bzw. Ebenen-Chips); die Knöpfe
blieben in den Läufen tippbar (Blase ist kein Klick-Schlucker), es ist rein
optisch (Belege: `pt_bau/014_bau_dock_ansehen.png`, `018_ghost_liegt.png`).
Verwandt mit dem bekannten P57-Rest „Guide-Karte über Bau-Dock“ — an die
UI-Welle.

**GEFIXT (Nachtrag):** das Bau-Dock meldet sich jetzt als Bottom-Belegung im
UiAnchors-Vertrag an (`build_ui_dock.gd`) — Sprechblasen (AcBubble dodgt
`ZONE_BOTTOM`) rutschen damit ÜBER die Dock-Oberkante statt Action-Bar/
Ebenen-Chips zu überlappen; zu = Dock unsichtbar = Reservierung inert. Wache:
`test_g4_build.gd::test_sprechblase_weicht_dem_bau_dock_aus`.

### F5 — Decken-Geist als breiter Querstreifen nach dem Tür-Travel (beobachten)

Direkt nach der Fahrt in die Küche liegt der ausgefadete Deckenbalken als
breiter halbtransparenter Streifen quer im Bild
(`pt_fuettern2/019_mampf_sequenz_ansehen.png`). Vermutlich der gewollte
„Decke weg beim Umschauen“-Fade in einer Zwischen-Kameralage; im Standbild
irritiert er. Beobachten, kein Handlungsbedarf aus diesem Lauf.

## Ausdrücklich KEINE Bugs (geprüft)

- **Lager-Zähler „8/100 → 5/100“ beim Platzieren EINES Betts:** der Zähler
  ist ein Platz-/Punktewert (`StorageLogic.points_used`), das Kuschelbett
  (2×3) kostet 3 Punkte — korrekt.
- **Bett auf frischem Save gesperrt:** Energie startet bei 90,
  `Sleep.can_sleep` verlangt < 70 — die Nachtkarte zeigt den freundlichen
  „noch wach“-Hinweis. Gewolltes Verhalten (deshalb der Zeitraffer im Flow).
- **Nachtkarte:** „Nickerchen (20 Minuten)“ erscheint korrekt ab Energie < 90,
  „Gute-Nacht-Geschichte“ delegiert an die Geschichten-Stunde, „Sanft wecken“
  ist sofort erlaubt (`EARLY_WAKE_AFTER_MIN` = 0) und bucht den
  Grumpy-Debuff — alles wie in Doc REST-3 beschrieben.
