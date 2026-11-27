param([string]$UserId = 'test_user_3', [int]$Port = 8001,
    [ValidateSet('gemini', 'groq', 'workers', 'nvidia', 'siliconflow')][string]$LlmProvider = 'workers',
    [string]$LlmModel = '',
    [switch]$WorkersAI, [string]$CloudflareAccountId = '')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:PHASE3_DEV_USER_ID = $UserId
if (-not $env:PHASE3_TRYON_PROVIDER) { $env:PHASE3_TRYON_PROVIDER = 'weshop' }
$env:PHASE3_LLM_PROVIDER = $LlmProvider
if ($LlmModel) {
    switch ($LlmProvider) {
        'gemini' { $env:PHASE3_GEMINI_MODEL = $LlmModel }
        'groq' { $env:PHASE3_GROQ_MODEL = $LlmModel }
        'workers' { $env:PHASE3_WORKERS_MODEL = $LlmModel }
        'nvidia' { $env:PHASE3_NVIDIA_MODEL = $LlmModel }
        'siliconflow' { $env:PHASE3_SILICONFLOW_MODEL = $LlmModel }
    }
}
if ($WorkersAI -or $LlmProvider -eq 'workers') {
    if ($CloudflareAccountId) { $env:CLOUDFLARE_ACCOUNT_ID = $CloudflareAccountId }
    if (-not $env:CLOUDFLARE_ACCOUNT_ID) { $env:CLOUDFLARE_ACCOUNT_ID = Read-Host 'Cloudflare account ID' }
    if ($env:CLOUDFLARE_ACCOUNT_ID -notmatch '^[a-fA-F0-9]{32}$') { throw 'Cloudflare account ID must contain 32 hexadecimal characters.' }
    if (-not $env:CLOUDFLARE_API_TOKEN) {
        $cloudflareSecureToken = Read-Host 'Paste Workers AI API token (hidden, session only)' -AsSecureString
        $cloudflareTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($cloudflareSecureToken)
        try {
            $env:CLOUDFLARE_API_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($cloudflareTokenPointer)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($cloudflareTokenPointer)
            $cloudflareSecureToken.Dispose()
        }
    }
    if (-not $env:CLOUDFLARE_API_TOKEN) { throw 'A Workers AI API token is required.' }
    Write-Output 'Cloudflare Workers AI credentials configured. Keep the account on Workers Free for the free quota.'
}
if ($LlmProvider -in @('nvidia','siliconflow')) {
    if ($LlmProvider -eq 'siliconflow' -and $env:SILICONFLOW_FREE_TEST_CONFIRMED -ne '1') {
        $stylistFreeConfirmation = Read-Host 'Verify model free access/credits and disable postpaid billing. Type YES to confirm a zero-cost test'
        if ($stylistFreeConfirmation -cne 'YES') { throw 'SiliconFlow was not enabled because zero-cost access is unconfirmed.' }
        $env:SILICONFLOW_FREE_TEST_CONFIRMED = '1'
    }
    $stylistTokenName = if ($LlmProvider -eq 'nvidia') { 'NVIDIA_API_KEY' } else { 'SILICONFLOW_API_KEY' }
    if (-not [Environment]::GetEnvironmentVariable($stylistTokenName,'Process')) {
        $stylistSecureToken = Read-Host "$LlmProvider API token (hidden, session only)" -AsSecureString
        $stylistTokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($stylistSecureToken)
        try {
            [Environment]::SetEnvironmentVariable($stylistTokenName,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($stylistTokenPointer),'Process')
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($stylistTokenPointer)
            $stylistSecureToken.Dispose()
        }
    }
}
if ($LlmProvider -eq 'groq') {
    if (-not $env:GROQ_API_KEY) {
        $env:GROQ_API_KEY = [Environment]::GetEnvironmentVariable('GROQ_API_KEY', 'User')
    }
    if (-not $env:GROQ_API_KEY) {
        $groqSecureKey = Read-Host 'Paste your Groq API key (hidden, session only)' -AsSecureString
        $groqKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($groqSecureKey)
        try {
            $env:GROQ_API_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($groqKeyPointer)
        } finally {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($groqKeyPointer)
            $groqSecureKey.Dispose()
        }
    }
    if (-not $env:GROQ_API_KEY) { throw 'GROQ_API_KEY is required for Groq.' }
    if (-not $env:PHASE3_GROQ_MODEL) { $env:PHASE3_GROQ_MODEL = 'qwen/qwen3.8-27b' }
}
if ($LlmProvider -eq 'gemini' -and -not $env:GEMINI_API_KEY) {
    $env:GEMINI_API_KEY = [Environment]::GetEnvironmentVariable('GEMINI_API_KEY', 'User')
}
if ($LlmProvider -eq 'gemini' -and -not $env:GEMINI_API_KEY) {
    Write-Warning 'GEMINI_API_KEY is missing. Recommendations will report that Gemini needs configuration; no local LLM fallback will be used.'
}
if (-not $env:PHASE3_GEMINI_MODEL) { $env:PHASE3_GEMINI_MODEL = 'gemini-3.6-flash' }
Write-Output "Opening local studio for $UserId on http://127.0.0.1:$Port"
Write-Output "Stylist provider: $LlmProvider"
& '../.venv/Scripts/python.exe' -m uvicorn app.main:app --host 127.0.0.1 --port $Port --reload --reload-dir app
