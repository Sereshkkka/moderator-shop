$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Require-Git {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    Write-Host "Git is not installed on this computer." -ForegroundColor Red
    Write-Host "Install Git for Windows: https://git-scm.com/download/win"
    Write-Host "After installation, close this window and run auto-commit.bat again."
    exit 1
  }
}

function Ensure-GitRepo {
  if (Test-Path ".git") {
    return
  }

  Write-Step "First Git setup in the forgit folder"
  git init
  git branch -M main

  $remoteUrl = Read-Host "Paste GitHub HTTPS repo URL, or press Enter to skip push for now"
  if ($remoteUrl.Trim()) {
    git remote add origin $remoteUrl.Trim()
  }
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
    Where-Object { $_.FullName -notmatch '\\.git\\' } |
    Select-String -Pattern $markers -SimpleMatch -List -ErrorAction SilentlyContinue

  if ($conflicts) {
    Write-Host ""
    Write-Host "Git conflict markers were found. Push is blocked to avoid deploying a broken site." -ForegroundColor Red
    $conflicts | ForEach-Object { Write-Host $_.Path }
    Write-Host "Send a screenshot to Codex or replace these files with the clean project files."
    exit 1
  }
}

Push-Location $PSScriptRoot
try {
  Require-Git
  Ensure-GitRepo
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

  $remote = git remote get-url origin 2>$null
  if ($remote) {
    $branch = git branch --show-current
    $pushTarget = $branch
    if (-not $pushTarget) {
      $pushTarget = "HEAD:main"
      Write-Host "Detached HEAD detected. Pushing current commit to main." -ForegroundColor Yellow
    }
    Write-Step "Pushing to GitHub"
    git push -u origin $pushTarget
    if ($LASTEXITCODE -ne 0) {
      Write-Host ""
      Write-Host "Push failed. GitHub has commits that are not in this local folder." -ForegroundColor Red
      Write-Host "Run this command in the forgit folder, then run auto-commit.bat again:"
      Write-Host "git pull --rebase origin main"
      exit 1
    }
    Write-Host ""
    Write-Host "Done. Render should start deploy automatically." -ForegroundColor Green
  } else {
    Write-Host ""
    Write-Host "Commit was created locally, but remote origin is not configured, so push was skipped." -ForegroundColor Yellow
    Write-Host "To add a GitHub repo:"
    Write-Host "git remote add origin https://github.com/USERNAME/REPO.git"
  }
} finally {
  Pop-Location
  Write-Host ""
  Read-Host "Press Enter to close this window"
}
