param(
  [int]$Port = 4173,
  [string]$Root = (Split-Path -Parent $MyInvocation.MyCommand.Path)
)

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

$contentTypes = @{
  '.html' = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = $context.Request.Url.AbsolutePath.TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
    if ($relative -notin @('index.html', 'styles.css', 'app.js')) { $relative = 'index.html' }
    $filePath = Join-Path $Root $relative
    if (-not (Test-Path -LiteralPath $filePath)) {
      $context.Response.StatusCode = 404
      $context.Response.Close()
      continue
    }
    $bytes = [System.IO.File]::ReadAllBytes($filePath)
    $context.Response.ContentType = $contentTypes[[System.IO.Path]::GetExtension($filePath)]
    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    $context.Response.Close()
  }
}
finally {
  $listener.Stop()
  $listener.Close()
}
