#!/bin/bash
set -euxo pipefail
exec > >(tee /var/log/mindcircuit-backend-userdata.log) 2>&1
apt-get update -y
apt-get install -y git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g pm2
cd /opt
if [ ! -d mindcircuit-registration-app ]; then
  git clone https://github.com/YOUR_GITHUB_USER/mindcircuit-registration-app.git mindcircuit-registration-app
fi
cd /opt/mindcircuit-registration-app/backend
npm ci --omit=dev || npm install --omit=dev
# Create /opt/mindcircuit-registration-app/backend/.env securely before starting.
# Do NOT put real passwords into launch-template user data or this script.
if [ ! -f .env ]; then
  echo "Missing backend .env. Create it securely, then run: pm2 start src/server.js --name mindcircuit-api"
  exit 1
fi
pm2 start src/server.js --name mindcircuit-api --update-env
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu || true
