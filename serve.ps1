# Servidor estatico simples para desenvolvimento local.
# Uso:  powershell -ExecutionPolicy Bypass -File serve.ps1
param([int]$Port = 5173)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "KarlaReg em http://localhost:$Port/  (Ctrl+C para parar)"

$tipos = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.svg'  = 'image/svg+xml'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.webp' = 'image/webp'
  '.ico'  = 'image/x-icon'
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $rel = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
    $path = Join-Path $root ($rel -replace '/', '\')

    # HEAD recebe apenas os cabecalhos; enviar corpo quebra a resposta.
    $semCorpo = ($ctx.Request.HttpMethod -eq 'HEAD')

    if (Test-Path $path -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = $(if ($tipos.ContainsKey($ext)) { $tipos[$ext] } else { 'application/octet-stream' })
      $bytes = [System.IO.File]::ReadAllBytes($path)
      $ctx.Response.ContentLength64 = $bytes.Length
      if (-not $semCorpo) { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
    } else {
      $ctx.Response.StatusCode = 404
      $ctx.Response.ContentType = 'text/plain; charset=utf-8'
      $b = [System.Text.Encoding]::UTF8.GetBytes('404')
      $ctx.Response.ContentLength64 = $b.Length
      if (-not $semCorpo) { $ctx.Response.OutputStream.Write($b, 0, $b.Length) }
    }
    $ctx.Response.Close()
  } catch {
    Write-Host $_.Exception.Message
  }
}
