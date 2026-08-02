class_name AudioDirector
extends Node
## Zentraler Sound-Fahrer (W4-P1, Autoload-Request "Audio" — s.
## handoffs/project-godot-requests.md). Bis der Orchestrator ihn einträgt,
## hängt get_or_create() den Knoten lazy unter /root — beide Wege liefern
## DENSELBEN Zustand (Muster W3c SocialServices).
##
## Aufgaben:
## - Busse Master/Music/Sfx/Voice anlegen (fehlende werden ergänzt, nie
##   dupliziert) und ihre Lautstärke aus AppSettings (audio.master/music/
##   sfx/voice, 0..1) setzen — live via setting_changed.
## - play(id): One-Shot-SFX über die SfxMap (Pool aus AudioStreamPlayern
##   auf dem Sfx-Bus, Streams gecacht, Frame-Debounce gegen Doppel-Plops).
## - duck_begin()/duck_end(): ref-gezähltes Dialog-Ducking — offene
##   Sprechblasen nehmen Musik + Ambience-Loops weich zurück (AUDIO-
##   GRAMMATIK „Dialog-Ducking“; Wache tests/unit/test_audio_ducking.gd).
## Headless-sicher: ohne Audio-Device spielt der Dummy-Treiber still.

## Busname → AppSettings-Key unter "audio." (Master heißt im Setting master).
const BUS_SETTINGS := {"Master": "master", "Music": "music", "Sfx": "sfx", "Voice": "voice"}
## Fester Mix-Offset je Bus, ZUSÄTZLICH zum Nutzer-Regler (EVAL-1 S1):
## Musik sitzt nach AC-Referenz 6–10 dB UNTER den Interaktions-Sounds.
## Die Musikdateien sind auf −20 dBFS gemastert (music_registry.gd, in der
## EVAL1-Messmetrik −17); der SFX-Median liegt bei ~−22,6 — der Bus legt
## die Musik mit −13 dB auf ~7,4 dB unter die Effekte (Regler 1.0 Default).
## tests/unit/test_ef2_audio_levels.gd wacht über das Verhältnis.
const BUS_BASE_DB := {"Music": -13.0}
## Master-Limiter (EVAL-1 S1): nichts über −1 dBFS, egal was sich stapelt.
const LIMITER_CEILING_DB := -1.0
const NODE_NAME := "AudioDirector"
const POOL_SIZE := 10
## Gleiche Id innerhalb dieses Fensters nur einmal spielen (GvZ-Pop-Cluster).
const DEBOUNCE_MSEC := 45
## Ambience-/Foley-Loops schleichen sich ein statt hart zu schneiden;
## Betten (> 2 s) starten zusätzlich an zufälliger Loop-Stelle, damit das
## Laden-Gemurmel nie zweimal identisch beginnt (AUDIO-GRAMMATIK).
const LOOP_EINBLENDEN_S := 0.9
const LOOP_STILL_DB := -40.0
## Dialog-Ducking (AUDIO-GRAMMATIK „Dialog-Ducking“): solange mindestens
## eine Sprechblase offen ist, treten Musik-Bus und Ambience-Loops einen
## Schritt zurück — ref-gezählt, weiche Flanken statt Pump-Effekt.
const DUCK_MUSIC_DB := -6.0
const DUCK_LOOP_DB := -5.0
const DUCK_EIN_S := 0.25
const DUCK_AUS_S := 0.6

## Duplikat-Schutz für get_or_create: das deferred add_child ist erst einen
## Frame später sichtbar, mehrere Aufrufe im selben Frame teilen diese Instanz.
static var _fallback: AudioDirector

var _pool: Array[AudioStreamPlayer] = []
var _pool_next := 0
var _streams: Dictionary = {}
var _last_played_msec: Dictionary = {}
var _warned_ids: Dictionary = {}
var _loop_players: Dictionary = {}
var _rng := RandomNumberGenerator.new()
var _duck_count := 0
var _duck_faktor := 0.0
var _duck_tween: Tween


## Bequemer One-Liner für Verdrahtungen: spielt id, wenn ein Baum da ist —
## sonst still no-op (Unit-Tests mit freien Nodes, allererster Frame).
static func try_play(from: Node, id: String, pitch := 1.0) -> void:
	if from == null or not from.is_inside_tree():
		return
	var director := get_or_create(from)
	if director.is_inside_tree():
		director.play(id, pitch)


## Dauer-Loop starten/stoppen (Wasser-/Bürsten-Foley, EVAL-1 F7) — Muster
## wie try_play: ohne Baum still no-op. `offset_db` sitzt ZUSÄTZLICH zum
## SfxMap-Trim (Ambience-Feinpegel, z. B. Gemurmel nach Besucherzahl).
static func try_start_loop(from: Node, id: String, offset_db := 0.0) -> void:
	if from == null or not from.is_inside_tree():
		return
	var director := get_or_create(from)
	if director.is_inside_tree():
		director.start_loop(id, offset_db)


static func try_stop_loop(from: Node, id: String) -> void:
	if from == null or not from.is_inside_tree():
		return
	var director := get_or_create(from)
	if director.is_inside_tree():
		director.stop_loop(id)


## Dialog-Duck anmelden (Sprechblase geht auf). Gibt den Director zurück —
## der Aufrufer MERKT sich die Instanz und ruft duck_end() auf genau ihr
## (balancierte Zählung auch über Szenenwechsel hinweg). null ohne Baum.
static func try_duck_begin(from: Node) -> AudioDirector:
	if from == null or not from.is_inside_tree():
		return null
	var director := get_or_create(from)
	director.duck_begin()
	return director


## Autoload /root/Audio bevorzugt, sonst lazy-Instanz unter /root.
static func get_or_create(from: Node) -> AudioDirector:
	var autoload := from.get_node_or_null("/root/Audio")
	if autoload is AudioDirector:
		return autoload
	var existing := from.get_node_or_null("/root/%s" % NODE_NAME)
	if existing is AudioDirector:
		return existing
	if _fallback != null and is_instance_valid(_fallback):
		return _fallback
	var node := AudioDirector.new()
	node.name = NODE_NAME
	_fallback = node
	from.get_tree().root.add_child.call_deferred(node)
	return node


func _ready() -> void:
	_rng.randomize()
	_ensure_buses()
	_apply_all_volumes()
	# Falls schon VOR dem Baum geduckt wurde (Fallback-Fenster): nachziehen.
	_duck_effekt_anwenden()
	for i in POOL_SIZE:
		var player := AudioStreamPlayer.new()
		player.bus = &"Sfx"
		add_child(player)
		_pool.append(player)
	var settings := get_node_or_null("/root/AppSettings")
	if settings != null and settings.has_signal("setting_changed"):
		settings.setting_changed.connect(_on_setting_changed)


## One-Shot-SFX nach SfxMap-Id; unbekannte Id warnt einmalig und ist no-op.
func play(id: String, pitch := 1.0) -> void:
	if _pool.is_empty():
		return
	var row := SfxMap.entry(id)
	if row.is_empty():
		if not _warned_ids.has(id):
			_warned_ids[id] = true
			push_warning("[audio] unbekannte SFX-Id '%s' (s. sfx_map.gd)" % id)
		return
	var now := Time.get_ticks_msec()
	if now - int(_last_played_msec.get(id, -DEBOUNCE_MSEC)) < DEBOUNCE_MSEC:
		return
	_last_played_msec[id] = now
	var stream := _stream_for(id, row)
	if stream == null:
		return
	var player := _next_player()
	player.stream = stream
	player.volume_db = float(row.get("volume_db", 0.0))
	var jitter := float(row.get("pitch_jitter", 0.0))
	player.pitch_scale = maxf(0.05, pitch + _rng.randf_range(-jitter, jitter))
	player.play()


## Geloopten Foley-/Ambience-Sound starten (care_wasser/Gemurmel). Ein
## zweiter Aufruf derselben Id ist no-op; stop_loop(id) blendet weich aus.
## Der Stream wird dupliziert, damit der One-Shot-Cache loop-frei bleibt.
## Ambience-Polish: Loops blenden weich EIN (kein Hart-Schnitt), Betten
## starten an zufälliger Stelle, `offset_db` kommt auf den SfxMap-Trim.
func start_loop(id: String, offset_db := 0.0) -> void:
	if _loop_players.has(id):
		return
	var row := SfxMap.entry(id)
	if row.is_empty():
		if not _warned_ids.has(id):
			_warned_ids[id] = true
			push_warning("[audio] unbekannte SFX-Id '%s' (s. sfx_map.gd)" % id)
		return
	var stream := _stream_for(id, row)
	if stream == null:
		return
	var looped: AudioStream = stream.duplicate()
	if looped is AudioStreamOggVorbis:
		(looped as AudioStreamOggVorbis).loop = true
	elif looped is AudioStreamWAV:
		(looped as AudioStreamWAV).loop_mode = AudioStreamWAV.LOOP_FORWARD
	var player := AudioStreamPlayer.new()
	player.bus = &"Sfx"
	player.stream = looped
	player.set_meta("basis_db", float(row.get("volume_db", 0.0)) + offset_db)
	player.set_meta("einblend_db", LOOP_STILL_DB)
	add_child(player)
	_loop_pegel_anwenden(player)
	player.play(_loop_startposition(looped))
	_loop_players[id] = player
	_loop_einblenden(player)


## Loop weich beenden (150-ms-Fade gegen Abschalt-Klick).
func stop_loop(id: String) -> void:
	var player: AudioStreamPlayer = _loop_players.get(id)
	if player == null:
		return
	_loop_players.erase(id)
	var einblendung: Variant = player.get_meta("einblend_tween", null)
	if einblendung is Tween and (einblendung as Tween).is_valid():
		(einblendung as Tween).kill()
	if not is_inside_tree():
		player.queue_free()
		return
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN)
	tween.tween_property(player, "volume_db", LOOP_STILL_DB, 0.15)
	tween.tween_callback(player.queue_free)


func is_loop_playing(id: String) -> bool:
	return _loop_players.has(id)


## Duck-Referenz erhöhen: die ERSTE offene Blase fährt Musik/Loops runter.
func duck_begin() -> void:
	_duck_count += 1
	if _duck_count == 1:
		_duck_fahren(1.0, DUCK_EIN_S)


## Duck-Referenz freigeben: erst die LETZTE Blase blendet zurück.
func duck_end() -> void:
	_duck_count = maxi(0, _duck_count - 1)
	if _duck_count == 0:
		_duck_fahren(0.0, DUCK_AUS_S)


func is_ducked() -> bool:
	return _duck_count > 0


## Lautstärke eines Busses live nachziehen (0..1, 0 = mute). Der feste
## Mix-Offset aus BUS_BASE_DB kommt IMMER obendrauf — der Regler steuert
## also relativ zur eingemessenen Mix-Balance. Der Dialog-Duck läuft
## BEWUSST getrennt als Amplify-Effekt (s. _ensure_duck_effekt) — die
## Bus-Lautstärke bleibt auch mitten in einer Duck-Flanke der reine
## Regler-Wert (die ef2-Bus-Wache misst genau das).
func apply_volume(bus_name: String, level: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx < 0:
		return
	var clamped := clampf(level, 0.0, 1.0)
	var base_db := float(BUS_BASE_DB.get(bus_name, 0.0))
	AudioServer.set_bus_mute(idx, clamped <= 0.0)
	AudioServer.set_bus_volume_db(idx, base_db + linear_to_db(maxf(clamped, 0.0001)))


func _ensure_buses() -> void:
	for bus_name: String in BUS_SETTINGS:
		if AudioServer.get_bus_index(bus_name) >= 0:
			continue
		var idx := AudioServer.bus_count
		AudioServer.add_bus(idx)
		AudioServer.set_bus_name(idx, bus_name)
		AudioServer.set_bus_send(idx, &"Master")
	_ensure_master_limiter()
	_ensure_duck_effekt()


## Brickwall auf dem Master (EVAL-1 S1): 37 Tracks clippten früher nach
## gain_trim; die Dateien sind jetzt zwar gemastert, aber Stapel-Momente
## (Fanfare + Konfetti + Musik) sollen physikalisch nie über −1 dBFS.
func _ensure_master_limiter() -> void:
	var idx := AudioServer.get_bus_index("Master")
	if idx < 0:
		return
	for i in AudioServer.get_bus_effect_count(idx):
		if AudioServer.get_bus_effect(idx, i) is AudioEffectHardLimiter:
			return
	var limiter := AudioEffectHardLimiter.new()
	limiter.ceiling_db = LIMITER_CEILING_DB
	AudioServer.add_bus_effect(idx, limiter)


func _apply_all_volumes() -> void:
	for bus_name: String in BUS_SETTINGS:
		apply_volume(bus_name, _settings_level(str(BUS_SETTINGS[bus_name])))


func _settings_level(key: String) -> float:
	var settings := get_node_or_null("/root/AppSettings")
	if settings != null and settings.has_method("audio_level"):
		return settings.audio_level(key)
	return 1.0


func _on_setting_changed(key: String, value: Variant) -> void:
	if not key.begins_with("audio."):
		return
	var setting := key.trim_prefix("audio.")
	for bus_name: String in BUS_SETTINGS:
		if str(BUS_SETTINGS[bus_name]) == setting:
			apply_volume(bus_name, float(value))


## Duck-Faktor weich auf `ziel` fahren (ohne Baum: sofort — Tests/Fallback
## vor dem deferred add_child; _ready zieht den Bus dann mit nach).
func _duck_fahren(ziel: float, dauer: float) -> void:
	if _duck_tween != null and _duck_tween.is_valid():
		_duck_tween.kill()
	if not is_inside_tree():
		_duck_anwenden(ziel)
		return
	_duck_tween = create_tween()
	_duck_tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	_duck_tween.tween_method(_duck_anwenden, _duck_faktor, ziel, maxf(0.05, dauer))


func _duck_anwenden(faktor: float) -> void:
	_duck_faktor = clampf(faktor, 0.0, 1.0)
	_duck_effekt_anwenden()
	for player: AudioStreamPlayer in _loop_players.values():
		_loop_pegel_anwenden(player)


## Dialog-Duck als EIGENER Amplify-Effekt auf dem Music-Bus: apply_volume
## (Regler + BUS_BASE_DB) bleibt davon unberührt — die ef2-Bus-Wache misst
## den Basis-Offset auch mitten in einer Duck-Flanke unverändert.
func _ensure_duck_effekt() -> void:
	var idx := AudioServer.get_bus_index("Music")
	if idx < 0:
		return
	for i in AudioServer.get_bus_effect_count(idx):
		if AudioServer.get_bus_effect(idx, i) is AudioEffectAmplify:
			return
	AudioServer.add_bus_effect(idx, AudioEffectAmplify.new())


func _duck_effekt_anwenden() -> void:
	var idx := AudioServer.get_bus_index("Music")
	if idx < 0:
		return
	for i in AudioServer.get_bus_effect_count(idx):
		var effekt := AudioServer.get_bus_effect(idx, i)
		if effekt is AudioEffectAmplify:
			(effekt as AudioEffectAmplify).volume_db = _duck_faktor * DUCK_MUSIC_DB
			return


## Zufälliger Loop-Einstieg: Ambience-Betten (> 2 s) klingen nie zweimal
## identisch; kurze Foley-Loops starten regulär von vorn.
func _loop_startposition(stream: AudioStream) -> float:
	var laenge := stream.get_length()
	if laenge <= 2.0:
		return 0.0
	return _rng.randf_range(0.0, laenge - 0.25)


## Weiches Einblenden bis zum Basis-Trim (ohne Baum: sofort voll da).
func _loop_einblenden(player: AudioStreamPlayer) -> void:
	if not is_inside_tree():
		player.set_meta("einblend_db", 0.0)
		_loop_pegel_anwenden(player)
		return
	var tween := create_tween()
	tween.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tween.tween_method(_loop_einblend_schritt.bind(player), LOOP_STILL_DB, 0.0, LOOP_EINBLENDEN_S)
	player.set_meta("einblend_tween", tween)


func _loop_einblend_schritt(db: float, player: AudioStreamPlayer) -> void:
	if not is_instance_valid(player):
		return
	player.set_meta("einblend_db", db)
	_loop_pegel_anwenden(player)


## Effektiver Loop-Pegel = SfxMap-Trim (+offset_db) + Einblendung + Duck.
func _loop_pegel_anwenden(player: AudioStreamPlayer) -> void:
	var basis := float(player.get_meta("basis_db", 0.0))
	var einblend := float(player.get_meta("einblend_db", 0.0))
	player.volume_db = basis + einblend + _duck_faktor * DUCK_LOOP_DB


## Pfad kommt aus SfxMap.path() — die Ranch-Familie (RW-8) nutzt absolute
## res://-Einträge, alle anderen hängen wie bisher an BASE_DIR.
func _stream_for(id: String, _row: Dictionary) -> AudioStream:
	if _streams.has(id):
		return _streams[id]
	var path := SfxMap.path(id)
	if not ResourceLoader.exists(path):
		if not _warned_ids.has(id):
			_warned_ids[id] = true
			push_warning("[audio] SFX-Datei fehlt: %s" % path)
		return null
	var stream: AudioStream = load(path)
	_streams[id] = stream
	return stream


## Round-Robin über den Pool; sind alle beschäftigt, wird der älteste geklaut.
func _next_player() -> AudioStreamPlayer:
	for _i in _pool.size():
		var candidate := _pool[_pool_next]
		_pool_next = (_pool_next + 1) % _pool.size()
		if not candidate.playing:
			return candidate
	var stolen := _pool[_pool_next]
	_pool_next = (_pool_next + 1) % _pool.size()
	return stolen
