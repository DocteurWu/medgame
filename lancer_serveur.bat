@echo off
echo ====================================
echo Lancement du serveur HTTP sur le port 8080
echo ====================================
echo.
echo Serveur disponible sur : http://localhost:8080
echo.
echo Appuyez sur Ctrl+C pour arrêter le serveur
echo ====================================
echo.

python -m http.server 8080

pause