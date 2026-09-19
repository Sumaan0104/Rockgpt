# RockGPT - Enterprise AI Platform

RockGPT is a full-stack AI platform built with React 19, Tailwind CSS, Node.js Express 5, and MongoDB.

---

## 🔐 Google OAuth 2.0 Configuration Guide

RockGPT implements the official Google Authorization-Code flow (`flow: "auth-code"` via `@react-oauth/google` on the frontend and server-side verification with `google-auth-library` on the backend).

### Step 1: Create a Google Cloud Project & Configure Consent Screen
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click the project dropdown in the top bar and select **New Project** (e.g. `RockGPT`).
3. Navigate to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type and click **Create**.
   - **App name**: `RockGPT`
   - **User support email**: Select your email.
   - **Developer contact information**: Enter your email.
   - **Scopes**: Ensure `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and `openid` are selected.
   - Save and proceed through the test users step.

### Step 2: Create OAuth 2.0 Client Credentials
1. Navigate to **APIs & Services** > **Credentials**.
2. Click **Create Credentials** > **OAuth client ID**.
3. Select **Application type**: `Web application`.
4. Set **Name**: `RockGPT Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5173` (for local development)
   - `https://rockgpt.vercel.app` (for production Vercel frontend)
   > ⚠️ **Important**: Do **not** include a trailing slash (e.g. `http://localhost:5173/` will be rejected by Google).
6. Under **Authorized redirect URIs**, add:
   - `postmessage`
   > ℹ️ The `@react-oauth/google` popup flow uses `postmessage` to communicate the authorization code securely back to your web page.
7. Click **Create**.
8. Copy your **Client ID** and **Client Secret**.

---

## ⚙️ Environment Variables Setup

### Frontend (`rockgpt-frontend`)
Create or edit `rockgpt-frontend/.env`:
```env
VITE_BACKEND_URL=https://rockgpt.onrender.com
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
```
*When deploying to Vercel, add `VITE_GOOGLE_CLIENT_ID` and `VITE_BACKEND_URL` in **Project Settings > Environment Variables**.*

### Backend (`rockgpt-backend`)
Create or edit `rockgpt-backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/rockgpt?retryWrites=true&w=majority
JWT_SECRET=your_32_character_jwt_secret_key
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
BREVO_API_KEY=your_brevo_api_key
EMAIL_USER=your_email@domain.com
EMAIL_PASS=your_email_password
```
*When deploying to Render, add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the **Environment** tab.*

---

## 🛡️ Security Architecture
- **No Token Leakage**: The client never receives or stores Google access/refresh tokens. Only an authorization code is passed to the backend.
- **Server-Side Token Exchange**: The Express backend directly exchanges the authorization code for tokens with Google using the client secret.
- **Audience & Signature Verification**: Google ID tokens are verified using Google's public keys and strictly validated against `GOOGLE_CLIENT_ID`.
- **Verified Email Enforcement**: Accounts are only provisioned or linked if Google confirms `email_verified === true`.
- **Anti-IDOR & Account Linking**: Accounts are looked up by sparse unique `googleId` or safely linked by verified `email`.
- **TOTP 2FA Preservation**: If an existing account has TOTP two-factor authentication enabled, Google sign-in issues a temporary 2FA session token and requires the 6-digit TOTP code before issuing the final 30-day JWT.
