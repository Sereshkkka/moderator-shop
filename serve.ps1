$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 4174)
$listener.Start()

function Get-ContentType($path) {
    switch ([System.IO.Path]::GetExtension($path).ToLowerInvariant()) {
        '.html' { return 'text/html; charset=utf-8' }
        '.css'  { return 'text/css; charset=utf-8' }
        '.js'   { return 'application/javascript; charset=utf-8' }
        '.json' { return 'application/json; charset=utf-8' }
        '.png'  { return 'image/png' }
        '.jpg'  { return 'image/jpeg' }
        '.jpeg' { return 'image/jpeg' }
        '.svg'  { return 'image/svg+xml' }
        default { return 'application/octet-stream' }
    }
}

function Write-Response($stream, $statusCode, $statusText, $contentType, [byte[]]$body) {
    $headerText = "HTTP/1.1 $statusCode $statusText`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headerText)
    $stream.Write($headerBytes, 0, $headerBytes.Length)
    $stream.Write($body, 0, $body.Length)
    $stream.Flush()
}

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                $client.Close()
                continue
            }

            while ($reader.ReadLine()) { }

            $parts = $requestLine.Split(' ')
            $rawPath = if ($parts.Length -ge 2) { $parts[1] } else { '/' }
            $rawPath = $rawPath.Split('?')[0]
            $relativePath = $rawPath.TrimStart('/')
            if ([string]::IsNullOrWhiteSpace($relativePath)) {
                $relativePath = 'index.html'
            }

            $safePath = $relativePath -replace '/', '\'
            $fullPath = Join-Path $root $safePath

            if ((-not (Test-Path -LiteralPath $fullPath -PathType Leaf)) -or (-not $fullPath.StartsWith($root))) {
                $body = [System.Text.Encoding]::UTF8.GetBytes('Not Found')
                Write-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $body
            } else {
                $body = [System.IO.File]::ReadAllBytes($fullPath)
                $contentType = Get-ContentType $fullPath
                Write-Response $stream 200 'OK' $contentType $body
            }
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
