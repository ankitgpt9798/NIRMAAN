# Building Material Shop – Price Catalogue

A lightweight website for a local building material shop. Customers scan **one permanent QR code** at the shop and see every material (cement, TMT rod, sand and more) with its **latest price**, availability and unit, in **Hindi or English**. The shop owner updates products and prices from a simple, secure admin dashboard.

It is a catalogue only: no cart, no online payment, no customer accounts.

> **Status:** All 9 milestones are complete: the application is built, tested and **ready to deploy**. It has **not** been deployed; see section 14.

**Contents:** [How it works](#1-how-it-works) · [Technology](#2-technology-stack) · [Structure](#3-project-structure) · [Prerequisites](#4-prerequisites) · [MongoDB Atlas](#5-mongodb-atlas-setup-free) · [Environment variables](#6-environment-variables) · [Install & run](#7-local-installation-and-running) · [Tests](#8-automated-tests) · [Data model](#9-data-model-summary) · [Customer website](#10-customer-website-what-the-qr-code-opens) · [Admin account](#10a-admin-account-and-login) · [Admin dashboard](#11-admin-dashboard-usage) · [Updating prices](#12-how-to-update-product-prices) · [QR code](#13-the-permanent-shop-qr-code) · [Deployment](#14-production-deployment) · [Security](#15-security-notes) · [Troubleshooting](#16-troubleshooting)

---

## 1. How it works

```
Customer phone ── scans QR (contains only the website URL) ──► React website
                                                                   │  GET /api/public/*
Shop owner (phone / PC) ──► /admin pages ──── login token (JWT) ──►│
                                                                   ▼
                                                     Express API ──► MongoDB Atlas
                                                                 └─► Cloudinary (optional, images)
```

- Prices are stored **only in the database**. Every page load fetches the latest prices; nothing is hard-coded in the website.
- The QR code encodes only the permanent website address, so it **never needs to be reprinted** when prices, products, categories or shop details change.

## 2. Technology stack

| Part | Technology |
| --- | --- |
| Frontend | React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, Lucide icons |
| Backend | Node.js (22.12+), Express 5, Mongoose 9 |
| Database | MongoDB Atlas (cloud, free M0 tier) |
| Security | JWT, bcryptjs, Zod validation, Helmet, express-rate-limit, CORS allow-list |
| Extras | `qrcode` (QR generation), Multer + Cloudinary (product images, optional) |
| Tests | Backend: Node.js built-in test runner (`node --test`), `jsqr`/`pngjs` to decode QR codes. Frontend: Vitest + Testing Library (jsdom) |
| Hosting (prepared) | Vercel (website), Render (API), MongoDB Atlas, Cloudinary – all free tiers |

## 3. Project structure

```
NIRMAAN/
├─ README.md               ← this file
├─ COMMIT_MESSAGES.md      ← suggested git commit message per milestone
├─ .env.example            ← reference of every environment variable (placeholders only)
├─ .gitignore
├─ render.yaml             ← Render Blueprint for the API (hosting)
├─ backend/
│  ├─ server.js            ← entry point: connects to Atlas, starts the API
│  ├─ app.js               ← Express app (security middleware, routes, errors)
│  ├─ config/              ← env.js (validated settings), db.js (Atlas), productionChecks.js
│  ├─ constants/           ← measurement units, availability values
│  ├─ controllers/         ← request handlers
│  ├─ middleware/          ← error handling, rate limiting, auth
│  ├─ models/              ← Admin, Category, Product, PriceHistory, Shop
│  ├─ routes/              ← /api/health, /api/public, /api/auth, /api/admin
│  ├─ services/            ← business logic (e.g. price updates + history)
│  ├─ validators/          ← Zod request schemas
│  ├─ scripts/             ← db:check, admin creation, default data
│  ├─ utils/               ← helpers (ApiError, money, site address checks)
│  ├─ tests/               ← automated tests
│  ├─ uploads/             ← photos, only when Cloudinary is not configured (git-ignored)
│  └─ .env.example
└─ frontend/
   ├─ index.html
   ├─ vite.config.js       ← dev server + /api proxy; adds the CSP to production builds
   ├─ vercel.json          ← Vercel hosting: app routing, security headers, caching
   ├─ public/              ← favicon.svg, robots.txt
   └─ src/
      ├─ components/       ← admin/ (forms, badges, poster…) and public/ (cards, notices…)
      ├─ pages/            ← customer pages and admin/ pages
      ├─ layouts/  services/  hooks/  context/  utils/
      ├─ i18n/             ← hi.js, en.js (website), admin.hi.js, admin.en.js (admin), language provider
      ├─ test/             ← test setup and sample data
      └─ App.jsx  main.jsx  index.css (Tailwind + colour tokens + print rules)
```

## 4. Prerequisites

- **Node.js 22.12 or newer** (developed on Node 24) and npm
- A free **MongoDB Atlas** account (no local MongoDB installation is used)
- A modern browser; a phone on the same Wi-Fi for mobile testing

## 5. MongoDB Atlas setup (free)

1. Create a free account at <https://www.mongodb.com/cloud/atlas/register>.
2. **Create a cluster** → choose the **Free (M0)** tier. A region close to your customers is best (for India: AWS *Mumbai, ap-south-1*).
3. **Database Access** → *Add New Database User* → pick a username, click *Autogenerate Secure Password* and save the password somewhere safe. Role: **Read and write to any database**.
4. **Network Access** → *Add IP Address* → **Add Current IP Address** (for local development).
   *Hosting on Render later needs `0.0.0.0/0`; this is explained in the deployment section.*
5. **Database → Connect → Drivers** → copy the connection string. It looks like:
   `mongodb+srv://<db_username>:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
6. Open `backend/.env`, set `MONGODB_URI=` to that string and replace `<db_password>` with the real password.
   If the password contains special characters, URL-encode them (`@` → `%40`, `#` → `%23`, `/` → `%2F`).
7. Test the connection:
   ```bash
   cd backend
   npm run db:check
   ```
   You should see `MongoDB connection OK`.

Databases used inside the cluster:

| Database | Used by |
| --- | --- |
| `nirmaan_catalogue` | the application (`MONGODB_DB_NAME`) |
| `nirmaan_catalogue_test` | automated tests only (emptied after each test run) |

## 6. Environment variables

Each app has its own `.env` file. Only the `.env.example` templates contain placeholder values; real `.env` files are git-ignored and must never be shared.

**`backend/.env`** (copy from `backend/.env.example`)

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `development` locally, `production` when hosted |
| `PORT` | API port (default `5000`) |
| `MONGODB_URI` | Atlas connection string (secret) |
| `MONGODB_DB_NAME` | Database name (default `nirmaan_catalogue`) |
| `DNS_SERVERS` | Optional, local only: DNS servers for the Atlas lookup, e.g. `8.8.8.8,1.1.1.1` (see Troubleshooting) |
| `JWT_SECRET` | Long random secret for admin login tokens (secret, ≥ 32 chars) |
| `JWT_EXPIRES_IN` | How long an admin stays logged in (default `1d`) |
| `CORS_ORIGINS` | Comma-separated frontend URLs allowed to call the API |
| `PUBLIC_SITE_URL` | Permanent website URL encoded in the QR code |
| `TRUST_PROXY` | `1` on Render, `0` locally |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | Optional image storage credentials (secret). Recommended; required in production |
| `CLOUDINARY_FOLDER` | Cloudinary folder for this shop (default `nirmaan`; product photos go to `nirmaan/products`) |
| `UPLOADS_DIR` | Only without Cloudinary: where images are saved on disk (default `backend/uploads`) |

Generate a JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**`frontend/.env`** (optional locally, copy from `frontend/.env.example`)

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | Leave empty locally. In production: `https://<your-api>.onrender.com/api` |
| `VITE_DEV_API_PROXY` | Where the dev server forwards `/api` (default `http://localhost:5000`) |

## 7. Local installation and running

```bash
# 1. Backend
cd backend
npm install
#    create backend/.env from backend/.env.example and fill in MONGODB_URI + JWT_SECRET
npm run db:check     # verify Atlas connection
npm run dev          # API on http://localhost:5000 (restarts on file changes)

# 2. Frontend (in a second terminal)
cd frontend
npm install
npm run dev          # website on http://localhost:5173
```

Open <http://localhost:5173> for the customer price list and <http://localhost:5173/admin> for the owner dashboard.

**Testing on a phone (same Wi-Fi):** run `npm run dev:lan` in `frontend` and open the "Network" address it prints (e.g. `http://192.168.1.20:5173`) on the phone.

### Useful commands

| Where | Command | What it does |
| --- | --- | --- |
| backend | `npm run dev` | Start API with auto-restart |
| backend | `npm start` | Start API (production mode uses this) |
| backend | `npm run db:check` | Check the Atlas connection (read-only) |
| backend | `npm run cloudinary:check` | Check the Cloudinary credentials (read-only) |
| backend | `npm run create-admin` | Create the owner's admin account, or reset its password |
| backend | `npm run seed:categories` | Create the 4 default categories (safe to run again) |
| backend | `npm test` | Run automated tests |
| frontend | `npm run dev` | Start website dev server |
| frontend | `npm run dev:lan` | Same, reachable from phones on your Wi-Fi |
| frontend | `npm run build` | Production build into `frontend/dist` |
| frontend | `npm run lint` | Check code quality |
| frontend | `npm test` | Run the website's component tests (no server needed) |

## 8. Automated tests

```bash
cd backend
npm test
```

- Configuration, model validation and HTTP/security tests run without a database.
- The **MongoDB Atlas** tests (database, authentication, scripts, categories, products, images, dashboard, shop photo, gallery, reviews incl. approval, rate limit, hidden bot field and the waiting-review cap) run only when `MONGODB_URI` is configured. They use the separate `nirmaan_catalogue_test` database and remove their data afterwards; the real shop database is never touched.
- Automated tests never upload to Cloudinary: they store images in a temporary local folder that is deleted afterwards.
- Each test has a 2-minute limit, so a network stall fails clearly instead of hanging. On an unstable connection, Atlas tests can fail with `ECONNRESET`/`ETIMEOUT`; run `npm test` again.

```bash
cd frontend
npm test
```

- Frontend component tests (Vitest + Testing Library in a simulated browser) cover the customer catalogue and product page in **Hindi (default) and English**: prices, units, availability, search, category filters, refresh, error/slow/empty states, contact links, switching language (instant, remembered, no reload), plus the shop photo, gallery (full-screen viewer, keyboard), reviews (average, paging, form checks, sending, error messages), product cards (saving) and footer (map link, back to top), and the translation files. Admin pages (Update Prices, Price History, Shop Settings incl. shop photo, Photo Gallery, Reviews, QR Code) are tested in English, and separately **in Hindi as the default**: Hindi labels, Hindi typing-mistake and server messages, switching language with messages following the switch. The API is replaced by sample data, so no server is needed.

### Real-browser check (Milestone 8)

The production build was also tested end to end in **Microsoft Edge** (headless, driven by Playwright), with the backend on the Atlas test database. 45 checks passed:

| Area | What was done in the browser |
| --- | --- |
| Admin | Logged-out redirect; wrong password message; login; 4 categories and 4 products (one per category, different units) added **through the forms**; a 1600×1200 photo shrunk in the browser to a ~19 KB JPEG before upload; unit changed via Edit; stock changed from the list; price ₹370 → ₹380 on Update Prices; Price History entry with the admin's name; Shop Settings saved; QR page warning; poster PNG downloaded (A4, and its QR code **decoded back** to the website address); **Print poster = exactly one A4 page** |
| Customer | Opens in Hindi with all products at **360, 390, 768 and 1280 px** with **no sideways scrolling**; Hindi shop name; out-of-stock product listed; new price shown; price notice; Hindi search; Sand filter with delivery note; instant switch to English; product page with photo, MRP, call/WhatsApp buttons; Back to list; language remembered after reload; Refresh prices; bilingual "page not found" |
| Phone admin | Products, Update Prices and Add product pages at 390 px without sideways scrolling; ☰ menu |
| Accessibility | **axe-core: 0 violations** on 13 pages (all admin pages, catalogue in Hindi and English, product page, not-found page) |
| Performance | First visit on a phone: **7 requests, ≈123 KB compressed** (HTML, CSS, JS, 2 API calls, photo); customer pages never download the admin code; prices come in one API request; no third-party downloads |

A second run checked the **Hindi admin** on the production build (24 checks): login opens in Hindi (`lang="hi"`); wrong-password message, dashboard, menu, products, Update Prices (typing mistake and saved message), Price History (Hindi date), QR warnings and Shop Settings validation all in Hindi; switching to English is instant, remembered after reload and shared with the customer website; switching back; at 360 px on a phone: Hindi menu and no sideways scrolling. **axe-core: 0 violations** on the 6 Hindi admin pages checked.

A third run checked the **shop photo, gallery, reviews, product cards and footer** end to end (41 checks): the owner adds a shop photo and 3 gallery photos at once (with a Hindi caption) in the Hindi admin; the customer page shows the big photo below all products, the gallery (newest first) and the full-screen viewer (arrow keys, Escape; buttons on a phone); a customer sends a review, which stays hidden until the owner approves it from the dashboard notice and the Reviews page, then shows with the average rating; the card shows "₹30 की बचत" and "प्रति ट्रॉली"; the footer's call, WhatsApp, Google Maps and back-to-top work; the search bar is not pinned over the photos; everything fits at 360 px and the photos load when scrolled to; the extra code loads only after the prices. **axe-core: 0 violations** on the 5 pages checked.

These checks are not part of `npm test` (they need Edge and a few extra tools); they were run with temporary scripts during development.

## 9. Data model (summary)

| Model | Key fields |
| --- | --- |
| **Admin** | name, email (unique), passwordHash (bcrypt, never returned), role, tokenVersion |
| **Category** | nameEn, nameHi, descriptionEn/Hi, isActive, sortOrder |
| **Product** | nameEn, nameHi, brand, category → Category, descriptionEn/Hi, image, unit, mrp, sellingPrice, availability, isActive, priceUpdatedAt |
| **PriceHistory** | product → Product, product name snapshot, previousPrice, newPrice, updatedBy → Admin, createdAt (server time) |
| **Shop** | single settings document: nameEn/Hi, logo, photo (big shop photo), phone, whatsapp, addressEn/Hi, descriptionEn/Hi, websiteUrl |
| **GalleryPhoto** | image, captionEn/Hi, createdAt (shown newest first; at most 40 photos) |
| **Review** | name, rating (1–5 whole stars), comment, status (`pending` / `approved`), approvedAt, createdAt. No IP address, phone or e-mail is stored. |

Rules enforced by the database layer: prices cannot be negative, must be numbers with at most 2 decimal places (paise), MRP cannot be lower than the selling price, units and availability must be from the allowed lists, and every name needs at least one language (the website falls back to the other language).

**Measurement units:** Per Bag, Per 50 KG Bag, Per KG, Per Quintal, Per Ton, Per Piece, Per Bundle, Per Trolley (tractor-trolley load), Per Truck, Per CFT (Cubic Feet), Per Brass, Per Packet, Per Square Feet, Per Litre, Per Metre, Per Box. More can be added in `backend/constants/catalog.js`.

**Availability:** In Stock, Out of Stock, Currently Unavailable. Out-of-stock products stay visible to customers.

## 10. Customer website (what the QR code opens)

| Page | What customers see |
| --- | --- |
| `/` – price list | **Header** (white, forest-green shop name, full address below it, language switch, Admin button on the owner's devices, **Call** button; it scrolls away with the page – nothing is pinned to the top); "Prices last updated" date; **Refresh prices** button; the price notice; a search box; category buttons (All, Cement, TMT Rod, Sand, …) with counts; product cards (see below). **Below the products:** the big shop photo, the photo gallery and customer reviews (see below). **Footer** (light, three balanced sections on larger screens, stacked on phones): (1) logo, shop name in both languages and the short description, (2) **Call** (forest green) and **WhatsApp** (WhatsApp green) buttons, (3) the address with **Open in Google Maps**; then a slim forest-green bar with © and **Back to top** |
| `/products/:id` – product details | Large photo, name (in both languages when available), price and unit, MRP, availability, brand, category, unit, description, delivery note, price notice, and **Call to confirm price** / **Ask on WhatsApp** buttons (when the shop phone/WhatsApp number is set) |

**Product cards:** category tag, name (two lines at most), brand, then a highlighted price panel with the **price + unit**, the MRP struck through and the saving (for example "₹30 की बचत" = MRP − selling price, only when an MRP higher than the price is entered), availability, a delivery-charges note for sand-type categories, and the date the price was last updated. Cards do not show the description (it is on the product page, opened by tapping the card), so they stay short. Out-of-stock and currently-unavailable products stay listed with their status; their photo and price panel are shown slightly muted so in-stock items stand out.

**Shop photo, gallery and reviews (below the products):**

- **हमारी दुकान / Our shop:** the big shop photo from Shop Settings, with the shop name and address. Hidden until a photo is added.
- **फ़ोटो गैलरी / Photo gallery:** the gallery photos (newest first) in **one row that scrolls sideways** (finger swipe on phones, arrow buttons on computers; "3 फ़ोटो – सभी देखने के लिए खिसकाएँ" is shown when there are more than two), so the gallery is only one photo tall however many photos there are; tapping one opens it full screen with next/previous buttons, finger swipe, keyboard arrows and Escape. Hidden while the gallery is empty.
- **ग्राहकों की राय / Customer reviews:** the average rating and number of reviews, approved reviews newest first in a **box that scrolls up and down** (on computers and tablets the box and the review form sit side by side, 50/50 and the same height) (so many reviews never make the page longer; **Show more reviews** at the end of the box loads 5 more), and a **Write a review** form: name, 1–5 stars, optional comment (500 characters). No login. A new review appears **only after the owner approves it**; the customer is told so after sending.
- These sections load **after** the prices (a separate ~4.5 KB file and two small requests), and their photos load only when scrolled to, so the price list opens as fast as before. Nothing is pinned to the top of the screen: the header, search box and category buttons all scroll with the page.

How it behaves:

- **Always the latest prices:** products are fetched from the server every time the page is opened, refreshed or **Refresh prices** is tapped. The API sends `Cache-Control: no-cache`, so phones and proxies must re-check every time. If nothing changed, the server answers `304 Not Modified` without re-sending the list (saves mobile data).
- **Light on mobile data:** no web fonts or third-party files; product photos come from Cloudinary in the size the screen needs (about 200 px for list thumbnails, up to 800 px on the product page, best format such as WebP); photos below the visible screen load only when scrolled to. A first visit is about 123 KB.
- **Fast search:** all visible products arrive in one request; search (English or Hindi, any word order, brand or category) and category filters then work instantly on the phone with no further requests. Search and filter are kept in the address (`/?q=cement&category=…`), so **Back** from a product returns to the same view and scroll position.
- **What is listed:** only products that are shown *and* whose category is shown. **Out-of-stock and currently-unavailable products stay visible** with their status (colour, icon and text).
- **Slow or offline network:** a loading state, then after 4 seconds a note that the server may take up to a minute to wake up (free hosting). Errors show a **Try again** button; if a refresh fails, the previously loaded list stays visible with a warning.
- **Before Shop Settings are filled in** the header shows "निर्माण सामग्री की रेट सूची" / "Building Material Price List" and contact details are hidden rather than showing placeholders.

### Hindi and English

- The website **opens in Hindi**. A **हिंदी | English** switch (labelled "भाषा / Language") is at the top of every customer page.
- Switching is instant: no page reload and no new request for prices; the search text and filters stay as they were.
- The choice is **remembered for the browsing session** (`sessionStorage`), so it survives moving between pages and refreshing, and resets when the browser tab/session is closed. If storage is blocked, the switch still works for the current page.
- Translated: navigation, buttons, search box, category filter, availability (स्टॉक में उपलब्ध / स्टॉक में नहीं / अभी उपलब्ध नहीं), price notice, delivery note, dates (05 नवंबर 2026), contact section, error/empty/loading messages, page titles and the WhatsApp message.
- From the database: product names and descriptions, category names, shop name, address and description, and measurement units (प्रति 50 किलो बोरी, प्रति ट्रॉली …) are shown in the selected language. **If the Hindi text is empty, the English text is shown (and vice versa)**, so nothing is ever blank.
- The page's `lang` attribute follows the selection, so phones use the right font and screen readers pronounce text correctly. Hindi uses the device's built-in Devanagari font (Android: Noto Sans Devanagari, iPhone: Kohinoor Devanagari, Windows: Nirmala UI) with slightly larger line spacing. No web font is downloaded, which saves about 120 KB on a customer's first visit.
- Texts live in `frontend/src/i18n/hi.js` and `en.js`. An automated test checks that both files have the same keys and placeholders, that no text is empty, and that every Hindi text is written in Devanagari.

### Admin in Hindi (default) and English

- The admin also **opens in Hindi**, with the same **हिंदी | English** switch in its top bar (and on the login page). It is **one choice for the whole site**: switching in the admin also switches the customer website in that browser tab, and the other way round.
- Everything in the admin is translated: menu, buttons, forms, hints, confirmations, success and error messages, dates (10 नव॰ 2026, 8:15 pm), page titles and screen-reader labels. Hindi and English input fields for customer-facing text are both always shown (Hindi first).
- Menu in Hindi → English: डैशबोर्ड → Dashboard · सामान → Products · श्रेणियाँ → Categories · रेट बदलें → Update Prices · रेट का इतिहास → Price History · QR कोड → QR Code · दुकान की जानकारी → Shop Settings · वेबसाइट देखें → View website · लॉग आउट → Logout. The how-to sections below use the English names.
- Messages from the server (for example "Selling price cannot be negative") are translated in the browser from their error code or known sentence pattern. A message the admin does not recognise (only possible after a future server change) is shown in English rather than hidden.
- Admin texts live in `frontend/src/i18n/admin.hi.js` and `admin.en.js` and are loaded **only with the admin code**, so the customer website does not download them. The same automated checks (same keys and placeholders, nothing empty, Hindi in Devanagari) cover them.
- The printed QR poster stays bilingual (Hindi + English) whatever language the admin uses.

### Public API (no login)

| Method & path | Returns |
| --- | --- |
| `GET /api/public/shop` | Shop details (empty values until the owner saves Shop Settings; never creates a record) |
| `GET /api/public/categories` | Shown categories in display order, with the number of visible products |
| `GET /api/public/products?search=&category=&page=&limit=` | Visible products ordered by category then name, plus `lastUpdated` (latest price change). Default limit 500, max 1000. |
| `GET /api/public/products/:id` | One visible product (`404` if hidden, in a hidden category, or unknown) |
| `GET /api/public/gallery` | Gallery photos, newest first: `{ items: [{ id, image, captionEn, captionHi }] }` |
| `GET /api/public/reviews?page=&limit=` | Approved reviews, newest first (max 20 per page), with `total` and `averageRating` |
| `POST /api/public/reviews` | New review `{ name, rating, comment? }` → `201 { status: "pending" }`. Strict (a customer cannot set the status); at most 5 accepted reviews per connection per hour (`429`); refused with `503 REVIEWS_PAUSED` while 100 reviews are waiting, so spam can never fill the database; a hidden form field quietly drops bot submissions |

Only customer-facing fields are returned (no visibility flags, timestamps other than `priceUpdatedAt`, or storage ids). The public API is read-only.

## 10a. Admin account and login

There is **no public sign-up page**. The owner's account is created from a terminal on a computer that has `backend/.env` (the database credentials), so nobody on the internet can register.

### Create the admin account

Run this in your own terminal (PowerShell, Command Prompt or the VS Code terminal) so the password stays private:

```bash
cd backend
npm run create-admin
```

It asks for:

1. **Admin email** – used to log in.
2. **Owner name** – shown in the dashboard.
3. **New password**, typed twice. Typing is hidden. Rules: at least 8 characters, with at least one letter and one number.

Only a bcrypt hash of the password is saved (never the password itself). Then open <http://localhost:5173/admin/login> and log in.

> The account lives in the database, not on the computer, so the same login works on the deployed website, as long as the deployed backend uses the same `MONGODB_URI` and `MONGODB_DB_NAME`.

### Opening the admin from the website (Admin button)

The customer website has an **एडमिन / Admin** button in its top bar, but **only on the owner's own devices**. Customers never see it.

| Situation | What happens |
| --- | --- |
| A customer's phone (never logged in) | No Admin button |
| The owner logs in once at `/admin` on a phone/computer | From then on, the website shows **एडमिन / Admin** at the top left on that device; one tap opens the dashboard |
| The 1-day login expires | The button stays; tapping it asks for the password again |
| The owner taps **Logout** | The button is removed from that device (use this if you ever log in on someone else's phone) |
| A new device | Open `/admin` directly once (bookmark it), log in, and the button appears |

In the admin, **View website** (menu) returns to the customer website in the same tab, so the two feel like one app. The button is only a shortcut, not protection: the admin pages and data always require the password.

### Forgot the password or want to change it?

Run `npm run create-admin` again with the **same email** and type `yes` when it asks to reset. The new password works immediately, and every phone or computer that was logged in with the old password is logged out.

### How login works (technical)

| Topic | Behaviour |
| --- | --- |
| Endpoints | `POST /api/auth/login` (email + password) → token; `GET /api/auth/me` → current admin |
| Token | JWT (HS256) signed with `JWT_SECRET`, valid for `JWT_EXPIRES_IN` (default 1 day), sent as `Authorization: Bearer <token>` |
| Where the browser keeps it | `localStorage`, admin pages only. It is sent only to `/api/admin/*` and `/api/auth/me`, never to public endpoints. Logout removes it. |
| Every admin request | Token signature, expiry, issuer and audience are checked, and the admin is re-loaded from the database. Deleted accounts and password resets take effect at once. |
| Brute-force protection | 10 failed logins per IP address per 15 minutes, then `429 Too many login attempts`. Successful logins don't count. bcrypt cost factor 12 (≈0.4 s per check). |
| Wrong email vs wrong password | Same message ("Incorrect email or password") and similar response time, so nobody can find out which emails have accounts. |
| Protected API | Everything under `/api/admin/*` answers `401` without a valid token (even unknown URLs), and `403` for accounts without the `admin` role. |
| Protected pages | `/admin/*` pages redirect to `/admin/login` when not logged in, and return to the requested page after login. The admin code is a separate download that customers never load. |
| Why not cookies? | The website (Vercel) and API (Render) are on different domains; Safari/iOS block cross-site cookies, which would break login on iPhones. |

## 11. Admin dashboard usage

Log in at `/admin/login`. On phones, open the menu with the ☰ button; **Logout** is at the top right.

### First-time setup

```bash
cd backend
npm run create-admin       # owner account (once)
npm run seed:categories    # Cement, TMT Rod, Sand, Other Building Materials (once; safe to repeat)
```

### Dashboard

Shows total products, categories, in stock, out of stock, currently unavailable and hidden products, plus the most recent price changes (from Milestone 6). Stock numbers count only products that are shown on the website.

### Categories (`/admin/categories`)

| Action | How |
| --- | --- |
| Add | **Add category** → English and/or Hindi name, optional descriptions, display order (lower = first) |
| Edit | **Edit** on the category |
| Hide / show | **Hide** removes the category *and all its products* from the website without deleting anything |
| Delivery note | Tick **Show "delivery charges may vary" note** for sand, gravel, aggregates, etc. (on by default for Sand) |
| Delete | Only possible when the category has no products (move or delete them first, or just hide it). Duplicate names are refused. |

### Products (`/admin/products`)

| Action | How |
| --- | --- |
| Add | **Add product** → name (English and/or Hindi), brand, category, **unit** (e.g. Per 50 KG Bag, Per KG, Per Trolley), selling price, optional MRP, availability, description, photo |
| Find | Search by English/Hindi name, brand or category; filter by category, stock status and shown/hidden |
| Change stock | Pick In Stock / Out of Stock / Currently Unavailable straight from the list. This never changes the price or price history. |
| Hide / show | **Hide** removes it from the website but keeps it; out-of-stock products stay visible to customers with their status |
| Edit | **Edit** → change any detail, including the unit, category, MRP and photo |
| Delete | **Delete** removes the product and its photo permanently (its price history is kept) |

**Prices:** the selling price is entered when a product is added. To *change* it later, use **Update Prices** (see section 12), so every change is recorded in price history. The edit form shows the current price as read-only with links to Update Prices and the product's price history; the product list has a **Price** button on every product. Price rules: not negative, numbers only, at most 2 decimals, MRP not lower than the selling price.

**Photos:** JPG, PNG or WebP. The browser shrinks large phone photos (longest side 1200px) before uploading. The server checks the real file type from the file contents (renamed or fake files are rejected) and allows at most 5 MB. With Cloudinary configured, photos are stored in `nirmaan/products` and delivered at a maximum of 800px in the best format and quality for each phone. Replacing or deleting a photo also deletes the old file.

### Shop Settings (`/admin/settings`)

Fill these in once; they appear on the customer website from the next visit or refresh:

| Field | Shown where |
| --- | --- |
| दुकान का नाम (हिंदी) / Shop name (English) | Header, page title, contact section |
| Shop logo | Header (replaces the shop icon) and footer. JPG/PNG/WebP; stored in Cloudinary `nirmaan/shop`, delivered at max 400px |
| Big shop photo | **हमारी दुकान / Our shop** section below the product list. A wide photo of the shop front works best. Shrunk on the phone to at most 1600px before upload; stored in Cloudinary `nirmaan/shop`; customers' phones download the size their screen needs |
| Phone number | **Call** button in the header, contact section, **Call to confirm price** on product pages |
| WhatsApp number | **Chat on WhatsApp** in the contact section, **Ask on WhatsApp** on product pages (a 10-digit number gets +91 automatically) |
| पता (हिंदी) / Address (English) | Header (short) and contact section |
| About the shop (Hindi / English) | Contact section |
| Website address | Kept for your records. The printed QR code uses the server's `PUBLIC_SITE_URL` (Milestone 7), so a typo here can never break the QR code. |

Leave a field empty to hide it from customers.

### Photo Gallery (`/admin/gallery`)

- **Add photos** → choose one or several photos from the phone; each is shrunk (max 1600px) and uploaded one after another, with progress shown. At most **40 photos** (the page shows how many are used); delete one to make room.
- Each photo can have a caption in Hindi and English (optional, 150 characters); **Save caption**.
- **Delete** removes the photo from the website and from storage (after a confirmation).
- Stored in Cloudinary `nirmaan/gallery` (or the local `uploads/gallery` folder in development).

### Reviews (`/admin/reviews`)

- Customers write reviews on the website; each one waits here under **इंतज़ार में / Waiting** until you act. The dashboard shows how many are waiting, with a **Check reviews** button.
- **Approve and show** puts a review on the website. **Hide from website** moves an approved review back to Waiting. **Delete** removes it permanently (after a confirmation). The owner cannot change a customer's name, stars or text.
- Approve honest reviews, including critical ones; delete spam, rude text, or reviews containing personal details such as phone numbers or addresses.

### Admin API (all require `Authorization: Bearer <token>`)

| Method & path | Purpose |
| --- | --- |
| `GET /api/admin/meta` | Measurement units and availability options (English + Hindi) |
| `GET /api/admin/dashboard/stats` | Dashboard numbers |
| `GET /api/admin/categories` | All categories with product counts |
| `POST /api/admin/categories` · `PUT /api/admin/categories/:id` · `DELETE /api/admin/categories/:id` | Create / update (partial) / delete (only when empty → otherwise `409`) |
| `GET /api/admin/products?search=&category=&availability=&status=all\|active\|inactive&page=&limit=` | List with search, filters and pages (max 100 per page) |
| `POST /api/admin/products` · `GET/PUT/DELETE /api/admin/products/:id` | Create (includes the first `sellingPrice`) / read / update details (no `sellingPrice`) / delete |
| `PUT /api/admin/products/:id/image` (multipart field `image`) · `DELETE /api/admin/products/:id/image` | Upload/replace or remove the photo |
| `PATCH /api/admin/products/:id/price` | Change the selling price (and optionally MRP); records price history (see section 12) |
| `GET /api/admin/price-history?product=&search=&page=&limit=` | Price changes, newest first |
| `GET /api/admin/qr-code` | The permanent QR code (PNG + SVG) for `PUBLIC_SITE_URL`, with print-readiness warnings (see section 13) |
| `GET /api/admin/shop` · `PUT /api/admin/shop` | Read / update shop details (partial update; phone, WhatsApp and website validated) |
| `PUT /api/admin/shop/logo` (multipart field `image`) · `DELETE /api/admin/shop/logo` | Upload/replace or remove the shop logo |
| `PUT /api/admin/shop/photo` (multipart field `image`) · `DELETE /api/admin/shop/photo` | Upload/replace or remove the big shop photo |
| `GET /api/admin/gallery` · `POST /api/admin/gallery` (multipart field `image`) | List gallery photos (with the 40-photo limit) / add one (`409 GALLERY_FULL` when full) |
| `PUT /api/admin/gallery/:id` · `DELETE /api/admin/gallery/:id` | Update captions / delete a photo and its file |
| `GET /api/admin/reviews?status=pending\|approved&page=&limit=` | Reviews in one group, newest first, with the count in each group |
| `PATCH /api/admin/reviews/:id` `{ status }` · `DELETE /api/admin/reviews/:id` | Approve (`approved`) or hide (`pending`) a review / delete it |

## 12. How to update product prices

Prices change **only** when the owner changes them. The application never fetches or adjusts prices by itself.

### Step by step (phone or computer)

1. Log in at `/admin/login` and open **Update Prices** (menu, dashboard button, or the **Price** button next to a product).
2. Find the product: search by English/Hindi name, brand or category, or pick a category.
3. Type the **new price** in its box (e.g. `380` or `65.50`). The row shows `₹370 → ₹380`. Leave the box empty to keep the current price.
4. If the new price is higher than the MRP, change the **MRP** box too (or clear it). The row explains what is wrong before you can save.
5. Tap **Save** on the row, or change several rows and tap **Save all changes** at the bottom.
6. The row confirms `Saved: ₹370 → ₹380`. Customers see the new price the next time they open or refresh the website. **The QR code does not change.**

Safety checks:

| Situation | What happens |
| --- | --- |
| Change of more than 50% (e.g. ₹380 → ₹3800) | You are asked to confirm, in case of a missing or extra zero |
| Price was changed meanwhile on another phone/tab | The save is refused with "This price was changed meanwhile to ₹…"; the list refreshes so you can decide again |
| Invalid price (text, negative, more than 2 decimals, below MRP rule) | The row shows the reason; nothing is saved |
| Same price saved again, or only the MRP changed | Saved, but **no** price-history entry (history records selling-price changes only) |
| Stock status changed (In Stock / Out of Stock / Unavailable) | Never creates a price-history entry; managed separately on the Products page |

### Price History (`/admin/price-history`)

Lists every selling-price change, newest first: product (current name, or the saved name if the product was deleted), **old → new price**, difference in ₹ and %, **date and time** (server time) and **who made the change**. Search by product name, or open one product's history from its edit page. The dashboard shows the five most recent changes.

### How it works (technical)

- `PATCH /api/admin/products/:id/price` with `{ sellingPrice, mrp?, expectedPrice? }`.
- The product update and its history entry are written in **one MongoDB transaction**: there is never a price change without a history entry or the other way round. If validation fails (e.g. MRP), nothing is saved.
- A history entry (`product`, product name snapshot, `previousPrice`, `newPrice`, `updatedBy`, server `createdAt`) is created **only when the selling price actually changes**; `priceUpdatedAt` on the product (shown to customers as "Price updated") moves at the same moment.
- `expectedPrice` (the price shown on the owner's screen) prevents silently overwriting a newer change; two simultaneous saves of the same product result in one success and one `409 PRICE_CHANGED`.
- `GET /api/admin/price-history?product=&search=&page=&limit=` returns entries with `difference`, `percentChange` and `updatedBy`.
- The public catalogue sends `Cache-Control: no-cache`, so the new price reaches customers on their next load.

## 13. The permanent shop QR code

### What it contains

**Only the website address**, exactly the value of the backend setting `PUBLIC_SITE_URL` (for example `https://your-shop.vercel.app/`). No prices, products, categories or shop details are inside it. When a customer scans it, the website opens and loads the latest data from the database.

Because the address never changes, the QR code **never needs to be regenerated or reprinted** when prices, products, categories or shop details change. The same address always produces the identical image (verified by automated tests).

It uses the highest error-correction level (still scans if about 30% of the print is dirty or torn), a standard white border, and pure black on white.

### Admin → QR Code (`/admin/qr-code`)

| Item | Use |
| --- | --- |
| Status | **Ready to print** for a proper `https://` website address. A **warning** ("Do not print this QR code yet") appears for `localhost`, local Wi-Fi addresses (10.x, 192.168.x, 172.16–31.x), bare IP addresses, `http://`, or addresses with `?`/`#` parts |
| QR preview + address | Shows exactly what the code opens; **Copy address** and **Open website** to check it |
| Download QR (PNG) | 1024×1024 image for printing or sharing |
| Download QR (SVG) | Vector file that stays sharp at any size (give it to a print shop for boards or flex banners) |
| Printable poster (A4) | Shop name (Hindi + English, from Shop Settings), **"नवीनतम रेट देखने के लिए स्कैन करें"**, **"Scan to Check Latest Prices"**, the QR code, phone number and website address. **Download poster (PNG)** or **Print poster** (prints only the poster, one A4 page) |

While the address is a development one, every download is named `TEST-…` and the poster carries a red **"TEST ONLY – DO NOT PRINT"** label, so a temporary code cannot be printed by mistake. If the website address in Shop Settings differs from `PUBLIC_SITE_URL`, the page points this out (the QR code always uses `PUBLIC_SITE_URL`).

### Getting the final QR code

1. Deploy the website (Milestone 9) and note its permanent address, e.g. `https://your-shop.vercel.app`. A custom domain such as `https://yourshop.in` is the most permanent choice.
2. Set `PUBLIC_SITE_URL` to that address in the backend's environment (Render dashboard, or `backend/.env`) and restart the backend.
3. Open **Admin → QR Code**: it must say **Ready to print** and show your final address. Tap **Open website** to confirm.
4. Download/print the poster. Scan it with a phone (mobile data, not Wi-Fi) to confirm before laminating or framing.
5. Keep the same address for as long as the poster is in use. If the address ever has to change, a new QR code must be printed.

### Testing with a phone during development

`localhost` only works on this computer. To scan with a phone on the same Wi-Fi:

1. Run the frontend with `npm run dev:lan` and note its Wi-Fi address (e.g. `http://192.168.1.20:5173`).
2. Temporarily set `PUBLIC_SITE_URL=http://192.168.1.20:5173` in `backend/.env` (the backend restarts by itself).
3. Open Admin → QR Code (marked TEST), scan it with the phone, change a price in the admin, scan again: the new price appears.
4. Set `PUBLIC_SITE_URL` back afterwards. Do not print this test code.

### Technical

- `GET /api/admin/qr-code` (admin login required) returns `{ url, isProductionReady, warnings, notes, svg, pngDataUrl, shop }`. Generated with the `qrcode` library (error correction `H`, margin 4); nothing is stored.
- The poster PNG is drawn in the browser on a canvas (1240×1754 px, A4 at 150 dpi); **Print poster** uses print-only CSS so just the poster fills one A4 page.
- Tests decode the generated PNG with an independent QR reader (`jsqr`) to confirm it contains exactly the address, and confirm the image is identical after prices, products, categories and shop details change.

## 14. Production deployment

Free-tier hosting: **Vercel** (website), **Render** (API), **MongoDB Atlas** (database, already set up), **Cloudinary** (photos, already set up). No domain or paid plan is needed.

> **Nothing has been deployed yet.** The configuration below is ready; deploying is the shop owner's decision.

### How the pieces connect

```
Customer phone ──QR──► https://your-shop.vercel.app  (Vercel: the React website)
                              │  fetch https://nirmaan-api.onrender.com/api/...
                              ▼
                     https://nirmaan-api.onrender.com  (Render: Express API)
                              ├──► MongoDB Atlas (database "nirmaan")
                              └──► Cloudinary (photos, folder "nirmaan")
```

### Files prepared for hosting

| File | Purpose |
| --- | --- |
| `render.yaml` | Render Blueprint: free web service in Singapore, `rootDir: backend`, `npm ci --omit=dev`, `npm start`, health check `/api/health`, Node 24, `NODE_ENV=production`, `TRUST_PROXY=1`, a **random `JWT_SECRET` generated by Render**, and the secrets/addresses you must type in (`sync: false`) |
| `frontend/vercel.json` | Vite build to `dist`; every app address (e.g. `/products/…`, `/admin/…`) serves `index.html`, but missing `/assets/…` files stay 404; security headers (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS); hashed assets cached for one year |
| `frontend/vite.config.js` | Production builds add a **Content-Security-Policy** to `index.html`, built from `VITE_API_URL`: only the site itself, the API and Cloudinary images are allowed |
| `frontend/public/robots.txt` | Search engines may list the price list but not `/admin` |
| `backend/config/productionChecks.js` | On start in production, the log warns if Cloudinary is missing, `PUBLIC_SITE_URL` is not a final https address, `TRUST_PROXY` is 0, or `CORS_ORIGINS` does not include the website |

### Important: Render needs a Git repository

Render deploys **only from a Git repository** (GitHub, GitLab or Bitbucket; it can be **private**). This project has deliberately not been put in any repository. When you decide to deploy:

- **Recommended:** create a **private** repository yourself, push this project to it (`.env` files are git-ignored and stay on your computer; check with `git status` before the first push), then connect it in Render and Vercel. Later updates deploy automatically when you push.
- **Website without Git:** Vercel can also deploy straight from your computer with its command-line tool (`npx vercel` inside `frontend/`, then `npx vercel --prod`). The API still needs Render (or another host) with a repository.

The suggested commit messages for each milestone are in `COMMIT_MESSAGES.md`.

### Step 1 – MongoDB Atlas for production

1. **Database user for the app:** Atlas → Database Access → *Add New Database User* → password authentication with a long generated password → *Specific Privileges* → `readWrite` on database **`nirmaan`** only. (Least privilege: the hosted API can then not touch any other database.) Keep your current user for local development if you like.
2. **Network Access:** Render's free plan has no fixed outgoing IP address, so add **`0.0.0.0/0`** (allow from anywhere). The database stays protected by the user name and the long password, and every connection is encrypted (TLS).
3. Copy the connection string (Database → Connect → Drivers) with the new user's password. You will paste it into Render as `MONGODB_URI`.

> Free M0 clusters have no automatic backups. Atlas → Collections lets you export data; doing that now and then (or after big price updates) is a good habit.

### Step 2 – API on Render

1. Create a free account at <https://render.com> and connect your Git provider (private repository).
2. **New → Blueprint**, pick the repository; Render reads `render.yaml` and proposes the service **`nirmaan-api`**.
3. Fill in the values it asks for:

   | Variable | Value |
   | --- | --- |
   | `MONGODB_URI` | The production connection string from Step 1 |
   | `CORS_ORIGINS` | Your website address, e.g. `https://your-shop.vercel.app` (no trailing `/`). Not known yet on the first deploy: enter `https://example.invalid` for now and fix it in Step 4 |
   | `PUBLIC_SITE_URL` | Same as `CORS_ORIGINS` for now; fixed in Step 4 |
   | `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | From your Cloudinary dashboard |

   `JWT_SECRET` is generated by Render; the other values come from `render.yaml`.
4. Create the Blueprint. When the deploy finishes, open `https://<your-service>.onrender.com/api/health`. It should show `"database":"connected"`.
5. Check the Render **Logs**: `[config] WARNING` lines tell you what is still missing (they are expected for `CORS_ORIGINS`/`PUBLIC_SITE_URL` until Step 4).

### Step 3 – Website on Vercel

1. Create a free account at <https://vercel.com>. **Add New → Project**, import the same repository.
2. Settings: **Root Directory `frontend`**, Framework **Vite** (detected; `vercel.json` sets build command and output folder).
3. **Environment Variable:** `VITE_API_URL` = `https://<your-service>.onrender.com/api`.
4. Deploy. Note the address, e.g. `https://your-shop.vercel.app`. Choose the project name carefully (or add a custom domain, see below): **this address goes into the printed QR code**.
   *(Without Git: in `frontend/`, run `npx vercel`, answer the questions, add `VITE_API_URL` with `npx vercel env add VITE_API_URL production`, then `npx vercel --prod`.)*

### Step 4 – Connect them

1. Render → `nirmaan-api` → Environment: set `CORS_ORIGINS` **and** `PUBLIC_SITE_URL` to the Vercel address (e.g. `https://your-shop.vercel.app`). Save; Render restarts the API.
2. The Render log should now show **no** `[config] WARNING` lines.

### Step 5 – First use and checks

1. On your computer, create the owner account in the **production** database: set `backend/.env` to the production `MONGODB_URI` and `MONGODB_DB_NAME=nirmaan` (or use the values you already have if they point to the same database), then run `npm run create-admin` and, if not done yet, `npm run seed:categories`.
2. Open `https://your-shop.vercel.app/admin`, log in, fill in **Shop Settings**, add products and prices.
3. Open **Admin → QR Code**: it must say **Ready to print** and show your Vercel address. Tap **Open website**.
4. On a phone **using mobile data** (not your Wi-Fi), open the site: Hindi by default, prices visible, switch to English, open a product.
5. Download or print the **poster**, scan it with the phone, change a price in the admin, scan again: the new price appears.
6. Laminate/frame the poster. Do not change the website address afterwards.

### Deployment checklist

- [ ] Atlas: app user with `readWrite@nirmaan`, network access `0.0.0.0/0`, long password
- [ ] Render: `MONGODB_URI`, `CORS_ORIGINS`, `PUBLIC_SITE_URL`, Cloudinary values set; `/api/health` connected; no `[config] WARNING` lines
- [ ] Vercel: root `frontend`, `VITE_API_URL` set; site loads; product photos load
- [ ] Owner account created; Shop Settings filled in; categories and products added
- [ ] QR page says **Ready to print**; poster scanned successfully on mobile data
- [ ] `.env` files never uploaded anywhere (check `git status` before the first push)

### Free-tier limits to know

| Service | Free limit | What it means for the shop |
| --- | --- | --- |
| Render | Sleeps after 15 min without visits; waking takes up to ~1 min; 750 instance hours/month (enough for one service running all month) | The first customer after a quiet period waits a little; the website shows "Connecting to the shop server…". Optional: a free uptime monitor (e.g. UptimeRobot or cron-job.org) can open `/api/health` every 10–14 minutes to keep it awake. This is an outside service; your choice. |
| Render disk | Wiped on every restart/deploy | Product photos must be in Cloudinary (already configured); the start-up log warns otherwise |
| Vercel Hobby | Generous bandwidth for a shop website; for personal/non-commercial projects per Vercel's terms | Check Vercel's current terms for a business site; Cloudflare Pages or Netlify are alternatives for the static website |
| MongoDB Atlas M0 | 512 MB storage, no automatic backups | Thousands of products and years of price history fit easily; export data occasionally |
| Cloudinary Free | 25 monthly credits | Product photos and thumbnails use a tiny fraction |

### Custom domain (optional, most permanent)

A domain such as `yourshop.in` (bought by you, about ₹500–1000/year) can be added in Vercel → Project → Domains. Then set `CORS_ORIGINS` and `PUBLIC_SITE_URL` on Render to `https://yourshop.in` **before** printing the QR code. A domain you own never depends on a hosting project's name.

### Updating the application later

Push changes to the repository: Render and Vercel redeploy automatically. Prices, products and shop details are changed in the admin, not by redeploying. **The QR code stays the same** as long as the website address does not change.

## 15. Security notes

- Secrets live only in `.env` files / hosting dashboards; `.env` files are git-ignored.
- The backend refuses to start with a missing, short or placeholder `JWT_SECRET`, or a placeholder `MONGODB_URI`.
- The Atlas connection string is never written to logs (only the cluster host name).
- Helmet security headers, a CORS allow-list, request size limits (100 KB JSON) and rate limiting are enabled on the API.
- Passwords are stored only as bcrypt hashes; the hash is excluded from every query result and API response by default.
- Admin pages tell search engines not to index them (`noindex`).
- Uploads: only JPG/PNG/WebP, max 5 MB, one file per request; the real type is detected from the file's first bytes (SVG, GIF, scripts and renamed files are refused); stored names are random; local files are served with `nosniff`.
- All admin input is validated with Zod (unknown fields rejected, text lengths limited, prices checked) and again by the database models. Search text is escaped, so it is always matched literally.
- The frontend build contains no secrets (verified: JWT secret, Cloudinary secret and database password are absent from `frontend/dist`).

### Security checks (Milestone 8)

| Requirement / risk | Result | Where it is tested |
| --- | --- | --- |
| Public users cannot access admin APIs | Every `/api/admin/*` URL answers 401 without a valid token (even unknown URLs); 403 without the admin role | `auth.test.js`, all admin API test files |
| Invalid JWT tokens are rejected | Garbage, wrong secret, `alg: none`, wrong audience, tampered, expired, unknown admin, revoked (password reset) | `auth.test.js` |
| Token only in the `Authorization` header | Tokens in the URL or a cookie are ignored | `security.test.js` |
| Passwords stored as hashes | bcrypt (cost 12); hash never selected or returned | `auth.test.js`, `createAdmin.test.js`, `security.test.js` |
| Login brute force | 10 failed attempts per IP / 15 min, same message and timing for unknown email | `auth.test.js` |
| Invalid product prices rejected | Negative, text, >2 decimals, MRP below price, unknown fields; nothing saved on error (transaction) | `products.test.js`, `price.test.js` |
| Invalid uploads rejected | Fake/renamed files, GIF, SVG, >5 MB, extra/missing files; real type checked from file bytes | `products.test.js`, `shop.test.js` |
| Query / NoSQL injection | `?search[$ne]=…` and `{ "$gt": "" }` bodies are ignored or rejected; search text is regex-escaped | `security.test.js`, `auth.test.js` |
| Prototype pollution, mass assignment | `__proto__`/`constructor` and any unknown field are rejected (strict schemas) | `security.test.js` |
| Path traversal | `/uploads/../.env` and encoded variants answer 404; nothing outside the uploads folder is served | `security.test.js` |
| Error details | Production errors say only "Something went wrong" (no message, stack or connection string); client errors such as an unsupported body encoding answer 4xx, not 500 | `security.test.js` |
| Security headers | CSP, `nosniff`, `X-Frame-Options`, no `X-Powered-By` on every API response; CORS only for configured origins | `app.test.js`, `security.test.js` |
| Sensitive values not exposed | No secret value in any API response, in any project file other than `backend/.env`, or in the frontend build; `.env` files git-ignored; `.env.example` files contain placeholders only | `security.test.js`, Milestone 8 scan |
| Dangerous code | No `dangerouslySetInnerHTML`, `eval`, `innerHTML` or `new Function` in the code | Milestone 8 scan |
| Dependencies | `npm audit --omit=dev`: 0 known vulnerabilities in backend and frontend | Milestone 8 scan |

The hosted website adds its own protection: a Content-Security-Policy in `index.html` (only the site, its API and Cloudinary images are allowed) and headers from `frontend/vercel.json` (`X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS). A local production rehearsal (production build + production-mode API on separate origins, tested in Edge) showed **no policy violations** and no browser errors.

## 16. Troubleshooting

| Problem | Fix |
| --- | --- |
| `querySrv ECONNREFUSED _mongodb._tcp...` but `nslookup -type=SRV _mongodb._tcp.<cluster>` works | Node.js is using an unusable DNS server on this PC (often `127.0.0.1` from a VPN/ad-blocker/virtual adapter). Add `DNS_SERVERS=8.8.8.8,1.1.1.1` to `backend/.env`. Not needed on Render. |
| `querySrv ETIMEOUT` or `read ECONNRESET` (with `DNS_SERVERS` already set) | The internet connection dropped briefly (common on mobile data/hotspots). The server retries its first connection 3 times automatically; otherwise just run the command again. |
| `bad auth` / `Authentication failed` | Use the Atlas **Database User** password (not your Atlas login) and URL-encode special characters. |
| `Server selection timed out` | Add your current IP in Atlas → Network Access, wait a minute, retry. |
| `Port 5173 is already in use` / `EADDRINUSE :5000` | An old dev server is still running. Close its terminal, or find it with `netstat -ano \| findstr ":5000 :5173"` and stop it with `taskkill /PID <pid> /F`. |
| Cloudinary check: `401` | API key/secret wrong; copy again from Cloudinary → Settings → API Keys. |
| `Too many login attempts` | 10 wrong passwords in 15 minutes from the same network. Wait 15 minutes, or reset the password with `npm run create-admin`. |
| `create-admin` shows the password while typing | Some terminals (e.g. Git Bash/mintty) cannot hide input. Use PowerShell, Command Prompt or the VS Code terminal instead. |
| Admin keeps getting logged out | The login is valid for `JWT_EXPIRES_IN` (default `1d`). A password reset also logs out all devices. |
| "The image could not be uploaded" | Cloudinary was unreachable or rejected the upload. Run `npm run cloudinary:check`; the product itself is saved, so just choose the photo again on its edit page. |
| "This file is not a valid JPG, PNG or WebP image" | The file's contents are not a real photo (e.g. a renamed file or a HEIC photo). Take a screenshot of it, or set the phone camera to "Most compatible" (JPEG). |
| Category cannot be deleted | It still has products. Move them to another category (Edit product → Category), delete them, or simply hide the category. |
| QR Code page says "Do not print this QR code yet" | `PUBLIC_SITE_URL` is still a development address. Set it to the final `https://` website address and restart the backend. |
| Phone cannot open the scanned test QR | `localhost` only works on the computer itself. Use the Wi-Fi address (see section 13, "Testing with a phone"), and allow Node.js through Windows Firewall on private networks. |
| No Admin button on the website | The button appears only on devices where the owner has logged in. Open `/admin` once on that device and log in. After **Logout** it is hidden again on purpose. |
| "This price was changed meanwhile" | Someone (or you on another phone/tab) saved a different price after your screen loaded. The list refreshes; check the current price and save again if needed. |
| Cannot save a price higher than the MRP | Raise the MRP in the same row, or clear the MRP box. |
| A product is missing on the customer website | Check that the product is **shown** and that its **category is shown** (Admin → Products / Categories). Out-of-stock products are always listed. |
| Customer site keeps showing "Connecting to the shop server…" | The backend is waking up (free hosting) or unreachable. Wait a minute and tap **Try again**; check `GET /api/health`. |

## 17. Known notes

- `npm audit` reports a *moderate* advisory in `minimatch`, which is used only by ESLint (a development tool). It does not ship to customers; production dependencies report 0 vulnerabilities.
- Cloudinary image URLs are generated without the SDK's tracking parameter (`analytics: false`), so photo addresses are plain and stable.
- Do not run the backend on port **5060 or 5061**: browsers and Node's `fetch` refuse these "bad ports" (used for internet telephony). The default port 5000 is fine.
