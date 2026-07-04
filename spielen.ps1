# MONKEYALARM! - Mit Freunden spielen
# Einfach doppelklicken, alles startet automatisch!

$gameDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$tunnelUrl = $null
$tunnelProcess = $null

Write-Host "============================================" -ForegroundColor Yellow
Write-Host "       MONKEYALARM! - MIT FREUNDEN SPIELEN" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""

# 1) Dependencies installieren
Write-Host "[1/3] Installiere Abhaengigkeiten..." -ForegroundColor Cyan
Set-Location $gameDir
npm install --silent
Write-Host "        Fertig!" -ForegroundColor Green
Write-Host ""

# 2) Server starten
Write-Host "[2/3] Starte Multiplayer-Server + WebApp..." -ForegroundColor Cyan
$serverJob = Start-Process -WindowStyle Minimized -FilePath "node" -ArgumentList "server/index.js" -PassThru -NoNewWindow
$viteJob = Start-Process -WindowStyle Minimized -FilePath "npx" -ArgumentList "vite --host" -PassThru -NoNewWindow
Start-Sleep -Seconds 1
Write-Host "        Server (Port 3010) und WebApp (Port 5173) gestartet" -ForegroundColor Green
Write-Host ""

# 3) Cloudflare Tunnel starten und URL abfangen
Write-Host "[3/3] Starte oeffentlichen Tunnel..." -ForegroundColor Cyan
Write-Host ""

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "$gameDir\cloudflared.exe"
$psi.Arguments = "tunnel --url http://localhost:5173"
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
$psi.WorkingDirectory = $gameDir

$tunnelProcess = New-Object System.Diagnostics.Process
$tunnelProcess.StartInfo = $psi
$tunnelProcess.Start() | Out-Null

# Warten auf die Tunnel-URL
Write-Host "   Warte auf Tunnel-URL..." -ForegroundColor Cyan
$found = $false
for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (-not $tunnelProcess.HasExited) {
        $line = $tunnelProcess.StandardOutput.ReadLine()
        if ($line -match "(https://[a-zA-Z0-9-]+\.trycloudflare\.com)") {
            $tunnelUrl = $matches[1]
            $found = $true
            break
        }
    }
}

Clear-Host
Write-Host ""

# Versuche lokale IP zu finden
$localIP = ""
$adapters = Get-NetAdapter | Where-Object { $_.Status -eq "Up" -and $_.Name -notlike "*Loopback*" -and $_.Name -notlike "*Tailscale*" -and $_.Name -notlike "*vEthernet*" }
foreach ($adapter in $adapters) {
    $ip = Get-NetIPAddress -InterfaceIndex $adapter.ifIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "127.0.0.*" }
    if ($ip) {
        $localIP = $ip.IPAddress
        break
    }
}

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Yellow
Write-Host "║         💚 ALLES BEREIT - MIT FREUNDEN SPIELEN 💚      ║" -ForegroundColor Green
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Yellow

if ($found -and $tunnelUrl) {
    Write-Host "║                                                      ║" -ForegroundColor Yellow
    Write-Host "║  📡 OEFFENTLICHE URL (an Freunde schicken!):        ║" -ForegroundColor Yellow
    Write-Host "║                                                      ║" -ForegroundColor Yellow
    Write-Host "║  $($tunnelUrl.PadRight(50))║" -ForegroundColor White -BackgroundColor DarkBlue
    Write-Host "║                                                      ║" -ForegroundColor Yellow
} else {
    Write-Host "║                                                      ║" -ForegroundColor Yellow
    Write-Host "║  ⚠️  Tunnel-URL nicht erkannt                        ║" -ForegroundColor Red
    Write-Host "║  Bitte Tunnel-Fenster checken                      ║" -ForegroundColor Red
    Write-Host "║                                                      ║" -ForegroundColor Yellow
}

if ($localIP) {
    Write-Host "║  🏠 IM SELBEN NETZWERK:                              ║" -ForegroundColor Yellow
    Write-Host "║  http://$($localIP):5173                                      ║" -ForegroundColor Cyan
    Write-Host "║                                                      ║" -ForegroundColor Yellow
}

Write-Host "║  🌐 LOKAL: http://localhost:5173                      ║" -ForegroundColor Cyan
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Yellow
Write-Host "║                                                      ║" -ForegroundColor Yellow
Write-Host "║  🎮 SO GEHT'S:                                       ║" -ForegroundColor Yellow
Write-Host "║                                                      ║" -ForegroundColor Yellow
Write-Host "║  1. URL an Freunde schicken                         ║" -ForegroundColor White
Write-Host "║  2. "Online Multiplayer" -> "Host Room"             ║" -ForegroundColor White
Write-Host "║  3. 4-Buchstaben-Code kopieren                     ║" -ForegroundColor White
Write-Host "║  4. Freunde: "Join Room" + Code eingeben            ║" -ForegroundColor White
Write-Host "║  5. Ready -> Starten -> Los geht's! 🐵🚨            ║" -ForegroundColor White
Write-Host "║                                                      ║" -ForegroundColor Yellow
Write-Host "╠══════════════════════════════════════════════════════╣" -ForegroundColor Yellow
Write-Host "║                                                      ║" -ForegroundColor Yellow
Write-Host "║  🎮 STEUERUNG:                                       ║" -ForegroundColor Yellow
Write-Host "║  WASD = Bewegen | Maus = Schauen                     ║" -ForegroundColor White
Write-Host "║  Shift = Sprinten | Space = Springen                 ║" -ForegroundColor White
Write-Host "║  Linksklick = Fangen (Polizei)                      ║" -ForegroundColor White
Write-Host "║                                                      ║" -ForegroundColor Yellow
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Yellow

Write-Host ""
Write-Host "   [ENTER] = Beenden und alle Fenster schliessen"
Write-Host "   [STRG+C] = Nur dieses Fenster schliessen (Server laufen weiter)"
Write-Host ""
$input = Read-Host

# Aufraeumen
Write-Host ""
Write-Host "Raeume auf..." -ForegroundColor Cyan
if (-not $tunnelProcess.HasExited) { $tunnelProcess.Kill() }
if ($serverJob -and -not $serverJob.HasExited) { $serverJob.Kill() }
if ($viteJob -and -not $viteJob.HasExited) { $viteJob.Kill() }
Write-Host "Tschuess! 🐵" -ForegroundColor Green
