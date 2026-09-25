Collabden Backend
A Node.js REST API backend with PostgreSQL, Prisma ORM, JWT authentication, and email verification.

# Tech Stack
Runtime: Node.js
Framework: Express.js
Database: PostgreSQL
ORM: Prisma v7
Authentication: JWT (jsonwebtoken)
Email: Resend
Password Hashing: bcryptjs

Prerequisites
Before running this project make sure you have the following installed:

Node.js (v18+)
PostgreSQL (local or cloud via Neon / Supabase)


# Getting Started
1. Clone the repository
    git clone https://github.com/YOUR_USERNAME/collabden-backend.git
    cd collabden-backend
2. Install dependencies
    npm install
3. Set up environment variables
Create a .env file in the root of the project:
env# Database
DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/YOUR_DB_NAME"

# JWT
JWT_SECRET="your_generated_secret"
JWT_EXPIRES_IN="7d"
JWT_ISSUER="collabden-api"
JWT_AUDIENCE="collabden-web"
# Optional; 0-60 seconds only. Defaults to 30.
JWT_CLOCK_TOLERANCE_SECONDS="30"

# Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxxxxxx"

# App
FRONTEND_URL="http://localhost:3000"
PORT=5050

Tip: Generate a secure JWT secret by running:
bashnode -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

4. Set up the database
Option A — Local PostgreSQL
bash# Open PostgreSQL shell
psql -d postgres

# Create the database
CREATE DATABASE your_db_name;
\q

# Running the Server
Development
   npm run dev
Production
   npm start
   Server runs on http://localhost:5050 by default.

# Authentication Routes

Interactive API documentation is available at `GET /api-docs` while the server is running.

| Method | Route | Authentication | Description |
| --- | --- | --- | --- |
| GET | `/api/v1/user/auth/google` | None | Starts Google OAuth and redirects to Google's consent screen. |
| GET | `/api/v1/user/auth/google/callback?code=...` | Google callback | Verifies the Google ID token, finds or creates the user, then redirects to `${FRONTEND_URL}/api/auth/google/callback` with an application JWT. This endpoint is called by Google, not directly by the frontend. |
| GET | `/api/v1/user/profile` | User bearer token | Returns the authenticated normal-user profile. Use `Authorization: Bearer <token>`. |
| PATCH | `/api/v1/user/onboarding` | User bearer token | Updates the authenticated user's onboarding status. |
| GET | `/api/v1/admin/auth/me` | Admin bearer token | Returns the authenticated admin profile. A valid normal-user token receives `403 Forbidden: Admin token required`. |

OAuth flow: Google callback → Google ID-token verification → user lookup/create → application JWT signing → frontend redirect → `GET /api/v1/user/profile`.

User and admin JWTs are intentionally distinct. Tokens are signed with `HS256`, include issuer/audience and UTC NumericDate claims (`iat`, `nbf`, `exp`), and may only differ from verifier time by `JWT_CLOCK_TOLERANCE_SECONDS`. Tokens issued before the JWT claim/type policy was introduced require a new login.

Do not log, persist, or expose OAuth authorization codes or bearer tokens. The frontend should consume the redirect token immediately in memory and then use it only in the `Authorization` header.

# Prisma Workflow
Every time you change the schema:
# 1. Edit your model file in prisma/schema/
# 2. Run migration
npx prisma migrate dev --name describe_your_change

# 3. Regenerate client
npx prisma generate
Schema Structure
prisma/
  schema/
    base.prisma          ← generator + datasource config
    userProfile.prisma   ← UserProfile model
  migrations/            ← auto-generated migration files

Project Structure
src/
  app.js                 ← Express app entry point
  config/
    prismaClient.js      ← Prisma client instance
  middleware/
    auth.middleware.js   ← JWT auth middleware
  modules/
    users/
      controllers/       ← Request handlers
      services/          ← Business logic
      routes/            ← Route definitions
  utils/
    sendEmail.js         ← Resend email utility
    generateToken.js     ← JWT token generator

# .gitignore
Make sure your .env and node_modules are ignored:
node_modules/
.env

# Common Issues
Cannot find module '@prisma/client'
  npx prisma generate

PrismaClient needs adapter (Prisma v7)
   npm install @prisma/adapter-pg pg

prisma.userProfile is undefined

# Make sure model is named UserProfile (PascalCase) in schema
# Run npx prisma generate after any schema changes
