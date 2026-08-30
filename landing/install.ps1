# ==============================================================================
# Cours (Revision OS) — Script d'installation automatisé pour Windows (PowerShell)
# Pour tous vos cours, amphis, classes et études supérieures
# ==============================================================================

Write-Host "  ____                              " -ForegroundColor Cyan
Write-Host " / ___|___  _   _ _ __ ___          " -ForegroundColor Cyan
Write-Host "| |   / _ \| | | | '__/ __|         " -ForegroundColor Cyan
Write-Host "| |__| (_) | |_| | |  \__ \         " -ForegroundColor Cyan
Write-Host " \____\___/ \__,_|_|  |___/         " -ForegroundColor Cyan
Write-Host "  Revision OS • Pour tous vos cours " -ForegroundColor Cyan
Write-Host "`n==> Installation automatique de Cours sur Windows...`n" -ForegroundColor Blue

# 1. Vérification de Git et Node.js
Write-Host "[1/7] Vérification de l'environnement système..." -ForegroundColor Blue

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Erreur : git n'est pas installé. Téléchargez Git sur https://git-scm.com/" -ForegroundColor Red
    exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "Erreur : Node.js n'est pas installé. Téléchargez Node.js >= 18 sur https://nodejs.org/" -ForegroundColor Red
    exit 1
}

Write-Host "  ✓ Git et Node.js détectés." -ForegroundColor Green

# 2. Emplacement du projet
$TargetDir = "$HOME\cours"
Write-Host "`n[2/7] Configuration du dossier : $TargetDir..." -ForegroundColor Blue

if (Test-Path "start.mjs") {
    $TargetDir = (Get-Location).Path
    Write-Host "  ✓ Dossier courant utilisé." -ForegroundColor Green
} elseif (Test-Path $TargetDir) {
    Write-Host "  ✓ Dossier existant trouvé, mise à jour..." -ForegroundColor Yellow
    Set-Location $TargetDir
    git pull --quiet origin main 2>$null
} else {
    git clone https://github.com/ewiwlll/cours.git $TargetDir
    Set-Location $TargetDir
}

# 3. Configuration de l'environnement
Write-Host "`n[3/7] Initialisation des fichiers de configuration..." -ForegroundColor Blue
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
    } else {
        New-Item -ItemType File -Name ".env" | Out-Null
    }
}

# 4. Installation des dépendances et compilation Web
Write-Host "`n[4/7] Installation des dépendances et compilation..." -ForegroundColor Blue
npm install --silent 2>$null
if (Test-Path "web") {
    Set-Location "web"
    npm install --silent 2>$null
    npm run build 2>$null
    Set-Location ".."
}

# 5. Règle de pare-feu Windows pour le port 3002 (pour connecter le téléphone)
Write-Host "`n[5/7] Configuration de l'accès réseau local (Port 3002)..." -ForegroundColor Blue
try {
    New-NetFirewallRule -DisplayName "Cours Revision OS" -Direction Inbound -LocalPort 3002 -Protocol TCP -Action Allow -ErrorAction SilentlyContinue | Out-Null
    Write-Host "  ✓ Règle de pare-feu configurée avec succès pour le smartphone." -ForegroundColor Green
} catch {
    Write-Host "  ℹ Note : Vous devrez peut-être autoriser Node.js dans l'alerte pare-feu Windows." -ForegroundColor Yellow
}

# 6. Détection et installation mobile Android ADB (si disponible)
Write-Host "`n[6/7] Détection des téléphones connectés..." -ForegroundColor Blue
if (Get-Command adb -ErrorAction SilentlyContinue) {
    $AdbDevices = adb devices | Select-String "device$"
    if ($AdbDevices) {
        Write-Host "  ✓ Téléphone Android détecté via ADB !" -ForegroundColor Green
        if (Test-Path "apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk") {
            Write-Host "  → Installation directe de l'application sur le téléphone..." -ForegroundColor Cyan
            adb install -r -d "apps\mobile\android\app\build\outputs\apk\debug\app-debug.apk" 2>$null
            adb reverse tcp:3002 tcp:3002 2>$null
            Write-Host "  ✓ Application mobile installée avec succès sur votre smartphone !" -ForegroundColor Green
        }
    } else {
        Write-Host "  ℹ Aucun téléphone ADB branché. Scannez le QR Code pour connecter votre téléphone." -ForegroundColor Yellow
    }
}

# 7. Démarrage de Cours & Ouverture Navigateur
Write-Host "`n[7/7] Démarrage du serveur Cours..." -ForegroundColor Blue
Start-Process "http://localhost:3002"

Write-Host "`n🎉 Installation terminée avec succès !" -ForegroundColor Green
Write-Host "👉 Votre cockpit s'est ouvert sur : http://localhost:3002" -ForegroundColor Cyan
Write-Host "👉 Scannez le QR Code qui va s'afficher ci-dessous avec votre smartphone :`n" -ForegroundColor Yellow

node start.mjs
