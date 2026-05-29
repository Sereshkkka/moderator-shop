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

Push-Location $PSScriptRoot
try {
  Require-Git
  Ensure-GitRepo
  Ensure-GitIdentity

  Write-Step "Checking changes"
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
    Write-Step "Pushing to GitHub"
    git push -u origin $branch
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
