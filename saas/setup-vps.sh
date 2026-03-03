#!/bin/bash

# OrcBot SaaS VPS Setup Script
# Run this on a fresh Ubuntu 22.04+ machine

echo "🚀 Starting OrcBot SaaS Environment Setup..."

# 1. Update System
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js (Latest LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install Global Tools
sudo npm install -g pm2 typescript ts-node

# 4. Install Chrome/Playwright Dependencies
sudo npx playwright install-deps

# 5. Clone and Setup Project
# Usage: ./setup-vps.sh <repo_url>
if [ -z "$1" ]; then
    echo "⚠️  No repository URL provided. Skipping clone."
else
    git clone "$1" orcbot
    cd orcbot
    npm install
    npx playwright install chromium
fi

echo "✅ Environment Ready!"
echo "Next steps:"
echo "1. Create your .env file with API keys."
echo "2. Run 'pm2 start npx --name saas-api -- ts-node saas/api.ts'"
echo "3. Run 'pm2 start npx --name orcbot -- ts-node src/cli/index.ts agent start'"
echo "4. Build the frontend: 'cd apps/www && npm install && npm run build'"
