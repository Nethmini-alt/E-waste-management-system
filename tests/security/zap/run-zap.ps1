<#
  G3 — runs the two OWASP ZAP scans (TC-SEC-007 API scan, TC-SEC-008 web baseline) headless,
  using ZAP's automation framework. Reports go to docs/testing/evidence/security.

  Before running:
    1. Terminal 1 (test API, keeps the E2E admin account):
         cd frontend-react/project;  $env:E2E_KEEP_DB = "1";  node e2e/scripts/start-api.mjs
    2. Terminal 2 (production build of the web app):
         cd frontend-react/project;  $env:VITE_API_BASE_URL = "http://localhost:5180"
         npm run build;  npx vite preview --port 5175 --strictPort
    3. ZAP 2.17+ (needs Java 17+): installer or the "Crossplatform" zip from https://www.zaproxy.org/download/

  Usage (from the repo root):
    .\tests\security\zap\run-zap.ps1 -ZapBat "C:\Program Files\ZAP\Zed Attack Proxy\zap.bat"
#>
param(
  [Parameter(Mandatory = $true)] [string] $ZapBat,
  [string] $ApiUrl = "http://localhost:5180",
  [string] $AdminEmail = "e2e.admin@ewaste.test",
  [string] $AdminPassword = "E2eAdmin#2026"
)

$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = Resolve-Path (Join-Path $here "..\..\..")
$reportDir = Join-Path $repo "docs\testing\evidence\security"
New-Item -ItemType Directory -Force $reportDir | Out-Null

# Admin token so the API scan reaches protected endpoints. Never written to disk.
$body = @{ email = $AdminEmail; password = $AdminPassword } | ConvertTo-Json
$env:ZAP_AUTH_TOKEN = (Invoke-RestMethod -Method Post -Uri "$ApiUrl/api/auth/login" -ContentType "application/json" -Body $body).token
$env:ZAP_REPORT_DIR = $reportDir

# A throw-away ZAP home folder, so personal ZAP settings never affect the result.
$zapHome = Join-Path $env:TEMP "zap-ewaste-$(Get-Date -Format yyyyMMddHHmmss)"

# zap.bat must run from its own folder (it starts the jar by a relative path), and ZAP writes
# normal progress to stderr, which Windows PowerShell would otherwise treat as an error.
$ErrorActionPreference = "Continue"
Push-Location (Split-Path -Parent (Resolve-Path $ZapBat))
try {
  foreach ($plan in "zap-api-scan.yaml", "zap-web-baseline.yaml") {
    Write-Host "`n=== ZAP: $plan ===" -ForegroundColor Cyan
    & $ZapBat -cmd -dir $zapHome -port 8095 -autorun (Join-Path $here $plan) 2>&1 | ForEach-Object { "$_" }
    if ($LASTEXITCODE -ne 0) { Write-Warning "$plan finished with exit code $LASTEXITCODE (see the output above)" }
  }
} finally {
  Pop-Location
}

Remove-Item Env:ZAP_AUTH_TOKEN
Write-Host "`nReports written to $reportDir" -ForegroundColor Green
