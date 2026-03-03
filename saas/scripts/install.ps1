# OrcBot One-Click Installer (Windows)
param (
    [string]$CustomerName,
    [string]$Blueprint,
    [string]$Token,
    [string]$UserId,
    [string]$AgentId
)

Write-Host "`n🚀 Initializing OrcBot Setup for $CustomerName..." -ForegroundColor Cyan

# 1. Dependency Check
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git not found. Please install Git from https://git-scm.com/"
    exit
}
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js not found. Please install Node.js from https://nodejs.org/"
    exit
}

# 2. Clone Repository
$targetDir = Join-Path $HOME "orcbot-apps"
if (!(Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir
}
Set-Location $targetDir

if (Test-Path "orcbot") {
    Write-Host "📂 Repository already exists. Updating..." -ForegroundColor Gray
    Set-Location "orcbot"
    git pull
} else {
    Write-Host "📂 Cloning OrcBot..." -ForegroundColor Gray
    git clone https://github.com/fredabila/orcbot.git
    Set-Location "orcbot"
}

# 3. Install Dependencies
Write-Host "📦 Installing dependencies (this may take a minute)..." -ForegroundColor Gray
npm install

# 4. Provision Agent
Write-Host "⚙️  Configuring your personalized $Blueprint agent..." -ForegroundColor Gray
npx ts-node saas/provision.ts --customer "$CustomerName" --blueprint "$Blueprint" --token "$Token" --id "$UserId"

# 5. Start Agent
Write-Host "`n✅ SETUP COMPLETE!" -ForegroundColor Green
Write-Host "Your agent is ready. Starting now..." -ForegroundColor Cyan
npx ts-node src/cli/index.ts agent start $AgentId
