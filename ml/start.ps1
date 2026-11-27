param(
    [string]$UserId = 'test_user_3',
    [int]$Port = 8001,
    [ValidateSet('workers','gemini','groq','nvidia','siliconflow')][string]$LlmProvider = 'workers',
    [string]$LlmModel = '',
    [string]$CloudflareAccountId = ''
)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'backend/scripts/start_studio.ps1') @PSBoundParameters
