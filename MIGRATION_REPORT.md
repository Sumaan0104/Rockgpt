# RockGPT UI Redesign & Data Layer Migration Report (Phase 0 Audit)

**Date**: 2026-11-24  
**Branch**: `ui-redesign`  
**Base Commit**: `e8cded7` (checkpoint before migration)  
**Author**: Antigravity Full-Stack Systems Engineer  

---

## 1. Executive Summary & Decision Rule

- **Primary Goal**: 
  1. Replace front-end UI with the pixel-faithful monochrome design, typography (`Instrument Sans`), layout, and Web Animations API intro from the prototype (`rockgpt.html` / `newwwwwwwwwww.html`).
  2. Complete and harden the MongoDB Atlas data layer: user settings, individual message persistence, soft deletion & undo restoration, guest chat migration, and real single-use OTP verification.
- **Decision Rule Evaluation**:
  - *Audit Finding*: Chat history is **already present in MongoDB Atlas** across `chats` and `messages` collections, supplemented by client caching (`localStorage` and Next.js store).
  - *Decision*: **Reuse existing MongoDB collections and extend additively**. No existing schemas or documents will be dropped. New fields (`deletedAt`, `lastMessageAt`, `clientId`, `feedback`, `status`, `settings`) and compound/text indexes are added cleanly without breaking backward compatibility.

---

## 2. API Inventory

### A. Express Backend Routes (`rockgpt-backend/`)

| Method | Endpoint | File & Line | Auth Requirement | Request Body / Params | Response Format | Error Codes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/signup` | [`routes/auth.js:434`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L434) | Public (Rate-limited) | `{ name, email, password }` | JSON `{ success, user, token, emailSent }` | 400, 409, 429, 502 |
| `POST` | `/api/auth/verify` | [`routes/auth.js:583`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L583) | Public (Rate-limited) | `{ email, code }` | JSON `{ success, user, token }` | 400 (SEC-01), 429 |
| `POST` | `/api/auth/signin` | [`routes/auth.js:799`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L799) | Public (Rate-limited) | `{ email, password }` | JSON `{ success, user, token }` | 400, 401, 429 |
| `POST` | `/api/auth/login` | [`routes/auth.js:800`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L800) | Public (Alias) | `{ email, password }` | JSON `{ success, user, token }` | 400, 401, 429 |
| `POST` | `/api/auth/resend-otp`| [`routes/auth.js:803`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L803) | Public (Rate-limited) | `{ email }` | JSON `{ success, message }` | 400, 404, 429 |
| `POST` | `/api/auth/forgot` | [`routes/auth.js:883`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L883) | Public (Rate-limited) | `{ email }` | JSON `{ success, message }` | 400, 404, 429 |
| `POST` | `/api/auth/reset-password` | [`routes/auth.js:960`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L960) | Public (Rate-limited) | `{ email, code, newPassword }` | JSON `{ success, message }` | 400, 404, 429 |
| `POST` | `/api/auth/google` | [`routes/auth.js:1139`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L1139) | Public (OAuth2) | `{ idToken }` | JSON `{ success, user, token }` | 400, 401 |
| `GET` | `/api/auth/me` | [`routes/auth.js:1216`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L1216) | JWT Bearer | None | JSON `{ user: { id, name, email, plan } }` | 401, 403 (SEC-02) |
| `POST` | `/api/auth/guest-session` | [`routes/auth.js:1385`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L1385) | Public | None | JSON `{ guestToken, expiresInSeconds: 210 }` | 500 |
| `POST` | `/api/auth/logout` | [`routes/auth.js:1367`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/auth.js#L1367) | Public / Session | None | JSON `{ success: true }` | 200 |
| `POST` | `/api/chat` | [`routes/chat.js:272`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chat.js#L272) | JWT or Guest Token | `{ chatId?, messages, fast?, instructions? }` | `text/event-stream` (SSE tokens + done) | 400, 403, 429 |
| `GET` | `/api/chats` | [`routes/chats.js:18`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chats.js#L18) | JWT Bearer | `?limit=&cursor=&q=` | JSON `{ chats: [{ id, title, pinned, lastMessageAt }] }` | 401 |
| `POST` | `/api/chats` | [`routes/chats.js:146`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chats.js#L146) | JWT Bearer | `{ title?, clientId? }` | JSON `{ chat: { id, title, pinned, createdAt } }` | 401 |
| `GET` | `/api/chats/:id` | [`routes/chats.js:74`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chats.js#L74) | JWT Bearer | `?limit=&before=` | JSON `{ chat: { id, title, messages: [] } }` | 401, 404 |
| `PATCH`| `/api/chats/:id` | [`routes/chats.js:192`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chats.js#L192) | JWT Bearer | `{ title?, pinned? }` | JSON `{ success, chat }` | 401, 404 |
| `DELETE`| `/api/chats/:id` | [`routes/chats.js:240`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chats.js#L240) | JWT Bearer | None | JSON `{ success, message }` | 401, 404 |
| `POST` | `/api/chats/:id/messages` | [`routes/chats.js:312`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/routes/chats.js#L312) | JWT Bearer | `{ role, content, image?, attachments? }` | JSON `{ success, message }` | 401, 404 |
| `GET` | `/health` | [`server.js:155`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/server.js#L155) | Public | None | JSON `{ status: "ok", timestamp }` | 200 |

### B. Additive Routes Specified in Section 4

1. `POST /api/chats/:id/restore` -> Restores soft-deleted conversation (`deletedAt = null`) for the 6-second Undo toast.
2. `PATCH /api/messages/:id/feedback` -> Updates feedback (`up` | `down` | `null`) on an assistant message.
3. `GET /api/me/settings` & `PUT /api/me/settings` -> Retrieves and updates `user.settings` (`instructions`, `fast`, `textSize`).
4. `POST /api/chats/import` -> Bulk, idempotent guest chat import from localStorage (deduplicated by `clientId`).

---

## 3. Authentication & Security Audit

1. **Password Encryption**:
   - Passwords stored strictly as `bcrypt.hash(password, 12)`.
   - Never stored in plaintext, never exposed in JSON responses.
2. **OTP Implementation**:
   - Backend-verified: Generated via `crypto.randomInt(100000, 999999)`.
   - Stored strictly as HMAC-SHA256 hash (`codeHash`) bound to `(email:type:code)`.
   - 10-minute MongoDB TTL index.
   - Max 5 failed attempts per OTP document before deletion + 15-minute lockout.
   - 60-second cooldown between resends.
   - Transport: Direct IPv4 SMTP (`family: 4`) with `dns.setDefaultResultOrder("ipv4first")` (latency 1-2s).
3. **Session & Guest Token Management**:
   - Logged-in users: Signed JWT session tokens (30 days expiry).
   - Guests: Signed guest JWT tokens (210s / ~3.5 minutes expiry).
   - Re-locking: When guest token expires, API returns `403 Forbidden` with `guestExpired: true`.
4. **Daily Limit**:
   - Enforced in [`rockgpt-backend/middleware/limit.js:34`](file:///C:/Users/Suman%20Mansuri/Downloads/auracrystal/public/Rockgpt1/rockgpt-backend/middleware/limit.js#L34): 50 messages/day limit per user ID or IP. Returns `429 Too Many Requests` triggering the Pricing Modal.

---

## 4. Chat Storage & Data Layer Today

- **Database Models (`rockgpt-backend/models/`)**:
  1. `User.js`: `_id`, `name`, `email`, `passwordHash`, `isVerified`, `plan`, `failedOtpAttempts`, `lockedUntil`.
  2. `Chat.js`: `_id`, `userId`, `title`, `model`, `pinned`, `createdAt`, `updatedAt`.
  3. `Message.js`: `_id`, `chatId`, `userId`, `role`, `content`, `attachments`, `createdAt`.
  4. `OtpVerification.js`: `_id`, `email`, `codeHash`, `type`, `createdAt` (10m TTL).
- **Client Cache**:
  - `rockgpt_cache:<userId>` stores recent chat summaries in `localStorage` for instant first-frame render.
  - SWR (Stale-While-Revalidate) reconciles with the backend.

---

## 5. Existing Features to Preserve

1. **Fast Mode**: Toggled via `fast: boolean` flag. Reduces max tokens to 2048, uses fast neural weights, and sets fast system instructions.
2. **Vision / Image Analysis**: Image URLs / base64 payloads routed to Gemini Vision / Pollinations renderer, preserved in chat history.
3. **File Attachments (.txt / .md / code)**: Content extracted and appended to LLM context; metadata stored in message attachments.
4. **Voice Input**: Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`) with visual listening pulse.
5. **Progressive Thinking**: Rotating animated harmonic knot indicator with live status text ("Thinking", "Synthesizing", "Refining").
6. **Pricing Modal**: Free (50 msgs/day), Plus (₹149/mo), Pro (₹399/mo) with UPI QR code + UPI ID (`sumanmansuri@oksbi`).
7. **Identity System Prompt**: RockGPT persona engineered by Suman Mansuri ("Rock"), full-stack software engineer & systems architect. No college names.
8. **PWA Install**: Service worker + web manifest with `#0d0d0d` theme/background color.

---

## 6. Safety Net & MongoDB Backup / Restore Instructions

### A. MongoDB Atlas Snapshot (Recommended)
1. Log in to [MongoDB Atlas Console](https://cloud.mongodb.com).
2. Navigate to **Deployment** $\rightarrow$ **Database** $\rightarrow$ Click your Cluster.
3. Select the **Backup** tab.
4. Click **Take Snapshot Now**.
5. *To Restore*: Click any snapshot $\rightarrow$ **Restore** $\rightarrow$ choose a test cluster or dev database name.

### B. mongodump / mongorestore CLI Command
```bash
# 1. Backup production database to local archive:
mongodump --uri="<YOUR_MONGODB_URI>" --archive="rockgpt_backup_$(date +%Y%m%d).gz" --gzip

# 2. Restore to separate development database:
mongorestore --uri="<YOUR_MONGODB_URI_DEV>" --archive="rockgpt_backup_20261124.gz" --gzip
```

### C. Local Development Environment Variables (`.env`)
```env
# Backend (.env) - NEVER COMMITTED TO GIT
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rockgpt?retryWrites=true&w=majority
MONGODB_URI_DEV=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rockgpt_dev?retryWrites=true&w=majority
JWT_SECRET=rockgpt_super_secure_jwt_secret_min_32_chars_2026!
ADMIN_SECRET=rockgpt_admin_secret_super_hardened_32_chars_2026!
INTERNAL_SERVICE_KEY=rockgpt_internal_service_key_32_chars_min!
GROQ_API_KEY=gsk_...
EMAIL_USER=your-verified-email@gmail.com
EMAIL_PASS=your-google-app-password
CLIENT_ORIGIN=https://rockgpt.vercel.app,http://localhost:3000
```


---

## 6. Front-End UI Replacement Implementation

### A. Prototype Fidelity & Design Tokens
- Replaced front-end UI in `rockgpt-frontend/components/rockgpt/app.tsx` and `rockgpt-frontend/app/globals.css`.
- Strictly adheres to the prototype design tokens:
  - Dark Mode: `--bg: #0d0d0d`, `--side: #0a0a0a`, `--panel: #1b1b1b`, `--hi: #171717`, `--hi2: #262626`, `--line: #232323`, `--text: #f3f3f3`, `--muted: #8d8d8d`, `--sub: #c4c4c4`, `--inv: #fff`, `--invt: #000`.
  - Light Mode: `--bg: #ffffff`, `--side: #f7f7f7`, `--panel: #f4f4f4`, `--hi: #efefef`, `--hi2: #e4e4e4`, `--line: #e6e6e6`, `--text: #0d0d0d`, `--muted: #6e6e6e`, `--sub: #303030`, `--inv: #0d0d0d`, `--invt: #ffffff`.
  - Zero arbitrary blues, gradients, or glowing shadows.
  - Typography: Google Font `Instrument Sans` loaded in `rockgpt-frontend/app/layout.tsx`.
  - Logo Assets: Official knots in `public/assets/logo-lg.webp` (440px) and `public/assets/logo-sm.webp` (160px), inverted cleanly in light mode via `[data-theme="light"] .logo { filter: invert(1); }`.

### B. Section 6 FLIP Intro Animation
- **Browser Mode**:
  1. Pitch black background (`#0d0d0d`).
  2. `#iIcon` knot logo reveals in the center with circle clip-path and -80deg rotate.
  3. "ROCKGPT" wordmark with 7 letters rises with staggered delay and letter-spacing tracking from 1em to 0.5em.
  4. Web Animations API FLIP transition computes delta between `#iIcon` and target slot (`#sMark` in sidebar if visible, `#hMark` in header if mobile) and glides smoothly over 850ms with `cubic-bezier(.65, 0, .35, 1)`.
  5. Sets `.reveal` and `.landed` on `document.documentElement` to trigger staggered entrance of sidebar, header, and empty state.
- **App Mode (`display-mode: standalone`)**:
  - Detected on frame 1; duration reduced to 1.5s total with knot logo visible at `min(34vw, 150px)`.
- **User Control**: Dismissable immediately on click or any keypress; replayable anytime from the Settings modal.

### C. Sidebar & Interaction Features
- **Drag-resize**: Pointer drag handle `#rs` resizes sidebar between 240px and 420px, saved to `--sw`.
- **Search**: Toggle button `#sqb` and search input `#sq` filter chats by title or message contents.
- **Temporal Chat Grouping**: Pinned chats (pinned badge), Today, Yesterday, Previous 7 days, Older.
- **Chat Row Actions**:
  - Pin / Unpin (`.ia[data-a=pin]`) -> calls `PATCH /api/chats/:id`.
  - Inline Rename (`.ia[data-a=ren]`) -> inline text input, Enter saves, Esc cancels -> calls `PATCH /api/chats/:id`.
  - Soft Delete (`.ia[data-a=del]`) -> calls `DELETE /api/chats/:id` -> triggers 6-second Undo toast!
  - Undo Restore -> calls `POST /api/chats/:id/restore` -> restores chat to list!
- **Theme Switcher**: Segmented Light / Dark buttons in sidebar footer.
- **Account Row**: Shows avatar initial, name, email, Settings button, and Log out (or Sign in / Sign up for guests).

### D. Chat Feed & Streaming Responses
- **User Messages**: Rounded bubble with attachment previews and edit pencil button (`.ued`) on the last user message.
- **Assistant Messages**:
  - Spinning knot logo mark (`.ai-mark.live`) while generating tokens.
  - Upright deceleration animation (`spinDown`) upon completion (smoothly eases to 360° or 720°).
  - Progressive thinking indicator with bouncing squash-and-stretch dots and shimmering text.
  - Streaming tokens with blinking `.caret`.
  - Markdown rendered with code blocks featuring language label and Copy button.
  - **Action Buttons Bar** (matching user design):
    - Copy (clipboard icon, switches to checkmark with "Copied!" toast).
    - Speaker / Read Aloud (Web Speech API text-to-speech with cancel toggle).
    - Good Response / Thumbs Up (calls `PATCH /api/messages/:id/feedback`).
    - Bad Response / Thumbs Down (calls `PATCH /api/messages/:id/feedback`, rotated 180°).
    - Share (native `navigator.share` where available).
    - Regenerate (retry icon on the last assistant message).
  - **4 Follow-up Chips**: "Explain more", "Give an example", "Make it shorter", "Translate to Hindi".

### E. Composer & Modals
- **Composer**: Textarea auto-growing up to 140px, Fast mode toggle pill, attachment thumbnail tray, plus button (`+`), mic voice dictation button, send/stop button (waveform when empty, arrow when text entered, square stop icon with `stopPulse` when streaming).
- **Settings Modal (`#smodal`)**: Enter-to-send toggle, Auto-scroll toggle, Show intro animation toggle, Text size selector (Small / Normal / Large), Custom instructions (up to 600 chars, persisted to MongoDB Atlas), Export all chats (.json), Replay intro, Clear all chats, keyboard shortcuts list.
- **Auth Modal (`#modal`)**: Sign in & Sign up tabs, 6-digit auto-advancing OTP verification boxes with 60s countdown resend timer, password visibility eye toggles, Google OAuth redirect, and guest mode.

---

## 7. Data Layer & MongoDB Atlas Verification

The full test suite was executed against the database and endpoints:
- **Test File**: `rockgpt-backend/tests/test_data_layer_endpoints.mjs`
- **Result**: **14 / 14 Tests Passed (100%)**

```
========================================================
🧪 TESTING SECTION 4 DATA LAYER ENDPOINTS & MONGODB
========================================================
Connected to MongoDB Atlas dev database.
  ✓ PASS: POST /api/chats creates new conversation
  ✓ PASS: POST /api/chats is idempotent by clientId
  ✓ PASS: GET /api/chats/:id returns 404 for foreign user (Strict isolation)
  ✓ PASS: POST /api/chats/:id/messages adds message
  ✓ PASS: PATCH /api/messages/:id/feedback saves user reaction
  ✓ PASS: PATCH /api/chats/:id renames and pins chat
  ✓ PASS: GET /api/chats?q= searches titles and messages accurately
  ✓ PASS: DELETE /api/chats/:id performs soft delete (deletedAt)
  ✓ PASS: Soft-deleted chat is excluded from active chat listing
  ✓ PASS: POST /api/chats/:id/restore revives soft-deleted chat
  ✓ PASS: PUT /api/me/settings persists instructions, fast mode, and textSize
  ✓ PASS: GET /api/me/settings returns persisted user settings
  ✓ PASS: POST /api/chats/import performs bulk guest chat import
  ✓ PASS: POST /api/chats/import is idempotent and prevents duplicate chats
========================================================
🎉 ALL 14 DATA LAYER & MONGODB TESTS PASSED!
========================================================
```

- **Frontend Build Status**:
  - Command: `npx next build` in `rockgpt-frontend/`
  - Result: **Compiled successfully in 10.0s, all 27 static and dynamic routes optimized with 0 errors**.

---

## 8. Exact Step-by-Step Copy-Paste Terminal Instructions

### Step 1: Check Git Status and Changes
```powershell
cd "C:\Users\Suman Mansuri\Downloads\auracrystal\public\Rockgpt1"
git status
```

### Step 2: Test the Backend Endpoints
```powershell
cd "C:\Users\Suman Mansuri\Downloads\auracrystal\public\Rockgpt1\rockgpt-backend"
node tests/test_data_layer_endpoints.mjs
```

### Step 3: Run the Development Server
In one terminal, start the backend:
```powershell
cd "C:\Users\Suman Mansuri\Downloads\auracrystal\public\Rockgpt1\rockgpt-backend"
npm start
```

In a second terminal, start the frontend:
```powershell
cd "C:\Users\Suman Mansuri\Downloads\auracrystal\public\Rockgpt1\rockgpt-frontend"
npm run dev
```
Open `http://localhost:3000` in your browser to experience the pixel-faithful monochrome UI, FLIP intro animation, and persistent chat data layer!
