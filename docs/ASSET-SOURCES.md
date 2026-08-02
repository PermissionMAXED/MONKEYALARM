# ASSET-SOURCES.md — zentrale Herkunfts- & Lizenz-Übersicht (3D-Modelle)

Stand: W18 (Agent ASSETS-MORE, 2026-08-02). Diese Datei ist der zentrale
Index über ALLE 3D-Modell-Quellen unter `GOOBY-GODOT/assets/` — die
Detail-Inventare bleiben in den Ordner-Dokumenten (verlinkt). Das
Style-Gate `tools/assets/style_gate.py` prüft gegen diese Datei
(Eigenbau-Ordner) und gegen die License-Dateien in den Asset-Ordnern.

## Regeln für neue Modelle (verbindlich)

1. **Nur CC0-Quellen oder Eigenbau.** Kuratierte Quellen: Kenney
   (kenney.nl), Quaternius (quaternius.com), KayKit (kaylousberg.com),
   Tiny Treats (itch.io) — alle CC0 1.0. KEINE Unity-Asset-Store-Downloads
   (EULA erlaubt keine Engine-fremde Nutzung), KEINE Konten über
   Wegwerf-Mail.
2. **Stil-Pass zuerst:** Low-Poly, flache Pastell-Farben, runde Silhouetten
   (Referenz: Gooby-Modell + Kenney-Kits). Was nicht passt, kommt nicht rein.
3. **Jeder Ordner trägt seinen Beleg:** eine `License-…txt` neben den
   Modellen (Pack-Name + CC0-Link) oder ein Eigenbau-Eintrag hier.
4. **Gate laufen lassen:** `python3 tools/assets/style_gate.py` muss GRÜN
   sein (Lizenz-Beleg, Referenzen, ≤ 25 000 Dreiecke, ≤ 1,5 MB, Texturen
   ≤ 2048 px; Warnungen für gekippte/versinkende Modelle — User-Wunsch
   »alles richtig rotiert und richtig rum«).
5. **Import committen:** nach `godot --headless --path GOOBY-GODOT --import`
   gehören die erzeugten `.import`-/`.uid`-Dateien MIT ins Repo.

## Quellen-Index

| Bereich | Quellen | Detail-Inventar |
|---|---|---|
| `assets/character/` | **Eigenbau** (Blender-Pipeline `tools/blender/gooby_build/`, Palette aus Theme-Tokens) | `docs/godot-rewrite/F-gooby.md` |
| `assets/city/` | Kenney City/Car/Nature/Food/Watercraft/Survival Kit, KayKit City/Restaurant Bits — alle CC0 | [`GOOBY-GODOT/assets/city/LIZENZ.md`](../GOOBY-GODOT/assets/city/LIZENZ.md) |
| `assets/city/urlaub/` | Kenney **Watercraft Kit** (Web-Referenz) + **Survival Kit** + **Nature Kit** (frische kenney.nl-Downloads W17: Zelt, Feuerstelle, Wegweiser, Palmen, Boote, Bojen) | dito |
| `assets/furniture/` | Kenney Furniture/Nature/Food/Suburb, KayKit Furniture/City/Halloween/Restaurant, itch-CC0-Packs (Aline, Tiny Treats, gfree) | [`GOOBY-GODOT/assets/furniture/LIZENZ.md`](../GOOBY-GODOT/assets/furniture/LIZENZ.md) |
| `assets/minigames/` | Kenney Space/Food/Nature/Minigolf/Sports/Watercraft Kit, Tiny Treats, **Quaternius Ultimate Space Kit** (W17: Planet + gestrandetes Raumschiff für rocket_rescue) | [`GOOBY-GODOT/assets/minigames/LIZENZ.md`](../GOOBY-GODOT/assets/minigames/LIZENZ.md) |
| `assets/park/` | Kenney **Fantasy Town Kit 2.0** (Marktstände, Brunnen, Hecken, Laterne, Karren) + **Food Kit 2.0** (Waffel, Softeis, Eis am Stiel) — frische kenney.nl-Downloads W18 | [`GOOBY-GODOT/assets/park/LIZENZ.md`](../GOOBY-GODOT/assets/park/LIZENZ.md) |
| `assets/props/` | **Eigenbau** (deterministische Blender-Pipeline `GOOBY-GODOT/tools/blender/props/`) | [`GOOBY-GODOT/assets/props/LICENSE-NOTE.md`](../GOOBY-GODOT/assets/props/LICENSE-NOTE.md) |
| `assets/ranch/` | Quaternius **Farm Animals** (CC0), Kenney-Kits, Rest Eigenbau | [`docs/godot-rewrite/RANCH-ASSETS.md`](godot-rewrite/RANCH-ASSETS.md) |

## Eigenbau-Ordner (Lizenz beim Projekt, vom Style-Gate anerkannt)

- `assets/character` — Gooby-Rig (Blender-Pipeline, `F-gooby.md`)
- `assets/props` — Haus-/Garten-Props (`assets/props/LICENSE-NOTE.md`)
- `assets/ranch/pferd` — Pferd + Fohlen (RANCH-ASSETS §1)
- `assets/ranch/hindernisse` — Turnier-Hindernisse (RANCH-ASSETS §1)
- `assets/ranch/props` — Sattel/Bürste/Trog/Heuballen (RANCH-ASSETS §1)

## Kurations-Protokoll W17 (Agent ASSETS-CC0)

Frisch heruntergeladen und integriert (alle CC0 1.0, Links = Quelle):

| Modell | Pack / Quelle | Eingebaut in |
|---|---|---|
| `tent-canvas.glb`, `campfire-pit.glb`, `signpost.glb` | [Kenney Survival Kit](https://kenney.nl/assets/survival-kit) | Urlaubs-Ort BERGE (`urlaubs_ort.gd`) — ersetzt PrismMesh-Zelt + Kugel-Steinkreis |
| `tree_palm.glb`, `tree_palmDetailedTall.glb`, `tree_palmBend.glb` | [Kenney Nature Kit](https://kenney.nl/assets/nature-kit) | Urlaubs-Ort STRAND — Palmen rahmen den Strand |
| `boat-sail-a.glb`, `boat-row-small.glb`, `buoy.glb`, `buoy-flag.glb` | [Kenney Watercraft Kit](https://kenney.nl/assets/watercraft-kit) (Web-Referenz-Kopie) | Urlaubs-Ort STRAND — Segelboot + Bojen im Meer, Ruderboot im Sand |
| `Planet_5.gltf`, `Spaceship_FinnTheFrog.gltf` | [Quaternius Ultimate Space Kit](https://quaternius.com/packs/ultimatespacekit.html) | rocket_rescue — echter Planet statt Farbkugel + gestrandetes Häschen-Raumschiff als Kulisse |

Bewusst NICHT ersetzt (Stil-Entscheidung, kein Versäumnis): Gooby-Hase der
Ranch-Wildtiere, Funkelpark-Stände, Liegestuhl/Sonnenschirm/Sandburg und
Raumstations-Erdblick — das sind absichtliche Gooby-Eigenbauten mit
Label3D-Beschriftung bzw. Design-Doc-Vorgaben.

## Kurations-Protokoll W18 (Agent ASSETS-MORE)

Frisch heruntergeladen und integriert (alle CC0 1.0, account-frei über
kenney.nl; Poly Pizza war aus dieser Umgebung nicht erreichbar — HTTP 403):

| Modell | Pack / Quelle | Eingebaut in |
|---|---|---|
| `stall-red.glb`, `stall-green.glb`, `stall.glb`, `stall-bench.glb` | [Kenney Fantasy Town Kit 2.0](https://kenney.nl/assets/fantasy-town-kit) | Funkelpark-Naschgasse (`funkelpark.gd`) — echte Marktstände ersetzen die Box-Theken (Primitiv-Fallback bleibt); Bänke am Brunnen |
| `fountain-round-detail.glb`, `lantern.glb`, `hedge.glb`, `hedge-curved.glb`, `cart-high.glb` | dito | Funkelpark-Plaza: Brunnen als Mittelpunkt, 4 Laternen, Hecken flankieren das Tor, Verkaufskarren an der Ostkante |
| `waffle.glb`, `ice-cream-cne.glb`, `ice-cream-cup.glb`, `popsicle.glb` | [Kenney Food Kit 2.0](https://kenney.nl/assets/food-kit) | Naschgassen-Theken (Softeis-/Waffel-Stand); Zuckerwolken-Stand nutzt Bestands-Süßes aus `assets/city/essen` |

Dazu Wiederverwendung ohne Neu-Download: Baumring/Büsche/Blumen der
Funkelpark-Wiese kommen aus `assets/city/natur` (Kenney Nature Kit,
bereits lizenziert). Die W17-Entscheidung »Funkelpark-Stände sind
Eigenbau« ist damit bewusst revidiert: das Fantasy Town Kit liefert
Marktstände im exakt passenden Stil; die Label3D-Schilder bleiben.
Wache: `tests/unit/test_rest4_park.gd::test_funkelpark_deko_und_marktstaende`.
