# PT-META — Playtest Meta-Features (DLC-Hub, Telefon-Apps, Radio, Garderobe, Tagesquests, Erfolge)

**Runde:** W18, Playtest-Welle H (PT-META) · **Datum:** 2. August 2026
**Werkzeug:** Playtest-Harness (`GOOBY-GODOT/tests/tools/playtest_harness.gd`)
mit vier NEUEN Spieler-Flows (`flow_dlc_hub`, `flow_telefon_apps`,
`flow_radio`, `flow_erfolge`) plus den bestehenden `flow_garderobe` und
`flow_quests_sheet` — `tools/ci/run_playtest.sh <flow> 2868x1320 <lauf-id>`.
Leitformat quer, llvmpipe/xvfb — Urteile nur zu Layout/Flow/Logik, nicht zu
GPU-Feinheiten oder Performance (s. Harness-Kopfdoku).

**Zuschnitt pro Feature (ein Spieler-Agent, frischer Save):** Boot →
Onboarding → das Feature so bespielen, wie ein Spieler es am ersten Tag
täte — inklusive Save-Beweisen (nicht nur Optik): DLC-Start wechselt die
Route, Radio-Likes landen in `radio.likes`, der Beanie-Kauf zieht echte
Münzen ab, `firstFeed` steht nach der Möhre im Save.

## Ergebnis auf einen Blick

| Feature | Flow | Lauf | Schritte | Auffällig |
| --- | --- | --- | --- | --- |
| DLC-Hub | flow_dlc_hub (NEU) | w6 | 32 ok / 0 | Läufe 1–4 rot → Fixe F1/F6 + B2 |
| Telefon-Apps | flow_telefon_apps (NEU) | w2 | 35 ok / 0 | Wisch nur in der Statuszeile (B1) |
| Radio | flow_radio (NEU) | w4b | 29 ok / 0 | Läufe 1–3 rot → F4 + Härtungen |
| Garderobe | flow_garderobe | w5 | 21 ok / 0 | Kauf bucht echt: 130→30 Münzen |
| Tagesquests | flow_quests_sheet | w5 | 21 ok / 0 | Griff-Wisch + Dim-Tap schließen |
| Erfolge | flow_erfolge (NEU) | w1 | 32 ok / 0 | firstFeed live + „???“-Mystery |

Absicherung der drei Spiel-Fixe: kompletter Unit-Lauf 3511 Tests / 0 rot
(436 Testdateien, isolierter Runner).

Reports + Screenshot je Schritt: `/tmp/gooby-godot/artifacts/PLAYTEST3/<lauf-id>_<flow>/`.

**In den grünen Läufen geprüft:** DLC-Bibliothek (Route `dlc`, 3 Cover-
Karten), Ranch-Detail mit fail-closed-Gesperrt-Gate (Knopf disabled +
„…Level 1 und trainiert fleißig“), McGooby-„Schicht starten!“ → echte
Reise in `mcgooby_schicht`; alle sechs Telefon-Kacheln (Taxi, Guber,
Gooberando, Kamera-POW-Gate mit Toast, GoobyPal, InstantGooby) samt
P52-Zurück-Geste und Runterwisch-zu; Radio an/aus, Senderwechsel auf
Gooby FM, „Nächster Titel“ wechselt den Track wirklich, Like landet im
Save, Musik läuft nach dem Schließen weiter; Beanie kaufen+anziehen;
Quest-Blatt öffnen/Griff-Wisch/Dim-Tap; Erfolgs-Screen mit
„Freigeschaltet!“-Badge, „???“-Mystery-Zeilen und Kategorie-Filter.

## Gefunden und GEFIXT (Spiel)

### F1 — Settings-Overlay blieb über der DLC-Bibliothek liegen

**Symptom (flow_dlc_hub Lauf 1):** „Alle DLCs ansehen“ wechselt die Route
auf `dlc`, aber der Bildschirm zeigt weiter Settings — alle Folge-Taps
laufen ins Leere (Beleg `w1_flow_dlc_hub/015_dlc_bibliothek_oeffnen_*.png`).
**Ursache:** SettingsScreen ist ein Overlay auf dem CanvasLayer von
`home_entry`, NICHT im Router. `router.goto("dlc")` tauscht nur die Szene
UNTER dem Overlay — der Deckel bleibt liegen und schluckt alles.
**Fix:** `home_entry._on_travel_started` gibt das Settings-Overlay bei
JEDEM Reisebeginn frei (betrifft auch `transfer`/`codes`). Nachlauf w3:
Bibliothek + Detail-Sheets voll bedienbar.

### F4 — RadioSheet verlor nach jedem Senderwechsel seine Node-Namen

**Symptom (flow_radio Lauf 3):** Nach dem Senderwechsel ist der
„Schließen“-Knopf per Node-Name unauffindbar — obwohl er sichtbar im
Sheet steht (Beleg `w3_flow_radio/026_radio_schliessen_FAIL.png`).
**Ursache:** `_baue_ui()` räumte mit `queue_free()` OHNE `remove_child()`
auf. Die Alt-Kinder bleiben einen Frame lang Geschwister, die NEUEN
Direktkinder („Schliessen“, „SenderChips“, …) kollidieren mit deren Namen
und Godot benennt sie in `@SquishButton@N` um — reproduziert in einer
Minimal-Probe (SceneTree-Skript). Knöpfe in frisch gebauten
Unter-Containern (AnAus/Naechster/Like in „Transport“) behalten ihre Namen,
darum fiel es erst am Sheet-Ende auf.
**Fix:** `remove_child` vor `queue_free` (das Muster stand schon in
`_refresh_titel_liste` derselben Datei). Nachlauf w4b grün.

### F6 — Geschlossene DLC-Detail-Sheets blieben unsichtbar im Baum

**Symptom (flow_dlc_hub Lauf 4):** Nach Ranch-Detail → Dim-Tap-Schließen →
McGooby-Detail zielt der „Schicht starten!“-Tap ins Leere — die Suche nach
`AktionKnopf` findet den UNSICHTBAREN Knopf des alten Ranch-Sheets zuerst
(Beleg `w4b_flow_dlc_hub/031_schicht_starten_FAIL.png`).
**Ursache:** `DlcScreen.oeffne_detail` hängt kein Aufräumen ans Sheet.
`PanelSheet.close()` versteckt nur (`visible=false` nach dem Fade) — die
Knopf-Pfade `_starte_dlc`/`_zum_angebot` rufen `queue_free` selbst, aber
Dim-Tap/Runterwisch/Back-Geste NICHT. Jeder weitere „Ansehen“-Tap stapelte
ein verstecktes Sheet obendrauf (Leck pro Bibliotheks-Besuch).
**Fix:** `sheet.closed.connect(sheet.queue_free)` in `oeffne_detail` — das
dokumentierte Bestandsmuster (radio_geraet, rmp_hub; s. Vertragskommentar
an `PanelSheet.close()`). Nachlauf w6: kompletter Hub-Durchstich grün bis
in die echte Schicht-Route.

## Flow-/Harness-Härtungen (Werkzeug, kein Spiel-Bug)

### F2 — Random-Events würfeln beim Boot mit und blockieren Möbel-Taps

Das „Karton“-Event (`RandomEventEngine.roll_on_start`) stellt eine modale
EventChoice („Raus da!“ / „Ok, du bist ein Möbel“) über den Raum — im
Radio-Pionier-Lauf fing sie den Möbel-Tap ab (Beleg
`w1_flow_radio/013_radio_antippen_FAIL.png`). Gewolltes Spielverhalten,
für Flows aber ein Störer: `flow_basis.onboarding_schritte()` tippt das
Event jetzt wie ein Spieler weg (`tipp_falls_da` „Raus da!“, pflicht=false).

### F3 — Radio-Möbel in der Raumecke: Tap-Punkt projiziert an den Bildrand

Das Radio steht im Standard-Layout in der vorderen linken Ecke DICHT an
der Kamera — der Möbel-Ursprung projiziert an den unteren Bildrand, ein
Tap dort verfehlt die TapArea. `flow_radio` zielt darum nach oben und
Richtung Raummitte, bleibt aber innerhalb der 0,9³-Tap-Box. Für Spieler
mit Daumen kein Problem (die Box ist groß genug), fürs Werkzeug war der
Ursprungs-Punkt zu knapp.

### Scroll-Falz-Bausteine jetzt in flow_basis

Sheets scrollen — Knöpfe unter der Falz sind `visible_in_tree`, ihr
Mittelpunkt liegt aber außerhalb des Canvas; `tipp_name`/`tipp_text`
tippten ins Leere (McGooby-„Schicht starten!“, Radio-„Schließen“).
`merke_knopf`/`merk_knopf_mitte`/`scrolle_und_merke` (das
flow_minigame-Muster) leben jetzt in `flow_basis` für alle Flows.

## Beobachtungen (kein Fix nötig)

### B1 — Telefon: die Zurück-Geste braucht die Statuszeile

Der App-Inhalt (Scroll-Listen, Knöpfe) füllt die Gerätemitte und fängt
Drags ab — die P52-„von links“-Zurück-Geste und der Runterwisch-zu
funktionieren zuverlässig nur in der freien Statuszeilen-Zone (~6 % Höhe).
Spieler haben mit dem HomeBalken einen klaren Alternativ-Rückweg; wer die
Geste aus der Listenmitte startet, scrollt eben — vertretbar.

### B2 — McGooby-Detail zeigt auf Level-1-Saves das Kauf-Gate (KORREKT)

Seit dem Welle-B-Kauf-Gate (Level 14 + 3000 Münzen, `DlcKatalog.status_fuer`)
ist McGooby auf dem frischen Save GESPERRT — genau wie die Ranch,
fail-closed. `flow_dlc_hub` sät darum `mcgooby.besitz.gekauft=true` in den
Save, um zusätzlich den INSTALLIERT-Zweig samt echtem DLC-Start zu prüfen.

### B3 — „Invalid polygon data, triangulation failed“

Der aus PT-MG-A/B bekannte Log-Fehler tauchte auch hier vereinzelt auf
(w3_flow_dlc_hub, Schritt `dlc_bibliothek_oeffnen`) — ohne sichtbaren
Schaden. Übergabe an die bestehende PT-MG-A-F3-Spur (Frame-Dump lohnt).
