$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Require-Git {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    $fallback = "C:\Program Files\Git\cmd\git.exe"
    if (Test-Path $fallback) {
      $env:PATH = "C:\Program Files\Git\cmd;$env:PATH"
      return
    }
    Write-Host "Git is not installed on this computer." -ForegroundColor Red
    Write-Host "Install Git for Windows: https://git-scm.com/download/win"
    exit 1
  }
}

function Ensure-GitRepo {
  if (Test-Path ".git") {
    return
  }

  Write-Step "First Git setup in the project root"
  git init
  git branch -M main
}

function Ensure-Remote {
  $remote = git remote get-url origin 2>$null
  if ($remote) {
    return
  }

  $remoteUrl = Read-Host "Paste GitHub HTTPS repo URL"
  if (-not $remoteUrl.Trim()) {
    Write-Host "No GitHub remote configured. Commit can be local only." -ForegroundColor Yellow
    return
  }
  git remote add origin $remoteUrl.Trim()
}

function Ensure-GitIdentity {
  $name = git config user.name
  $email = git config user.email

  if (-not $name) {
    $name = Read-Host "Git commit name"
    if ($name.Trim()) {
      git config user.name $name.Trim()
    }
  }

  if (-not $email) {
    $email = Read-Host "Git commit email"
    if ($email.Trim()) {
      git config user.email $email.Trim()
    }
  }
}

function Stop-OnConflictMarkers {
  $markers = @('<' * 7, '=' * 7, '>' * 7)
  $conflicts = Get-ChildItem -Recurse -File -Force |
    Where-Object {
      $_.FullName -notmatch '\\.git\\' -and
      $_.FullName -notmatch '\\forgit\\' -and
      $_.FullName -notmatch '\\node_modules\\' -and
      $_.FullName -notmatch '\\_snapshots\\'
    } |
    Select-String -Pattern $markers -SimpleMatch -List -ErrorAction SilentlyContinue

  if ($conflicts) {
    Write-Host ""
    Write-Host "Git conflict markers were found. Push is blocked to avoid deploying a broken site." -ForegroundColor Red
    $conflicts | ForEach-Object { Write-Host $_.Path }
    exit 1
  }
}

Push-Location $PSScriptRoot
try {
  Require-Git
  Ensure-GitRepo
  Ensure-Remote
  Ensure-GitIdentity

  Write-Step "Checking changes"
  Stop-OnConflictMarkers
  git add -A

  $changes = git status --porcelain
  if (-not $changes) {
    Write-Host "No changes to commit." -ForegroundColor Yellow
    exit 0
  }

  Write-Host $changes
  $message = Read-Host "Commit message (Enter = Update site)"
  if (-not $message.Trim()) {
    $message = "Update site"
  }

  Write-Step "Creating commit"
  git commit -m $message
  if ($LASTEXITCODE -ne 0) {
    exit 1
  }

  $remote = git remote get-url origin 2>$null
  if ($remote) {
    $branch = git branch --show-current
    if (-not $branch) {
      $branch = "main"
      git switch -C main HEAD
    }

    Write-Step "Pushing to GitHub"
    git push -u origin $branch
    if ($LASTEXITCODE -ne 0) {
      Write-Host ""
      Write-Host "Push failed. Run this command in the project root, then run auto-commit.bat again:" -ForegroundColor Red
      Write-Host "git pull --rebase origin main"
      exit 1
    }
    Write-Host ""
    Write-Host "Done. Render should start deploy automatically." -ForegroundColor Green
  } else {
    Write-Host ""
    Write-Host "Commit was created locally, but remote origin is not configured." -ForegroundColor Yellow
  }
} finally {
  Pop-Location
  Write-Host ""
  Read-Host "Press Enter to close this window"
}
