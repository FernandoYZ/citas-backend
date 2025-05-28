@echo off
echo === Script de inicio de aplicacion SIHCE-CITAS ===

:: Espera unos segundos para que el sistema esté listo
echo Iniciando en 5 segundos...
timeout /t 5 /nobreak > NUL

:: ===============================
:: 1. Iniciar Backend con PM2 en una ventana
:: ===============================
echo Iniciando backend con PM2 en una ventana dedicada...
start "SIHCE Backend" cmd /k "cd /d C:\Users\citas\Desktop\sihce-citas\citas-backend && (echo Verificando si existe el proceso citas... && pm2 list | findstr citas && echo El proceso citas existe, reiniciando... && pm2 restart citas && pm2 logs citas || echo No se encontró el proceso citas, iniciando... && pm2 start src/server.js --name citas && pm2 save && pm2 logs citas)"

:: Pequeña pausa para asegurar que el backend se inicia primero
timeout /t 2 /nobreak > NUL

:: ===============================
:: 2. Iniciar Frontend en otra ventana
:: ===============================
echo Iniciando frontend en una ventana dedicada...
start "SIHCE Frontend" cmd /k "cd /d C:\Users\citas\Desktop\sihce-citas\citas-frontend && (echo Iniciando frontend... && pnpm preview || echo Modo preview falló, usando modo desarrollo && pnpm dev)"

echo Sistema iniciado correctamente.
echo Se han abierto dos ventanas separadas:
echo  - Una para el Backend con logs de PM2
echo  - Otra para el Frontend
echo.
echo Para cerrar todo el sistema, cierra las ventanas y ejecuta: pm2 stop all