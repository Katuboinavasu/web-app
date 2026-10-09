# AWS deployment guide (EC2 + RDS + Route 53 + ACM/HTTPS)

This guide assumes Ubuntu 22.04/24.04 EC2, a VPC with private RDS connectivity, and your own domain. Replace every `YOUR_*` placeholder.

## 0. Immediately secure the credentials previously pasted
1. AWS Console → RDS → Databases → select your database → **Modify**.
2. Change the master password to a new unique password and apply the change. Do not put the password in GitHub, screenshots, or user data.
3. Use a separate application database user for this project, not the RDS master user.
4. If the old password was used elsewhere, rotate it there too.

## 1. Create the database
1. RDS → Databases → select your MySQL instance. Keep **Public access: No**.
2. Note its real RDS endpoint hostname, DB port `3306`, and DB name. Do not use a made-up hostname such as `book.rds.com` unless that is genuinely your DNS record.
3. Security groups:
   - `frontend-sg`: inbound TCP 80 from your ALB or, for a temporary lab only, your IP.
   - `backend-sg`: inbound TCP 5000 **only from frontend-sg** (or from the ALB/backend caller SG if architecture differs); SSH 22 only from your IP.
   - `rds-sg`: inbound TCP 3306 **only from backend-sg**.
   - Prefer an internet-facing ALB for public web traffic, with EC2 instances private. For a simple lab, if frontend EC2 is public, restrict SSH to your IP.
4. From a machine that can connect to RDS, create schema:
   ```bash
   mysql -h YOUR_RDS_ENDPOINT -P 3306 -u YOUR_DB_ADMIN -p < backend/schema.sql
   ```
   Or open the schema file and run it in MySQL Workbench/CloudShell with connectivity to the database.
5. Create a least-privilege app user (run as DB administrator; substitute a unique password securely):
   ```sql
   CREATE USER 'mindcircuit_app'@'%' IDENTIFIED BY 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
   GRANT SELECT, INSERT, UPDATE, DELETE ON mindcircuit.* TO 'mindcircuit_app'@'%';
   FLUSH PRIVILEGES;
   ```
   Network restrictions are still enforced by the RDS security group.

## 2. Put code in your GitHub repository
1. Unzip this project and create a new GitHub repository, e.g. `mindcircuit-registration-app`.
2. Upload the project files. Never upload `.env`, passwords, JWT secrets, or AWS credentials.
3. Update both user-data scripts to your real repository URL.
4. In `deploy/frontend-userdata.sh`, replace `https://YOUR_API_DOMAIN` with the backend's final HTTPS URL, e.g. `https://api.yourdomain.com`. The frontend URL is compiled into the JavaScript at build time, so rebuild/relaunch or rebuild/copy the frontend after changing it.

## 3. Launch backend EC2
1. Launch Ubuntu EC2 in a subnet that can reach RDS. Attach `backend-sg`.
2. In the launch template user data, paste `deploy/backend-userdata.sh`.
3. Before starting the PM2 process, create `/opt/mindcircuit-registration-app/backend/.env` securely. Example:
   ```bash
   sudo nano /opt/mindcircuit-registration-app/backend/.env
   ```
   Paste values (not these placeholders):
   ```dotenv
   NODE_ENV=production
   PORT=5000
   DB_HOST=YOUR_REAL_RDS_ENDPOINT
   DB_PORT=3306
   DB_NAME=mindcircuit
   DB_USER=mindcircuit_app
   DB_PASSWORD=YOUR_NEW_APP_USER_PASSWORD
   JWT_SECRET=PASTE_A_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
   FRONTEND_ORIGIN=https://YOUR_FRONTEND_DOMAIN
   ```
4. Protect the file and set ownership to the EC2 login user:
   ```bash
   sudo chown ubuntu:ubuntu /opt/mindcircuit-registration-app/backend/.env
   sudo chmod 600 /opt/mindcircuit-registration-app/backend/.env
   cd /opt/mindcircuit-registration-app/backend
   npm install --omit=dev
   pm2 start src/server.js --name mindcircuit-api
   pm2 save
   pm2 startup
   ```
   Follow the exact command printed by `pm2 startup`, if any.
5. Verify locally on backend EC2:
   ```bash
   curl http://127.0.0.1:5000/api/health
   ```
   Expected when DB/network/credentials are correct: `{"status":"ok","database":"connected"}`.
6. For production, put the backend behind an HTTPS ALB or reverse proxy and use a valid certificate. Do not expose port 5000 to `0.0.0.0/0`.

> Launch-template user data runs as root on first boot. A script cannot magically know your database password. The included script deliberately stops if `.env` is missing. For repeatable Auto Scaling deployments, use AWS Secrets Manager + an EC2 instance role and fetch the secret at boot, or bake a secure configuration-management step into your deployment.

## 4. Launch frontend EC2
1. Launch Ubuntu EC2 with `frontend-sg`; paste `deploy/frontend-userdata.sh` as user data.
2. Replace the GitHub URL and API URL in the script before launching.
3. Allow HTTP 80 from the ALB. For direct temporary testing only, allow 80 from your IP.
4. Once the instance finishes booting, open its public address (or the ALB DNS name). Check `/var/log/mindcircuit-frontend-userdata.log` if it fails.

## 5. Domain and HTTPS
Recommended: Route 53 points `mindcircuit.com` (or your domain) to an internet-facing ALB; ACM certificate is attached to the ALB listener on 443.
- Frontend DNS: `mindcircuit.com` → frontend ALB.
- API DNS: `api.mindcircuit.com` → backend ALB/listener.
- Backend `.env`: `FRONTEND_ORIGIN=https://mindcircuit.com`.
- Frontend `.env`: `VITE_API_BASE_URL=https://api.mindcircuit.com`.
- Backend security group permits 5000 from the backend ALB security group, not the whole internet.
- ALB security group permits 443 from the internet. Redirect HTTP 80 to HTTPS.
If you use one ALB for both, configure path-based routing (`/api/*` to backend, other paths to frontend) and update the frontend API base URL accordingly. Rebuild the frontend after changing `.env`.

## 6. Test the app
1. Open the frontend HTTPS URL.
2. Register a test account with name, email, phone, work status, and password.
3. You should be redirected to the dashboard and see the registered member table.
4. Log out, then log in with the same email/password.
5. Register a second test account in another browser/private window. Once signed in, both accounts should appear in the shared table.
6. A user can edit/delete only their own row. Passwords are never shown in the table.
7. Check backend health endpoint and logs:
   ```bash
   pm2 status
   pm2 logs mindcircuit-api --lines 100
   ```

## Troubleshooting
- **Frontend loads but registration fails:** Check `VITE_API_BASE_URL`, CORS `FRONTEND_ORIGIN`, backend health endpoint, ALB listeners, and security groups.
- **502/504 from ALB:** Verify backend process is listening on `0.0.0.0:5000`, target group health path `/api/health`, target port 5000, and the target SG allows traffic from ALB SG.
- **Database timeout:** Verify backend subnet route/connectivity and RDS SG allows 3306 from backend SG.
- **Access denied:** Check DB username/password and grants. Don't use RDS master user in app config.
- **Duplicate email:** Use the Login link rather than registering the same email again.
- **Changes don't show:** Frontend is a built static app. Run `npm run build` and copy the new `dist/` files to `/var/www/mindcircuit`.
- **PM2 doesn't restart after reboot:** Run `pm2 startup`, follow its printed command, then `pm2 save`.
