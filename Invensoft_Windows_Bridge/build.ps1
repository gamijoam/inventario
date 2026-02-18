Write-Host "Iniciando compilacion..."

$projectPath = "Invensoft_Windows_Bridge.csproj"
$outputDir = "dist_v5"

if (Test-Path $outputDir) {
    Remove-Item -Path $outputDir -Recurse -Force
}

Write-Host "Compilando..."
dotnet publish $projectPath -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $outputDir

if ($LASTEXITCODE -eq 0) {
    Write-Host "EXITO: Archivo generado en $outputDir\ConexionImpresora.exe" -ForegroundColor Green
    
    # Copy to frontend public folder for download
    $frontendPath = "..\ferreteria_refactor\frontend_web\public\downloads"
    if (!(Test-Path $frontendPath)) {
        New-Item -ItemType Directory -Force -Path $frontendPath
    }
    
    Copy-Item "$outputDir\ConexionImpresora.exe" -Destination "$frontendPath\ConexionImpresora.exe" -Force
    Write-Host "Copiado a la carpeta de descargas del Frontend: $frontendPath" -ForegroundColor Cyan
    
    Invoke-Item $outputDir
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR en la compilacion." -ForegroundColor Red
}
