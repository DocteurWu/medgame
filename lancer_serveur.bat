@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title Medgame - lanceur
cd /d "%~dp0"

rem ==========================================================================
rem  Medgame - lance tout ce qu'il faut pour jouer en local :
rem    1. le serveur MCP (proxy LLM + voix + WebSocket des agents), port 8081
rem    2. le serveur web (no-store : jamais d'anciens modules en cache), port 8791
rem  puis ouvre le navigateur.
rem
rem  Usage : lancer_serveur.bat [jouer ^| ia ^| atlas ^| tests ^| stop]
rem    jouer  (defaut) ouvre l'accueil du jeu
rem    ia     ouvre ai-watch.html (regarder un agent IA jouer)
rem    atlas  ouvre l'atlas anatomique
rem    tests  lance npm test puis s'arrete
rem    stop   arrete les serveurs Medgame lances par ce script
rem ==========================================================================

set "WEB_PORT=8791"
set "MCP_PORT=8081"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=jouer"

echo.
echo  ==============================================
echo    MEDGAME  -  lancement local  (%MODE%)
echo  ==============================================
echo.

if /i "%MODE%"=="stop" goto :stop

rem ---- 1. Node.js ---------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo  [X] Node.js est introuvable.
    echo      Installez-le depuis https://nodejs.org ^(version 20 ou plus^), puis relancez.
    goto :fin_erreur
)
for /f "delims=" %%v in ('node -v') do set "NODE_VERSION=%%v"
for /f "tokens=1 delims=." %%v in ("%NODE_VERSION:v=%") do set "NODE_MAJOR=%%v"
if %NODE_MAJOR% LSS 20 (
    echo  [X] Node.js %NODE_VERSION% est trop ancien : il faut la version 20 ou plus.
    goto :fin_erreur
)
echo  [OK] Node.js %NODE_VERSION%

rem ---- 2. Dependances -----------------------------------------------------
if not exist "node_modules\@modelcontextprotocol\sdk" (
    echo  [..] Premiere installation des dependances ^(npm install^)...
    call npm install --no-fund --no-audit
    if errorlevel 1 (
        echo  [X] npm install a echoue. Verifiez votre connexion.
        goto :fin_erreur
    )
)
echo  [OK] Dependances installees

if /i "%MODE%"=="tests" goto :tests

rem ---- 3. Configuration (.env) --------------------------------------------
if not exist ".env" (
    copy /y ".env.example" ".env" >nul
    echo  [!] Fichier .env cree depuis .env.example.
    echo      Renseignez LLM_API_KEY dedans pour que le patient puisse parler.
    start "" notepad ".env"
) else (
    findstr /r /c:"^LLM_API_KEY=..*" ".env" | findstr /v /c:"ta_cle_llm_ici" >nul
    if errorlevel 1 (
        echo  [!] LLM_API_KEY est vide dans .env : le patient ne repondra pas.
    ) else (
        echo  [OK] Cle LLM presente
    )
    findstr /r /c:"^TTS_API_KEY=..*" ".env" >nul
    if errorlevel 1 (
        echo  [i] Pas de TTS_API_KEY : voix du navigateur ^(gratuite, plus robotique^).
    ) else (
        echo  [OK] Voix neuronale configuree
    )
)

rem ---- 4. Serveur MCP (proxy LLM, voix, agents) ---------------------------
call :port_libre %MCP_PORT%
if errorlevel 1 (
    echo  [OK] Serveur MCP deja actif sur le port %MCP_PORT%
) else (
    echo  [..] Demarrage du serveur MCP sur le port %MCP_PORT%...
    start "Medgame MCP (port %MCP_PORT%)" /min cmd /k "node mcp-server.js"
)

rem ---- 5. Serveur web ------------------------------------------------------
call :port_libre %WEB_PORT%
if errorlevel 1 (
    echo  [OK] Serveur web deja actif sur le port %WEB_PORT%
) else (
    echo  [..] Demarrage du serveur web sur le port %WEB_PORT%...
    start "Medgame Web (port %WEB_PORT%)" /min cmd /k "node scripts\dev-server.mjs %WEB_PORT%"
)

rem ---- 6. Attente que tout reponde (15 s max) -----------------------------
set /a ESSAIS=0
:attente
set /a ESSAIS+=1
powershell -NoProfile -Command "try { $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:%WEB_PORT%/index.html; $null = Invoke-WebRequest -UseBasicParsing -TimeoutSec 1 http://127.0.0.1:%MCP_PORT%/health; exit 0 } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 goto :pret
if %ESSAIS% GEQ 15 (
    echo  [X] Les serveurs ne repondent pas apres 15 s. Regardez les fenetres "Medgame MCP" et "Medgame Web".
    goto :fin_erreur
)
timeout /t 1 /nobreak >nul
goto :attente

:pret
set "PAGE=index.html"
if /i "%MODE%"=="ia" set "PAGE=ai-watch.html"
if /i "%MODE%"=="atlas" set "PAGE=atlas.html"
set "URL=http://localhost:%WEB_PORT%/%PAGE%"

echo.
echo  [OK] Tout est pret.
echo.
echo      Jeu            http://localhost:%WEB_PORT%/
echo      Regarder l'IA  http://localhost:%WEB_PORT%/ai-watch.html
echo      Proxy / MCP    http://127.0.0.1:%MCP_PORT%/health
echo.
echo      Consultation en direct : bouton "En direct" dans l'entretien.
echo      Le micro exige Chrome ou Edge.
echo.
echo      Agents IA (Claude Code, etc.) : ajouter le serveur MCP
echo        node "%CD%\mcp-server.js"
echo.
echo      Arreter : lancer_serveur.bat stop
echo.
start "" "%URL%"
endlocal
exit /b 0

rem ---- Tests ----------------------------------------------------------------
:tests
call npm test
set "CODE=%ERRORLEVEL%"
echo.
if "%CODE%"=="0" (echo  [OK] Tous les tests passent.) else (echo  [X] Des tests echouent ^(code %CODE%^).)
pause
endlocal
exit /b %CODE%

rem ---- Arret ----------------------------------------------------------------
:stop
for %%p in (%WEB_PORT% %MCP_PORT%) do (
    for /f "tokens=5" %%i in ('netstat -ano ^| findstr /r /c:"127.0.0.1:%%p .*LISTENING" /c:"0.0.0.0:%%p .*LISTENING"') do (
        taskkill /pid %%i /f >nul 2>nul && echo  [OK] Port %%p libere ^(processus %%i^)
    )
)
endlocal
exit /b 0

rem ---- Utilitaire : errorlevel 1 si le port est deja occupe ---------------
:port_libre
netstat -ano | findstr /r /c:"127.0.0.1:%1 .*LISTENING" /c:"0.0.0.0:%1 .*LISTENING" >nul
if errorlevel 1 (exit /b 0) else (exit /b 1)

:fin_erreur
echo.
pause
endlocal
exit /b 1
