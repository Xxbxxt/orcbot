#!/bin/bash

# OrcBot One-Click Installer (Linux/macOS)
CUSTOMER_NAME=$1
BLUEPRINT=$2
TOKEN=$3
USER_ID=$4
AGENT_ID=$5

echo -e "
🚀 Initializing OrcBot Setup for $CUSTOMER_NAME..."

# 1. Dependency Check
if ! [ -x "$(command -v git)" ]; then
  echo '❌ Error: git is not installed.' >&2
  exit 1
fi
if ! [ -x "$(command -v node)" ]; then
  echo '❌ Error: node is not installed.' >&2
  exit 1
fi

# 2. Clone Repository
mkdir -p $HOME/orcbot-apps
cd $HOME/orcbot-apps

if [ -d "orcbot" ]; then
  echo "📂 Repository already exists. Updating..."
  cd orcbot
  git pull
else
  echo "📂 Cloning OrcBot..."
  git clone https://github.com/fredabila/orcbot.git
  cd orcbot
fi

# 3. Install Dependencies
echo "📦 Installing dependencies (this may take a minute)..."
npm install

# 4. Provision Agent
echo "⚙️  Configuring your personalized $BLUEPRINT agent..."
npx ts-node saas/provision.ts --customer "$CUSTOMER_NAME" --blueprint "$BLUEPRINT" --token "$TOKEN" --id "$USER_ID"

# 5. Start Agent
echo -e "
✅ SETUP COMPLETE!"
echo "Your agent is ready. Starting now..."
npx ts-node src/cli/index.ts agent start $AGENT_ID
