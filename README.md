# MindCircuit Registration Portal (React + Node.js + MySQL)

A starter three-tier application with registration, login, a shared registrant table, and owner-only update/delete actions.

## Important security notes
- The RDS credentials pasted into chat should be treated as exposed. **Rotate the RDS master password now** in AWS RDS, and do not reuse it. This project does not contain those credentials.
- The page displays names, emails, phone numbers, and work status to every signed-in user. Get consent before publishing this information publicly.
- Passwords are hashed with bcrypt. They are never returned by the API or displayed in the table.
- This is a learning/deployment starter. Before real public use, add HTTPS, rate limiting, backups, monitoring, and a privacy notice.

## Architecture
Browser -> Frontend EC2 (Nginx) -> Backend EC2 (Node/Express API) -> private RDS MySQL.
Use separate security groups. RDS must not be publicly accessible.

## Repository layout
- `backend/` Express API, JWT login, bcrypt password hashing, MySQL schema
- `frontend/` React + Vite UI
- `deploy/frontend-userdata.sh` frontend EC2 launch-template user data
- `deploy/backend-userdata.sh` backend EC2 launch-template user data
- `docs/DEPLOYMENT.md` step-by-step AWS deployment guide

## Local prerequisites
Node.js 20+, MySQL 8+, Git. For frontend, set `VITE_API_BASE_URL` to your backend URL.

## Local run
1. Create database using `backend/schema.sql`.
2. Copy `backend/.env.example` to `backend/.env` and set your local DB settings and a long random JWT secret.
3. Backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
4. Frontend in another terminal:
   ```bash
   cd frontend
   npm install
   cp .env.example .env
   npm run dev
   ```
5. Open the Vite URL printed in the terminal.

## First registration
The first user can register normally. Registration automatically logs the user in and opens the home/dashboard page. Returning users use Login.

## Deployment overview
Follow `docs/DEPLOYMENT.md`. Do not put secrets in user data or GitHub. On AWS, create `/home/ubuntu/aws_three_tier_code/backend/.env` using a secure method or use Secrets Manager. The supplied user data scripts are examples; update repository/API/DNS values before launching.
