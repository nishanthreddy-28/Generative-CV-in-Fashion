$ErrorActionPreference = 'Stop'
$pythonPath = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $pythonPath)) { throw 'Create .venv first; see backend/docs/GETTING_STARTED.md.' }
Push-Location (Join-Path $PSScriptRoot 'backend')
try {
    & $pythonPath -m unittest discover -s tests
    if ($LASTEXITCODE -ne 0) { throw 'Regression tests failed.' }
    & $pythonPath scripts/verify_layout.py
    if ($LASTEXITCODE -ne 0) { throw 'Layout/data checks failed.' }
    node scripts/verify_mobile_client.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Mobile client checks failed.' }
} finally { Pop-Location }
