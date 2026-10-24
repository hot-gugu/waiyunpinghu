$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$siteUrl = 'http://127.0.0.1:8766/'
try { $service = Invoke-RestMethod ($siteUrl + '__prototype_annotations') -TimeoutSec 2 } catch { $service = $null }
if ($service.service -ne 'sinotrans-prototype-annotations') {
    $pythonExe = (Get-Command python -ErrorAction Stop).Source
    Start-Process -FilePath $pythonExe -ArgumentList @('"' + (Join-Path $PSScriptRoot 'prototype-local-server.py') + '"') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        Start-Sleep -Milliseconds 200
        try { $service = Invoke-RestMethod ($siteUrl + '__prototype_annotations') -TimeoutSec 1; if ($service.service -eq 'sinotrans-prototype-annotations') { break } } catch {}
    }
}
if ($service.service -ne 'sinotrans-prototype-annotations') { throw '原型服务启动失败，请检查 8766 端口是否被占用。' }
Start-Process ($siteUrl + [Uri]::EscapeDataString('方案图册.html'))
