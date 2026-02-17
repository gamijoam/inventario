Write-Host "Iniciando compilacion..."

$projectPath = "Invensoft_Windows_Bridge.csproj"
$outputDir = "dist_v7"

if (Test-Path $outputDir) {
    Remove-Item -Path $outputDir -Recurse -Force
}

Write-Host "Compilando..."
dotnet publish $projectPath -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o $outputDir

if ($LASTEXITCODE -eq 0) {
    Write-Host "EXITO: Archivo generado en dist/Invensoft_Windows_Bridge.exe" -ForegroundColor Green
    Invoke-Item $outputDir
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR en la compilacion." -ForegroundColor Red
}
