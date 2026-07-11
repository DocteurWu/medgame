@echo off
echo ====================================
echo Lancement des serveurs MedGame
echo ====================================
echo.
echo 1. Lancement du serveur MCP et WebSocket sur le port 8081...
start "MedGame MCP Server" cmd /k "node mcp-server.js"
echo.
echo 2. Lancement du serveur Web local sur le port 8080...
echo Serveur disponible sur : http://localhost:8080
echo.
echo Pour regarder l'IA jouer en 3D, ouvrez :
echo http://localhost:8080/ai-watch.html
echo.
echo Appuyez sur Ctrl+C dans chaque fenetre pour arreter.
echo ====================================
echo.

python -m http.server 8080

pause