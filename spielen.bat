@echo off
setlocal enabledelayedexpansion

title MONKEYALARM! - Mit Freunden spielen
cd /d "%~dp0"

:: ANSI Escape initialisieren (funktioniert unter Windows 10+)
for /f %%a in ('echo prompt $E ^| cmd') do set "ESC=%%a"

:: ==============================================
cls
echo %ESC%[93m============================================%ESC%[0m
echo %ESC%[93m       MONKEYALARM! - MIT FREUNDEN SPIELEN%ESC%[0m
echo %ESC%[93m============================================%ESC%[0m
echo.

:: 1) Dependencies installieren
echo %ESC%[96m[1/3] Installiere Abhaengigkeiten...%ESC%[0m
call npm install --silent
if errorlevel 1 (
    echo %ESC%[91mFEHLER: npm install fehlgeschlagen!%ESC%[0m
    echo %ESC%[91m       Bitte stelle sicher, dass Node.js installiert ist.%ESC%[0m
    pause
    exit /b 1
)
echo %ESC%[92m        Fertig!%ESC%[0m
echo.

:: 2) Server starten
echo %ESC%[96m[2/3] Starte Multiplayer-Server + WebApp...%ESC%[0m
start "Server" /min cmd /c "title MONKEYALARM Server & node server/index.js"
start "Vite" /min cmd /c "title MONKEYALARM WebApp & npx vite --host"
echo %ESC%[92m        Server (Port 3010) und WebApp (Port 5173) gestartet%ESC%[0m
echo.

:: 3) Cloudflare Tunnel
echo %ESC%[96m[3/3] Starte oeffentlichen Tunnel...%ESC%[0m

:: cloudflared.exe im Spielverzeichnis suchen (relativer Pfad %~dp0)
set "CF=%CD%\cloudflared.exe"
if not exist "%CF%" (
    echo.
    echo %ESC%[91mFEHLER: cloudflared.exe wurde nicht gefunden!%ESC%[0m
    echo %ESC%[91m       Pfad: %CF%%ESC%[0m
    echo %ESC%[93m       Bitte lade es herunter von:%ESC%[0m
    echo %ESC%[93m       https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/%ESC%[0m
    echo %ESC%[93m       und lege es in das Spielverzeichnis.%ESC%[0m
    echo.
    echo %ESC%[93m  Der lokale Server laeuft trotzdem unter:%ESC%[0m
    echo %ESC%[93m  http://localhost:5173%ESC%[0m
    echo.
    pause
    exit /b 1
)

echo.
echo   %ESC%[96mWarte auf Tunnel-URL...%ESC%[0m

:: Temporäre Logdatei für Tunnelausgabe
set "TUN_LOG=%TEMP%\monkeyalarm_tunnel_%RANDOM%.log"

:: Tunnel mit relativen Pfad aus %~dp0 starten
start "Tunnel" /min cmd /c "title MONKEYALARM Tunnel & "%~dp0cloudflared.exe" tunnel --url http://localhost:5173 > "%TUN_LOG%" 2>&1"

:: Auf Tunnel-URL warten (max 20 Sekunden)
set "TUN_URL="
for /l %%i in (1,1,40) do (
    ping -n 1 -w 500 127.0.0.1 >nul
    if exist "%TUN_LOG%" (
        for /f "usebackq tokens=* delims=" %%a in ("%TUN_LOG%") do (
            echo %%a | findstr /r "https?://[a-zA-Z0-9.-]*\.trycloudflare\.com" >nul
            if not errorlevel 1 (
                :: Extrahiere die URL mit PowerShell (sauberer als reines Batch)
                for /f "tokens=*" %%u in ('powershell -NoProfile -Command "Select-String -Path '%TUN_LOG%' -Pattern 'https?://[a-zA-Z0-9.-]*\.trycloudflare\.com' | ForEach-Object { [System.Text.RegularExpressions.Regex]::Match($_.Line, 'https?://[a-zA-Z0-9.-]*\.trycloudflare\.com').Value }" 2^>nul') do set "TUN_URL=%%u"
                if defined TUN_URL goto :url_found
            )
        )
    )
)
:url_found

:: Lokale IP ermitteln
set "LOCAL_IP="
for /f "tokens=*" %%i in ('powershell -NoProfile -Command "try { ((Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.Name -notlike '*Loopback*' -and $_.Name -notlike '*Tailscale*' -and $_.Name -notlike '*vEthernet*' } | Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress) -match '^(?!169\.254\.)(?!127\.)(\d+\.\d+\.\d+\.\d+)' | Select-Object -First 1 } catch { '' }" 2^>nul') do set "LOCAL_IP=%%i"

:: ==============================================
::  BILDSCHIRM ANZEIGEN
:: ==============================================
cls

:: ------------------------------------------------------------------
:: Rahmen oben
echo %ESC%[93m╔══════════════════════════════════════════════════════════╗%ESC%[0m
echo %ESC%[92m║            ALLES BEREIT - MIT FREUNDEN SPIELEN           ║%ESC%[0m
echo %ESC%[93m╟──────────────────────────────────────────────────────────╢%ESC%[0m

:: Oeffentliche URL
if defined TUN_URL (
    echo %ESC%[93m║                                                        ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[97m📡 OEFFENTLICHE URL (an Freunde schicken!):%ESC%[0m%ESC%[93m       ║%ESC%[0m
    echo %ESC%[93m║                                                        ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[97m%TUN_URL%%ESC%[0m%ESC%[93m  ║%ESC%[0m
    echo %ESC%[93m║                                                        ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[90m(Das Tunnel-Fenster kann minimiert bleiben)%ESC%[0m%ESC%[93m          ║%ESC%[0m
) else (
    echo %ESC%[93m║                                                        ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[91m⚠  Tunnel-URL nicht automatisch erkannt%ESC%[0m%ESC%[93m               ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[93mSchau im Fenster "MONKEYALARM Tunnel"%ESC%[0m%ESC%[93m                    ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[93mnach "https://....trycloudflare.com"%ESC%[0m%ESC%[93m                       ║%ESC%[0m
    echo %ESC%[93m║                                                        ║%ESC%[0m
)

:: Lokale Netzwerk-IP
if defined LOCAL_IP (
    echo %ESC%[93m╟──────────────────────────────────────────────────────────╢%ESC%[0m
    echo %ESC%[93m║                                                        ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[96m🏠 IM SELBEN NETZWERK:%ESC%[0m%ESC%[93m                                  ║%ESC%[0m
    echo %ESC%[93m║  %ESC%[96mhttp://%LOCAL_IP%:5173%ESC%[0m%ESC%[93m                                         ║%ESC%[0m
    echo %ESC%[93m║                                                        ║%ESC%[0m
)

:: Lokal
echo %ESC%[93m╟──────────────────────────────────────────────────────────╢%ESC%[0m
echo %ESC%[93m║                                                        ║%ESC%[0m
echo %ESC%[93m║  %ESC%[96m🌐 LOKAL: http://localhost:5173%ESC%[0m%ESC%[93m                         ║%ESC%[0m
echo %ESC%[93m║                                                        ║%ESC%[0m

:: Spielanleitung
echo %ESC%[93m╟──────────────────────────────────────────────────────────╢%ESC%[0m
echo %ESC%[93m║                                                        ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m🎮 SO GEHT'S:%ESC%[0m%ESC%[93m                                          ║%ESC%[0m
echo %ESC%[93m║                                                        ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m1. URL an Freunde schicken%ESC%[0m%ESC%[93m                            ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m2. "Online Multiplayer" -^> "Host Room"%ESC%[0m%ESC%[93m                ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m3. 4-Buchstaben-Code kopieren%ESC%[0m%ESC%[93m                        ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m4. Freunde: "Join Room" + Code eingeben%ESC%[0m%ESC%[93m               ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m5. Ready -^> Starten -^> Los geht's!%ESC%[0m%ESC%[93m                    ║%ESC%[0m
echo %ESC%[93m║                                                        ║%ESC%[0m
echo %ESC%[93m║  %ESC%[97m🎮 STEUERUNG:%ESC%[0m%ESC%[93m                                         ║%ESC%[0m
echo %ESC%[93m║  %ESC[97mWASD = Bewegen  |  Maus = Schauen%ESC[0m%ESC%[93m                        ║%ESC%[0m
echo %ESC%[93m║  %ESC[97mShift = Sprinten  |  Space = Springen%ESC[0m%ESC%[93m                    ║%ESC%[0m
echo %ESC%[93m║  %ESC[97mLinksklick = Fangen (Polizei)%ESC[0m%ESC%[93m                           ║%ESC%[0m
echo %ESC%[93m║                                                        ║%ESC%[0m
echo %ESC%[93m╚══════════════════════════════════════════════════════════╝%ESC%[0m
echo.
echo   %ESC%[90mAlle Fenster schliessen = Spiel beenden%ESC%[0m
echo.
pause
