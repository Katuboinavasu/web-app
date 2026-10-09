#!/bin/bash
set -euxo pipefail
exec > >(tee /var/log/mindcircuit-frontend-userdata.log) 2>&1
apt-get update -y
apt-get install -y nginx git curl
# Node is needed only to build the React frontend on this instance.
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
cd /opt
if [ ! -d mindcircuit-registration-app ]; then
  git clone https://github.com/YOUR_GITHUB_USER/mindcircuit-registration-app.git mindcircuit-registration-app
fi
cd /opt/mindcircuit-registration-app/frontend
# Replace with your HTTPS API URL (for example, https://api.example.com).
echo 'VITE_API_BASE_URL=https://YOUR_API_DOMAIN' > .env
npm ci || npm install
npm run build
mkdir -p /var/www/mindcircuit
cp -r dist/. /var/www/mindcircuit/
cat >/etc/nginx/sites-available/mindcircuit <<'NGINX'
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;
  root /var/www/mindcircuit;
  index index.html;
  location / { try_files $uri $uri/ /index.html; }
  location ~* \.(js|css|png|jpg|svg|ico|woff2)$ { expires 7d; add_header Cache-Control "public"; }
}
NGINX
rm -f /etc/nginx/sites-enabled/default
ln -sfn /etc/nginx/sites-available/mindcircuit /etc/nginx/sites-enabled/mindcircuit
nginx -t
systemctl enable --now nginx
systemctl reload nginx
