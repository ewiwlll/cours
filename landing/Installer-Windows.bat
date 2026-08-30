@echo off
REM ==============================================================================
REM Cours (Revision OS) — Installateur 1-Clic pour Windows
REM Double-cliquez sur ce fichier pour installer et lancer Cours automatiquement !
REM ==============================================================================

chcp 65001 >nul
cls
echo ========================================================
echo   Cours (Revision OS) — Installation 1-Clic pour Windows
echo ========================================================
echo.

REM 1. Vérification Git et Node.js
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Git n'est pas installe.
    echo Telechargez Git gratuitement sur : https://git-scm.com/
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERREUR] Node.js n'est pas installe.
    echo Telechargez Node.js sur : https://nodejs.org/
    pause
    exit /b 1
)

REM 2. Répertoire cible
set TARGET_DIR=%USERPROFILE%\cours
if exist "%~dp0start.mjs" (
    cd /d "%~dp0"
) else (
    echo [1/5] Configuration du dossier %TARGET_DIR%...
    if exist "%TARGET_DIR%" (
        cd /d "%TARGET_DIR%"
        git pull --quiet origin main 2>nul
    ) else (
        git clone https://github.com/ewiwlll/cours.git "%TARGET_DIR%"
        cd /d "%TARGET_DIR%"
    )
)

REM 3. Configuration .env et dossiers
echo [2/5] Initialisation des dossiers de donnees...
if not exist ".env" (
    if exist ".env.example" (
        copy /y ".env.example" ".env" >nul
    ) else (
        type nul > ".env"
    )
)
if not exist "public" mkdir public
if not exist "data\audio" mkdir data\audio
if not exist "data\enregistrements" mkdir data\enregistrements
if not exist "data\cours" mkdir data\cours
if not exist "data\transcriptions" mkdir data\transcriptions
if not exist "data\revisions" mkdir data\revisions

REM 4. Installation des dépendances et compilation Web
echo [3/5] Installation des modules et compilation...
call npm install --silent >nul 2>&1
if exist "web" (
    cd web
    call npm install --silent >nul 2>&1
    call npm run build >nul 2>&1
    cd ..
)

REM 5. Règle Pare-feu pour accès mobile
echo [4/5] Configuration du reseau local (Port 3002)...
netsh advfirewall firewall add rule name="Cours Revision OS" dir=in action=allow protocol=TCP localport=3002 >nul 2>&1

REM 6. Démarrage
echo [5/5] Demarrage de Cours...
start "" "http://localhost:3002"
echo.
echo ========================================================
echo   🎉 Installation terminee ! Ouverture du Cockpit...
echo ========================================================
echo.
node start.mjs
