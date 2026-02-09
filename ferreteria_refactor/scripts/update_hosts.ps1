# Script to Add Local Domains to Hosts File
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$domains = @("ferreteria.localhost", "admin.localhost")
$ip = "127.0.0.1"

# Check if running as Admin
if (!([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "Please run this script as Administrator!" -ForegroundColor Red
    exit
}

$content = Get-Content $hostsPath -Raw
$modified = $false

foreach ($domain in $domains) {
    if ($content -notmatch "$ip\s+$domain") {
        Add-Content -Path $hostsPath -Value "$ip $domain"
        Write-Host "Added $domain" -ForegroundColor Green
        $modified = $true
    } else {
        Write-Host "$domain already exists." -ForegroundColor Yellow
    }
}

if ($modified) {
    Write-Host "Hosts file updated successfully." -ForegroundColor Green
}
