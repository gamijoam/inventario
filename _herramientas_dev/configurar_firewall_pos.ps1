# ============================================
# SCRIPT DE CONFIGURACIÓN DE FIREWALL - POS
# Ejecutar como Administrador
# ============================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CONFIGURANDO FIREWALL PARA SISTEMA POS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Abrir Puerto 8000 (Backend FastAPI)
Write-Host "[1/4] Abriendo puerto 8000 (FastAPI Backend)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "POS - FastAPI Backend (8000)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 8000 `
    -Action Allow `
    -Profile Any `
    -Enabled True `
    -Description "Permite conexiones al backend FastAPI del sistema POS"

# 2. Abrir Puerto 5173 (Frontend Vite)
Write-Host "[2/4] Abriendo puerto 5173 (Vite Frontend)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "POS - Vite Frontend (5173)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 5173 `
    -Action Allow `
    -Profile Any `
    -Enabled True `
    -Description "Permite conexiones al frontend Vite del sistema POS"

# 3. Abrir Puerto 5432 (PostgreSQL)
Write-Host "[3/4] Abriendo puerto 5432 (PostgreSQL)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "POS - PostgreSQL Database (5432)" `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort 5432 `
    -Action Allow `
    -Profile Any `
    -Enabled True `
    -Description "Permite conexiones a la base de datos PostgreSQL"

# 4. Habilitar ICMP (Ping)
Write-Host "[4/4] Habilitando ICMP (Ping)..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "POS - ICMP Ping (IPv4)" `
    -Direction Inbound `
    -Protocol ICMPv4 `
    -IcmpType 8 `
    -Action Allow `
    -Profile Any `
    -Enabled True `
    -Description "Permite responder a pings para pruebas de conectividad"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ FIREWALL CONFIGURADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Puertos abiertos:" -ForegroundColor White
Write-Host "  - 8000 (FastAPI Backend)" -ForegroundColor Gray
Write-Host "  - 5173 (Vite Frontend)" -ForegroundColor Gray
Write-Host "  - 5432 (PostgreSQL)" -ForegroundColor Gray
Write-Host "  - ICMP (Ping habilitado)" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona cualquier tecla para salir..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
