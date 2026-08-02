extends TestCase
## GOOBY-SAVE (W18) — Fuzz-Haertung des Save-IMPORT-Trichters + der BEWEIS,
## dass die Vorsicherung (user://save_v5.pre_import.json) VOR dem Ersetzen
## des Spielstands auf Platte liegt. Ergaenzt test_migration_fuzz.gd
## (Migrations-Kette ab Dictionary) und test_migration_transfer.gd
## (Happy-Path + Screen) um genau die Luecken dazwischen:
##  1. Seeded Zeichen-Fuzz ueber preview_text an ECHTEN Fixture-Texten
##     (kuerzen/kippen/einfuegen/loeschen/verdoppeln): nie Crash, immer
##     voller Antwort-Vertrag, ok-Ergebnisse sind normalize-stabil.
##  2. GOOBY5-Code-Fuzz: jede Ein-Zeichen-Mutation wird abgelehnt ODER
##     dekodiert beweisbar zum IDENTISCHEN State — nie stille Korruption.
##     (Base64-Randfall: das letzte Payload-Zeichen traegt Fuellbits, eine
##     Mutation dort KANN zu denselben Bytes dekodieren — dann ist auch der
##     State identisch, das ist die ehrliche Sicherheits-Eigenschaft.)
##  3. bplist-Byte-Fuzz (Zufallsbytes, mit/ohne echten Header) und
##     probe_legacy auf einer Muell-Plist: nie Crash, sauber abgelehnt.
##  4. preview_file-Deckel: eine Datei ueber MAX_FILE_BYTES wird abgelehnt.
##  5. Backup-VOR-Import als REIHENFOLGE-Beweis: ein Fake mit der echten
##     Persistenz-Semantik von game_state.import_state() (schreibt sofort)
##     sieht die Vorsicherung BEREITS auf Platte, sie ueberlebt die
##     Persistenz des neuen Stands, wird pro Import ueberschrieben, und
##     ohne Alt-Save entsteht KEINE Geister-Backup-Datei.
## Alle Fuzz-Laeufe nutzen einen FESTEN Seed — deterministisch reproduzierbar.

const BPlist := preload("res://scripts/state/import/bplist.gd")
const TransferService := preload("res://scripts/state/import/transfer_service.gd")
const MovingBox := preload("res://scripts/state/moving_box_import.gd")
const SaveSchema := preload("res://scripts/state/save_schema.gd")
const Util := preload("res://tests/fixtures/state_test_util.gd")

## Gepinnte Uhr der Fixture-Generierung (2026-01-15T12:00:00Z).
const NOW_MS := 1768478400000
## Fester Fuzz-Seed — Faelle sind reproduzierbar, kein Flaker-Risiko.
const FUZZ_SEED := 0x600B5AFE

var _seq := 0


class PersistingGameState:
	extends RefCounted
	## Fake mit der ECHTEN Persistenz-Semantik von game_state.import_state():
	## der neue Stand wird SOFORT in die Save-Datei geschrieben (save_now).
	## Er protokolliert, was IM MOMENT des import_state-Aufrufs auf Platte
	## lag — damit ist die Reihenfolge Backup → Import beweisbar (der
	## Bestandstest prueft nur den End-Zustand NACH apply()).
	var save_path := ""
	var backup_path := ""
	var import_calls := 0
	var backup_existed_at_import := false
	var backup_content_at_import := ""

	func import_state(new_state: Dictionary) -> void:
		import_calls += 1
		backup_existed_at_import = FileAccess.file_exists(backup_path)
		backup_content_at_import = (
			FileAccess.get_file_as_string(backup_path) if backup_existed_at_import else ""
		)
		# Wie das echte GameState: sofort persistieren.
		var file := FileAccess.open(save_path, FileAccess.WRITE)
		file.store_string(JSON.stringify(new_state))
		file.flush()


func _fixture_text(file_name: String) -> String:
	return FileAccess.get_file_as_string("res://tests/fixtures/" + file_name)


func _temp_dir() -> String:
	_seq += 1
	var dir := "user://save_fuzz_tests/%d_%d" % [Time.get_ticks_usec(), _seq]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(dir))
	return dir


# ── 1. Zeichen-Fuzz ueber den Einfuege-Trichter (preview_text) ───────────────


## Eine seeded Zufalls-Mutation auf String-Ebene — exakt die Domaene, in der
## der Trichter angegriffen wird (Zwischenablage liefert immer einen String).
func _mutate_text(text: String, rng: RandomNumberGenerator) -> String:
	var n := text.length()
	match rng.randi_range(0, 4):
		0:  # hart abschneiden (halb kopierter Save)
			return text.left(rng.randi_range(0, n - 1))
		1:  # 1–8 Zeichen kippen
			var out := text
			for _k in rng.randi_range(1, 8):
				var pos := rng.randi_range(0, n - 1)
				out = out.left(pos) + char(rng.randi_range(33, 126)) + out.substr(pos + 1)
			return out
		2:  # Muell mitten hinein (inkl. Nicht-ASCII)
			var at := rng.randi_range(0, n)
			return text.left(at) + '{"💥": [' + text.substr(at)
		3:  # Block loeschen
			var start := rng.randi_range(0, n - 2)
			return text.left(start) + text.substr(rng.randi_range(start + 1, n - 1))
		_:  # Save hinter Save (Doppel-Einfuegen)
			return text + text


func test_fuzz_preview_text_zeichenmutationen_halten_vertrag() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = FUZZ_SEED
	var base_texts: Array[String] = [
		_fixture_text("v4_midgame.json"),
		_fixture_text("v4_urlaub.json"),
	]
	var ok_count := 0
	var rejected := 0
	for i in 48:
		var mutated := _mutate_text(base_texts[i % base_texts.size()], rng)
		var res := TransferService.preview_text(mutated, NOW_MS)
		for key in ["ok", "state", "error", "report"]:
			assert_true(res.has(key), "Fall %d: Antwort-Key %s" % [i, key])
		if res["ok"]:
			ok_count += 1
			assert_eq(int(res["state"].get("v", 0)), 5, "Fall %d: ok → v5" % i)
			var again := SaveSchema.normalize(res["state"], NOW_MS)
			assert_true(again["ok"], "Fall %d: ok → normalize-stabil" % i)
		else:
			rejected += 1
			assert_false(String(res["error"]).is_empty(), "Fall %d: Fehler benannt" % i)
	print(
		(
			"    Import-Fuzz (Text): 48 Mutationen — %d migriert, %d sauber abgelehnt"
			% [ok_count, rejected]
		)
	)
	assert_eq(ok_count + rejected, 48, "jede Mutation deterministisch behandelt")
	assert_true(rejected > 0, "der Fuzz erzeugt auch echte Ablehnungen")


# ── 2. GOOBY5-Code: CRC/Format lassen keine stille Korruption durch ──────────


func test_fuzz_gooby5_code_nie_stille_korruption() -> void:
	var base := TransferService.preview_text(_fixture_text("v4_maxed.json"), NOW_MS)
	assert_true(base["ok"], "maxed-Fixture migriert: " + str(base["error"]))
	var state: Dictionary = base["state"]
	var code := MovingBox.export_code(state)
	var clean := MovingBox.import_text(code, NOW_MS)
	assert_true(clean["ok"], "unveraenderter Code laeuft: " + str(clean["error"]))
	# Numerisch tolerant: der JSON-Roundtrip macht aus Ints Floats (JS-Semantik).
	var roundtrip_diff := Util.first_diff(clean["state"], state)
	assert_true(roundtrip_diff.is_empty(), "Code-Roundtrip identisch — Diff: " + roundtrip_diff)
	var reference: Dictionary = clean["state"]
	var rng := RandomNumberGenerator.new()
	rng.seed = FUZZ_SEED
	var rejected := 0
	var identical := 0
	for i in 40:
		var pos := rng.randi_range(0, code.length() - 1)
		var new_ch := code[pos]
		while new_ch == code[pos]:
			new_ch = char(rng.randi_range(33, 126))
		var mutated := code.left(pos) + new_ch + code.substr(pos + 1)
		var res := MovingBox.import_text(mutated, NOW_MS)
		for key in ["ok", "state", "error", "report"]:
			assert_true(res.has(key), "Mutation %d: Antwort-Key %s" % [i, key])
		if res["ok"]:
			identical += 1
			var diff := Util.first_diff(res["state"], reference)
			assert_true(
				diff.is_empty(), "Mutation %d: ok NUR bei identischem State: %s" % [i, diff]
			)
		else:
			rejected += 1
			assert_false(String(res["error"]).is_empty(), "Mutation %d: Fehler benannt" % i)
	print(
		(
			"    Import-Fuzz (GOOBY5): 40 Ein-Zeichen-Mutationen — %d abgelehnt, %d identisch"
			% [rejected, identical]
		)
	)
	assert_true(rejected >= 36, "CRC+Format fangen praktisch jede Mutation (%d/40)" % rejected)
	# Deterministische Kanten obendrauf.
	assert_false(MovingBox.import_text(code.left(code.length() - 1), NOW_MS)["ok"], "CRC gekuerzt")
	assert_false(MovingBox.import_text("GOOBY4" + code.substr(6), NOW_MS)["ok"], "falscher Prefix")
	assert_false(MovingBox.import_text(code + ".extra", NOW_MS)["ok"], "vierter Punkt-Teil")


# ── 3. bplist-Byte-Fuzz + probe_legacy auf Muell ─────────────────────────────


func test_fuzz_bplist_zufallsbytes_und_probe_legacy_muell() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = FUZZ_SEED + 1
	for i in 36:
		var bytes := PackedByteArray()
		if i % 3 != 0:
			# 2/3 der Faelle mit echtem Header, damit der Fuzz TIEF in den
			# Trailer-/Offset-Parser laeuft statt am Magic zu scheitern.
			bytes = "bplist00".to_ascii_buffer()
		for _k in rng.randi_range(0, 300):
			bytes.append(rng.randi_range(0, 255))
		var res := BPlist.parse(bytes)
		for key in ["ok", "value", "error"]:
			assert_true(res.has(key), "Fall %d: Antwort-Key %s" % [i, key])
		assert_false(res["ok"], "Fall %d: Zufallsbytes (%d) abgelehnt" % [i, bytes.size()])
		assert_false(str(res["error"]).is_empty(), "Fall %d: Fehler benannt" % i)
	# Muell-Plist als Datei durch den ganzen Auto-Import-Weg: still + sauber.
	var junk_path := _temp_dir() + "/junk.plist"
	var file := FileAccess.open(junk_path, FileAccess.WRITE)
	var junk := "bplist00".to_ascii_buffer()
	for _k in 64:
		junk.append(rng.randi_range(0, 255))
	file.store_buffer(junk)
	file.flush()
	file = null
	var probe := TransferService.probe_legacy(NOW_MS, junk_path)
	for key in ["found", "json", "source", "preview", "error"]:
		assert_true(probe.has(key), "probe_legacy: Antwort-Key %s" % key)
	assert_false(probe["found"], "Muell-Plist → nicht gefunden, kein Crash")


# ── 4. Datei-Deckel des Transfer-Screens ─────────────────────────────────────


func test_preview_file_lehnt_riesendatei_ab() -> void:
	var path := _temp_dir() + "/riese.json"
	var file := FileAccess.open(path, FileAccess.WRITE)
	var chunk := PackedByteArray()
	chunk.resize(1024 * 1024)
	chunk.fill(0x7B)  # lauter '{' — waere zugleich kaputtes JSON
	for _i in 8:
		file.store_buffer(chunk)
	file.store_8(0x7B)  # ein Byte UEBER MAX_FILE_BYTES (8 MiB)
	file.flush()
	file = null
	var res := TransferService.preview_file(path, NOW_MS)
	assert_false(res["ok"], "8-MiB+1-Datei abgelehnt (kein Gooby-Save ist so gross)")
	assert_true(String(res["error"]).contains("gross"), "Fehler nennt die Groesse")


# ── 5. Backup-VOR-Import: der Reihenfolge-Beweis ─────────────────────────────


func test_backup_liegt_vor_import_auf_platte() -> void:
	var dir := _temp_dir()
	var save_path := dir + "/save_v5.json"
	var backup_path := save_path.get_basename() + ".pre_import.json"
	var alter_stand := '{"v":5,"alterStand":true}'
	var file := FileAccess.open(save_path, FileAccess.WRITE)
	file.store_string(alter_stand)
	file.flush()
	file = null
	var fake := PersistingGameState.new()
	fake.save_path = save_path
	fake.backup_path = backup_path
	var preview := TransferService.preview_text(_fixture_text("v4_fresh.json"), NOW_MS)
	assert_true(preview["ok"], str(preview["error"]))
	assert_true(TransferService.apply(preview["state"], fake, save_path), "apply klappt")
	# DER Beweis: als import_state lief, lag die Vorsicherung SCHON auf Platte …
	assert_true(fake.backup_existed_at_import, "Backup existierte BEIM import_state-Aufruf")
	assert_eq(fake.backup_content_at_import, alter_stand, "… und trug den ALTEN Stand")
	# … und sie ueberlebt die sofortige Persistenz des neuen Stands.
	assert_eq(FileAccess.get_file_as_string(backup_path), alter_stand, "Backup unversehrt")
	var json := JSON.new()
	assert_eq(json.parse(FileAccess.get_file_as_string(save_path)), OK, "neuer Save parst")
	assert_eq(int(json.data.get("v", 0)), 5, "neuer Save ist v5")
	assert_eq(int(json.data["economy"]["coins"]), 350, "neuer Save traegt den Import (100+250)")


func test_backup_wird_pro_import_ueberschrieben_und_nie_erfunden() -> void:
	var dir := _temp_dir()
	var save_path := dir + "/save_v5.json"
	var fake := PersistingGameState.new()
	fake.save_path = save_path
	fake.backup_path = save_path.get_basename() + ".pre_import.json"
	# Erst-Import OHNE Alt-Save (frische Installation): kein Geister-Backup.
	var fresh := TransferService.preview_text(_fixture_text("v4_fresh.json"), NOW_MS)
	assert_true(fresh["ok"], str(fresh["error"]))
	assert_true(TransferService.apply(fresh["state"], fake, save_path), "Import ohne Alt-Save ok")
	assert_false(fake.backup_existed_at_import, "kein Backup zum Import-Zeitpunkt")
	assert_false(FileAccess.file_exists(fake.backup_path), "keine Backup-Datei erfunden")
	var first_persisted := FileAccess.get_file_as_string(save_path)
	assert_false(first_persisted.is_empty(), "Erst-Import persistiert")
	# Zweit-Import: die Vorsicherung traegt jetzt GENAU den Stand von davor.
	var mid := TransferService.preview_text(_fixture_text("v4_midgame.json"), NOW_MS)
	assert_true(mid["ok"], str(mid["error"]))
	assert_true(TransferService.apply(mid["state"], fake, save_path), "Zweit-Import ok")
	assert_eq(fake.import_calls, 2, "beide Importe liefen")
	assert_true(fake.backup_existed_at_import, "Backup lag vor dem Zweit-Import auf Platte")
	assert_eq(
		fake.backup_content_at_import, first_persisted, "Backup == Stand VOR dem Zweit-Import"
	)
	assert_eq(
		FileAccess.get_file_as_string(fake.backup_path),
		first_persisted,
		"pro Import ueberschrieben (idempotent), nicht gestapelt"
	)
