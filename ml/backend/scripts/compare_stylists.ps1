param(
    [ValidateSet('gemini','workers','nvidia','siliconflow')][string[]]$Providers = @('gemini','workers','nvidia'),
    [string]$CloudflareAccountId = '',
    [switch]$Smoke,
    [ValidateRange(30,300)][int]$NvidiaTimeoutSeconds = 180
)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

function Read-PrivateComparisonToken([string]$Name, [string]$Label) {
    if ([Environment]::GetEnvironmentVariable($Name, 'Process')) { return }
    Write-Host "${Label}: press Enter to skip if the account is not ready."
    $comparisonSecureToken = Read-Host "$Label API token (hidden, session only)" -AsSecureString
    $comparisonTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($comparisonSecureToken)
    try {
        $comparisonPlainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($comparisonTokenPointer)
        if ($comparisonPlainToken) { [Environment]::SetEnvironmentVariable($Name, $comparisonPlainToken, 'Process') }
    } finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($comparisonTokenPointer)
        $comparisonSecureToken.Dispose()
        $comparisonPlainToken = $null
    }
}

Write-Host 'This runs up to six HTTP attempts per model using synthetic requests and official public demo photos.'
Write-Host 'Use Gemini Free and Workers Free. No app default is changed. No wardrobe photos are sent.'
foreach ($provider in $Providers) {
    switch ($provider) {
        'gemini' { Read-PrivateComparisonToken 'GEMINI_API_KEY' 'Gemini' }
        'workers' {
            Read-PrivateComparisonToken 'CLOUDFLARE_API_TOKEN' 'Cloudflare Workers AI'
            if ($env:CLOUDFLARE_API_TOKEN) {
                if ($CloudflareAccountId) { $env:CLOUDFLARE_ACCOUNT_ID = $CloudflareAccountId }
                if (-not $env:CLOUDFLARE_ACCOUNT_ID) { $env:CLOUDFLARE_ACCOUNT_ID = Read-Host 'Cloudflare account ID' }
            }
        }
        'nvidia' { Read-PrivateComparisonToken 'NVIDIA_API_KEY' 'NVIDIA Build (hosted prototyping key)' }
        'siliconflow' {
            if ($env:SILICONFLOW_FREE_TEST_CONFIRMED -ne '1') {
                Write-Host 'SiliconFlow tests Qwen/Qwen3-VL-8B-Instruct on the international API.'
                Write-Host 'Check that your free access/credits cover this test and that postpaid billing is disabled.'
                $comparisonFreeAccess = Read-Host 'Have you verified zero-cost access for this test? Type YES, or Enter to skip'
                if ($comparisonFreeAccess -ceq 'YES') { $env:SILICONFLOW_FREE_TEST_CONFIRMED = '1' }
            }
            if ($env:SILICONFLOW_FREE_TEST_CONFIRMED -eq '1') { Read-PrivateComparisonToken 'SILICONFLOW_API_KEY' 'SiliconFlow' }
        }
    }
}
$comparisonArguments = @('scripts/compare_stylists.py', '--live', '--nvidia-timeout-seconds', "$NvidiaTimeoutSeconds", '--providers') + $Providers
if ($Smoke) { $comparisonArguments += '--smoke' }
& '../.venv/Scripts/python.exe' @comparisonArguments
$comparisonExitCode = $LASTEXITCODE
Write-Host 'Results are under backend/storage/stylist-comparison. No tokens were written to disk.'
exit $comparisonExitCode
