param([switch]$Restart)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$logs = Join-Path $root '.integration/logs'
$statePath = Join-Path $root '.integration/services.json'
New-Item -ItemType Directory -Path $logs -Force | Out-Null
$apiDir = Join-Path $root 'backend'
$mlDir = Join-Path $root 'ml/backend'
$mobileDir = Join-Path $root 'mobile'
$nodeCandidates = @()
$installed = Get-Command node -ErrorAction SilentlyContinue
if ($installed) { $nodeCandidates += $installed.Source }
$nodeCandidates += @(Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'npm-cache/_npx/*/node_modules/node/bin/node.exe') -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName)
$node24 = $null
foreach ($candidate in $nodeCandidates) {
    if ((& $candidate --version) -match '^v24\.') { $node24 = $candidate; break }
}
if (-not $node24) { throw 'Node 24 is required. Install it before starting this application.' }
$services = @(
    @{ Name='api'; Port=8000; Folder=$apiDir; Binary=(Join-Path $apiDir '.venv/Scripts/python.exe'); Args=@('-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8000','--env-file','.env','--no-access-log'); Marker='app.main:app' },
    @{ Name='ml'; Port=8090; Folder=$mlDir; Binary=(Join-Path $root 'ml/.venv/Scripts/python.exe'); Args=@('-m','uvicorn','integration_worker.main:app','--host','127.0.0.1','--port','8090','--env-file','.env','--no-access-log'); Marker='integration_worker.main:app' },
    @{ Name='web'; Port=8081; Folder=$mobileDir; Binary=$node24; Args=@('node_modules/expo/bin/cli','start','--web','--localhost','--port','8081','--clear'); Marker='expo/bin/cli' }
)
$previous = @()
if (Test-Path -LiteralPath $statePath) { $previous = @(Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json) }
$started = @()
# Enable Metro file watching so source changes reach the browser.
Remove-Item Env:CI -ErrorAction SilentlyContinue
$env:EXPO_NO_TELEMETRY = '1'
$env:PATH = (Split-Path $node24 -Parent) + [IO.Path]::PathSeparator + $env:PATH
foreach ($service in $services) {
    if (-not (Test-Path -LiteralPath $service.Binary)) { throw ('Missing runtime for ' + $service.Name) }
    if (-not (Test-Path -LiteralPath (Join-Path $service.Folder '.env'))) { throw ('Missing environment file for ' + $service.Name) }
    $entry = $previous | Where-Object { $_.Name -eq $service.Name } | Select-Object -First 1
    if ($Restart -and $entry) {
        $process = Get-CimInstance Win32_Process -Filter ("ProcessId=" + [int]$entry.Pid) -ErrorAction SilentlyContinue
        if ($process -and ($process.CommandLine -replace '\\','/') -like ('*' + $service.Marker + '*') -and ($process.CommandLine -replace '\\','/') -like ('*' + $service.Port + '*')) {
            Stop-Process -Id ([int]$entry.Pid) -ErrorAction Stop
            for ($attempt=0; $attempt -lt 20; $attempt++) {
                if (-not (Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue)) { break }
                Start-Sleep -Milliseconds 100
            }
        }
    }
    $listener = Get-NetTCPConnection -State Listen -LocalPort $service.Port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($listener) {
        Write-Output ($service.Name + ' already has a listener on port ' + $service.Port)
        if ($entry -and [int]$entry.Pid -eq $listener.OwningProcess) { $started += $entry }
        continue
    }
    $process = Start-Process -FilePath $service.Binary -ArgumentList $service.Args -WorkingDirectory $service.Folder -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $logs ($service.Name + '.out.log')) -RedirectStandardError (Join-Path $logs ($service.Name + '.err.log'))
    $started += [pscustomobject]@{ Name=$service.Name; Pid=$process.Id }
    Write-Output ('Started ' + $service.Name + ' on port ' + $service.Port)
}
ConvertTo-Json -InputObject @($started) | Set-Content -LiteralPath $statePath -Encoding utf8
Write-Output 'Web application: http://localhost:8081'
Write-Output 'ML models warm up on CPU after launch. Database setup is a separate deployment step.'

