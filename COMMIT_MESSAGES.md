# Future Git Commit Messages

Suggested commit messages, one per completed milestone, in chronological order.
These are **saved for later use only**: nothing here has been committed or pushed,
and no Git repository or remote has been created.

---

## Milestone 1 – Project Setup

**Work completed**

- Created `backend/` (Express 5, Mongoose 9) and `frontend/` (React 19, Vite 8, Tailwind CSS 4, React Router 7, Axios, Lucide) with the planned folder structure.
- MongoDB Atlas connection with readable error hints; credentials never logged; `npm run db:check` script.
- Optional `DNS_SERVERS` setting to work around Windows machines where Node.js gets an unusable DNS server for the Atlas SRV lookup.
- `npm run cloudinary:check` script to verify Cloudinary credentials (read-only).
- Zod-validated environment configuration; `.env.example` templates (root, backend, frontend).
- Express setup: Helmet, CORS allow-list, 100 KB JSON limit, API rate limiter, consistent JSON errors, `/api/health`.
- Initial Mongoose models: Admin, Category, Product, PriceHistory, Shop (with price, unit, availability and bilingual-name validation and indexes).
- Vite dev proxy for `/api`, Tailwind colour tokens, Hindi-capable font stack, temporary setup-check page.
- Automated tests with the Node.js test runner.

**Suggested commit message**

```
chore: initialize MERN building material price catalogue

- scaffold Express 5 + Mongoose 9 backend and React 19 + Vite 8 + Tailwind 4 frontend
- add MongoDB Atlas connection, validated env config and .env.example templates
- add db:check and cloudinary:check scripts and optional DNS_SERVERS override
- add Admin, Category, Product, PriceHistory and Shop models with validation
- configure helmet, CORS allow-list, rate limiting and JSON error handling
- add health endpoint, setup-check page and automated tests
```

**Short description:** Project skeleton, Atlas database connection, security middleware and data models.

---

## Milestone 2 – Admin Authentication

**Work completed**

- `POST /api/auth/login` and `GET /api/auth/me`; no public registration route.
- JWT (HS256, issuer/audience checked, 1-day default expiry) and bcrypt password hashing (cost 12).
- `requireAuth` / `requireRole` middleware: the admin is re-loaded on every request, and `tokenVersion` revokes old sessions after a password reset. Everything under `/api/admin/*` is protected.
- Login rate limiting (10 failed attempts per IP per 15 minutes); the same error and similar timing for unknown email and wrong password.
- `npm run create-admin` script: interactive, hides the password while typing, enforces a password policy, and can reset the password of an existing account.
- Frontend: lazily loaded admin area with `AuthProvider`, protected routes, a mobile-friendly admin layout, a login page, a dashboard and placeholder sections. Axios interceptors send the token only to admin endpoints and handle expired sessions.
- Tests: 21 HTTP authentication tests, 4 `create-admin` script tests, and a live end-to-end check through the Vite proxy.

**Suggested commit message**

```
feat: implement secure admin authentication

- add login and current-admin endpoints with JWT and bcrypt
- protect /api/admin with auth + role middleware and token revocation
- rate-limit failed logins and equalise unknown-email timing
- add create-admin script with hidden password input and reset flow
- add admin login page, protected routes and admin layout (lazy-loaded)
- add authentication and create-admin tests
```

**Short description:** Secure owner login, protected admin API and pages, and a terminal script to create or reset the admin account.

---

## Milestone 3 – Product and Category Management

**Work completed**

- Category API: list with product counts, create, partial update, and delete (refused while products exist). Duplicate names are refused regardless of letter case. Categories have a display order and a "delivery charges may vary" flag.
- `npm run seed:categories`: creates Cement, TMT Rod, Sand and Other Building Materials (bilingual); safe to repeat.
- Product API: list with search (English/Hindi name, brand, category), filters and pagination; create (with the initial price), get, partial update of details, and delete. The selling price cannot be changed through edit; that is reserved for the price-history flow in Milestone 6.
- 16 bilingual measurement units; availability is managed separately from price.
- Image uploads: Multer (5 MB, one file), real file-type detection, Cloudinary storage in `nirmaan/products` with optimized delivery URLs, or a local disk fallback. Old images are deleted on replace/delete.
- Dashboard stats endpoint and admin meta endpoint (units and availability options).
- Frontend: dashboard summary cards; product list (search, filters, quick stock change, hide/show, delete, pagination); product add/edit form with bilingual fields and in-browser photo resizing; category management page.
- Tests: 34 new backend tests (89 total) and a 27-check live end-to-end run including real Cloudinary upload, replace and delete.

**Suggested commit message**

```
feat: add product and category management

- add category CRUD with product counts, duplicate-name and delete guards
- add seed script for the four default bilingual categories
- add product CRUD with search, filters, pagination and per-product units
- keep selling price out of product edit (reserved for price history flow)
- add validated image uploads (Cloudinary or local) with cleanup on replace/delete
- add dashboard stats, admin meta endpoint and admin UI pages
- add category, product, image and seed script tests
```

**Short description:** Owner can manage categories and products (units, MRP, initial price, stock status, visibility, photos) from the admin dashboard.

---

## Milestone 4 – Public Catalogue

**Work completed**

- Public read-only API: `/api/public/shop`, `/categories`, `/products` (search, category, pages, `lastUpdated`) and `/products/:id`. Only active products in active categories are listed; out-of-stock and unavailable ones stay visible. Customer-only fields are returned. `Cache-Control: no-cache` plus ETag gives fresh prices with `304` revalidation.
- Customer website: shop header with a call button; price list with last-updated date, refresh button, price notice, instant search (English/Hindi), category filter buttons, and product cards (photo, price + unit, MRP, availability, delivery note); product detail page with call/WhatsApp buttons; loading, slow-server, error, empty and no-results states; search/filter kept in the URL; scroll position restored on Back.
- Translation layer (`src/i18n`) ready for Hindi in Milestone 5.
- Removed the temporary Milestone 1 setup-check page. Disabled the Cloudinary URL tracking parameter.
- Resilience: the server retries its first Atlas connection (3 attempts) on temporary network errors; clearer hints for DNS timeouts and dropped connections; a 2-minute per-test limit so tests never hang.
- Tests: 15 public API backend tests; new frontend test setup (Vitest + Testing Library) with 24 component tests; live end-to-end check (26 checks, including a real Cloudinary photo and 304 revalidation through the proxy).

**Suggested commit message**

```
feat: build public product catalogue with search and filters

- add read-only public API for shop, categories, products and product details
- list only visible products; keep out-of-stock items with their status
- send no-cache + ETag so customers always get the latest prices
- add customer price list with instant search, category filters and refresh
- add product detail page with call and WhatsApp buttons
- add loading, slow-server, error and empty states; i18n-ready texts
- retry the initial Atlas connection on temporary network errors
- add public API tests and frontend component tests (Vitest)
```

**Short description:** The customer-facing price list that the shop QR code opens, with search, category filters, product details and always-fresh prices.

---

## Milestone 5 – Hindi and English

**Work completed**

- Hindi dictionary for every customer-facing text in simple everyday Hindi; the site opens in Hindi by default.
- A visible हिंदी | English switch. Switching is instant (no reload, no refetch, search kept) and remembered for the browsing session; the page `lang` attribute follows the choice.
- Bilingual database fields (product, category, shop) and units shown in the selected language, with fallback to the other language when one is empty; Hindi dates.
- Shop Settings: admin API (`GET/PUT /api/admin/shop`, logo upload/remove) and `/admin/settings` page with Hindi and English fields, phone/WhatsApp/website validation, and a logo stored in Cloudinary `nirmaan/shop` (400px delivery). The admin area is marked as English.
- Tests: 7 backend Shop Settings tests; 26 new frontend tests (translation completeness, language provider, Hindi catalogue/product pages, language switching, Shop Settings page); live end-to-end check (18 checks, including a real Cloudinary logo).

**Suggested commit message**

```
feat: add Hindi and English language support

- add Hindi dictionary for all customer-facing texts; Hindi is the default
- add language switch that applies instantly and is remembered per session
- show bilingual product, category, shop and unit data with fallback
- add shop settings API and admin page with bilingual fields and logo upload
- add translation completeness, language switching and settings tests
```

**Short description:** The customer site is fully bilingual (Hindi default, English on one tap), and the owner can set the shop's name, logo, contact details and address in both languages.

---

## Milestone 6 – Price Management

**Work completed**

- `PATCH /api/admin/products/:id/price`: manual price update (optionally with MRP). The product change and its price-history entry are saved in one MongoDB transaction, with server-side timestamps and the admin who made the change. History is written only when the selling price actually changes. An `expectedPrice` guard refuses to overwrite a price changed meanwhile (`409 PRICE_CHANGED`).
- `GET /api/admin/price-history`: newest first, with difference in ₹ and %, updated-by, product filter, name search and pages; readable after product deletion.
- Update Prices page: search and category filter, a new-price and MRP box per product, per-row save and "Save all changes", live `₹old → ₹new` preview, validation messages, a confirmation for changes over 50%, and conflict handling.
- Price History page, links from the product list, product edit page and dashboard (recent changes).
- Tests: 16 backend price tests (including simultaneous saves and transaction rollback); 19 new frontend tests; live end-to-end check (19 checks: customer sees ₹370 → owner changes it → customer immediately sees ₹380, history recorded).

**Suggested commit message**

```
feat: implement manual price updates and price history

- add price update endpoint saving price and history in one transaction
- record history only on real selling-price changes, with server time and admin
- refuse stale updates (expectedPrice) and handle concurrent saves
- add price history endpoint with differences, search and paging
- add Update Prices page with bulk save, typo guard and conflict handling
- add Price History page and dashboard/product links
- add price management backend and frontend tests
```

**Short description:** The owner can update any product's price in a few taps; customers see it immediately and every change is kept in a searchable price history.

---

## Milestone 7 – Permanent QR Code

**Work completed**

- `GET /api/admin/qr-code`: QR code (PNG 1024px + SVG, error correction H) encoding only `PUBLIC_SITE_URL`. It checks print readiness, warning about localhost, private Wi-Fi/IP addresses, `http://` and extra URL parts, notes a different Shop Settings website, and returns shop name and phone for the poster text.
- Admin QR Code page: ready-to-print / do-not-print status, preview, copy and open address, PNG/SVG downloads, A4 poster preview with the shop name, "नवीनतम रेट देखने के लिए स्कैन करें", "Scan to Check Latest Prices", phone and address. The poster can be downloaded as PNG (canvas) or printed (print-only CSS, one A4 page). Development addresses are marked TEST in file names and on the poster.
- Removed the "coming soon" placeholder; all admin sections are built.
- Tests: 8 backend QR tests that decode the image with an independent reader (jsqr) and confirm an identical image after price, product, category and shop changes; 15 new frontend tests (poster drawing, QR page); live end-to-end run of the spec's QR workflow (15 checks: generate → scan → open → change price → scan the same image → new price).

**Suggested commit message**

```
feat: generate permanent shop QR code

- add QR endpoint encoding only PUBLIC_SITE_URL (PNG + SVG, high error correction)
- warn when the address is not suitable for printing (localhost, LAN, http)
- add QR admin page with downloads, copy/open address and A4 poster
- add printable poster (PNG download and print-only layout) in Hindi and English
- verify QR content with an independent decoder and permanence across changes
```

**Short description:** One permanent QR code for the shop, which only holds the website address and never needs reprinting, with a printable bilingual poster.

---

## Milestone 8 – Final UI, Testing and Security

**Work completed**

- Real-browser QA of the production build in Microsoft Edge (Playwright, temporary scripts): full admin and customer workflows through the actual forms and pages at 360, 390, 768 and 1280 px; axe-core accessibility audit of 13 pages; poster PNG decoded and print layout verified as one A4 page; first-visit network measurement (45/45 checks).
- Accessibility: fixed 5 colour-contrast failures and a heading-order issue (product cards now `h2`); 0 axe violations remaining.
- UI: shorter product photo on phones so the price is visible without scrolling; full-width stock selector in the admin list on phones; aligned current-price block on Update Prices; vertically centred Hindi band on the poster; bilingual "page not found" inside the customer layout.
- Performance: removed the Google web font (built-in Devanagari fonts are used; −117 KB and no render-blocking third-party request); responsive Cloudinary thumbnails via `srcset` (200/400/800 px) for product cards, the product page, the logo and admin thumbnails. First visit went from ~240 KB to ~123 KB compressed.
- Security: `security.test.js` (query and body injection, prototype pollution, path traversal, token only in the header, security headers on all responses, CORS, no secrets in any API response, production error masking); the error handler now maps all 4xx errors from Express helpers (e.g. 415) instead of answering 500. A project-wide scan found no secrets outside `backend/.env` (including `dist`), no risky code patterns, and 0 production dependency vulnerabilities.
- Tests: backend suite (incl. 10 new security tests); frontend 89 tests (5 new: not-found page, responsive image URLs).

**Suggested commit message**

```
test: complete application testing and security checks

- run real-browser QA of admin and customer flows at phone, tablet and desktop sizes
- fix colour contrast and heading order (0 axe violations)
- improve phone layouts: product photo, admin stock selector, price rows, poster band
- add bilingual not-found page inside the customer layout
- drop the web font and serve responsive Cloudinary thumbnails (first visit ~123 KB)
- add security tests for injection, traversal, headers, secrets and error masking
- map Express 4xx errors correctly in the error handler
```

**Short description:** Verified the whole app in a real browser at phone, tablet and desktop sizes, fixed the accessibility, layout and performance issues found, and added security tests.

---

## Milestone 9 – Deployment Preparation

**Work completed**

- `render.yaml` (Render Blueprint): free web service in Singapore, `rootDir: backend`, `npm ci --omit=dev`, `npm start`, `/api/health` check, Node 24, production settings, a Render-generated `JWT_SECRET`, and dashboard-only (`sync: false`) secrets and addresses.
- `frontend/vercel.json`: SPA rewrites (but missing `/assets` files stay 404), security headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS), one-year caching of hashed assets. `robots.txt` keeps `/admin` out of search engines.
- Production builds get a Content-Security-Policy (`<meta>` in `index.html`, built from `VITE_API_URL`): only the site, its API and Cloudinary images; no inline or eval scripts.
- Production start-up warnings (`config/productionChecks.js`): Cloudinary missing, non-final `PUBLIC_SITE_URL`, `TRUST_PROXY=0`, website missing from `CORS_ORIGINS`. Site-address checks moved to `utils/siteUrl.js`.
- README: complete deployment guide (Atlas production user and network access, Render, Vercel with or without Git, connecting both, first use, checklist, free-tier limits, custom domain, updates), contents list, updated structure and stack. Verified that `.env.example`, `env.js` and `render.yaml` are consistent.
- Local production rehearsal (temporary script, nothing deployed): production build with a separate API origin, served with the `vercel.json` rules, plus the backend in `NODE_ENV=production`, tested in Edge. 20/20 checks: CORS, CSP with no violations, headers, deep links, caching, cross-origin images and admin login, poster QR decoded.
- Tests: production-warning tests (backend) and deployment-config tests (CSP, `vercel.json`) in the frontend suite.

**Suggested commit message**

```
chore: prepare application for production deployment

- add Render blueprint and Vercel config with security headers and caching
- add Content-Security-Policy to production builds based on VITE_API_URL
- warn at start-up about settings that are not ready for hosting
- add robots.txt and deployment configuration tests
- document step-by-step deployment, checklist and free-tier limits
```

**Short description:** Hosting configuration for Render and Vercel, production safeguards and a full deployment guide. Nothing deployed; deployment awaits the owner's approval.

---

## Update after Milestone 9 – Admin button in the website header

**Work completed**

- The customer website's top bar shows an **एडमिन / Admin** button only on the owner's devices: those where the owner has logged in, or a device with an active login. Customers never see it. Logout removes it from that device; an expired login keeps it, so the owner can log in again with one tap.
- The language label tucks away visually on narrow phones when the button is shown, so the top bar fits at 360 px. Screen readers still announce it.
- "View website" in the admin menu now opens the customer website in the same tab.
- Tests: 7 new frontend tests (button hidden for customers, shown for the owner, opens `/admin`, follows the language, device marker set by login and removed by logout). Checked in Edge at 360/390 px: no sideways scrolling.

**Suggested commit message**

```
feat: add owner-only admin button to the website header

- show an Admin button in the customer header only on devices where the owner logged in
- remove it on logout; keep it when a login expires
- open the customer website from the admin menu in the same tab
- add tests for button visibility and the owner's-device marker
```

**Short description:** The owner can jump from the customer website to the admin with one tap, while customers never see the button.

---

## Update after Milestone 9 – Admin in Hindi (default)

**Work completed**

- The admin opens in **Hindi by default**, with the same **हिंदी | English** switch as the customer website (top bar and login page). One language choice for the whole site per browser session.
- All admin screens translated: menu, login, dashboard, products, product form, categories, Update Prices, Price History, Shop Settings, QR Code and poster controls, confirmations, success/error messages, dates, page titles and screen-reader labels.
- Server messages are translated in the browser from error codes and known validation sentences (field names included); unknown messages fall back to the server's English text. The QR page's server notes now include a code (`WEBSITE_DIFFERS`) so they can be translated.
- Admin texts (`admin.hi.js`, `admin.en.js`) load only with the admin code, so the customer website does not get bigger.
- Tests: frontend 118 (new: Hindi-default admin pages, server-message translation, admin dictionary checks, typed-amount error codes); backend 150 (QR note format). Browser check in Edge of the Hindi admin: 24/24, axe-core 0 violations.

**Suggested commit message**

```
feat: add Hindi admin interface (Hindi default)

- translate all admin screens with a हिंदी | English switch, Hindi by default
- translate server error codes and validation messages in the browser
- return QR page notes with a code so they can be translated
- load admin translations only with the admin code
- add Hindi admin tests and admin dictionary checks
```

**Short description:** The shop owner can manage products, prices, settings and the QR code fully in Hindi, and switch to English at any time.

---

## Update after Milestone 9 – Shop photo, gallery, reviews, new product card and footer

**Work completed**

- **Shop photo:** one big photo, set in Shop Settings, shown below the product list ("हमारी दुकान / Our shop") with the shop name and address.
- **Photo gallery:** new admin page to add several photos at once (shrunk on the phone, max 40), with optional Hindi/English captions; shown below the shop photo as a grid with a full-screen viewer (buttons, swipe, keyboard; focus kept inside).
- **Customer reviews:** customers send a name, 1–5 stars and an optional comment without login; a review appears only after the owner approves it on the new admin Reviews page (the dashboard shows how many are waiting). Spam protection without paid services: strict validation, 5 accepted reviews per connection per hour, a hidden anti-bot field, and a cap of 100 waiting reviews. No IP or contact data stored.
- **Product card:** highlighted price panel with unit, MRP and the saving, category tag, two-line names, muted look for out-of-stock/unavailable items, nicer no-photo placeholder.
- **Footer:** shop name, logo and description, big call and WhatsApp buttons, address with an "Open in Google Maps" link, copyright line and "Back to top".
- **Unit:** "Per Tractor / प्रति ट्रैक्टर" is now shown as "Per Trolley / प्रति ट्रॉली" (stored key unchanged, so existing products switch automatically).
- The new sections load after the prices as a separate small file; the search bar is pinned only over the product list.
- Tests: backend 165 (new: shop photo, gallery, reviews), frontend 143 (new: sections, viewer, review form, admin gallery/reviews, shop photo, card saving, footer, map link). Browser check in Edge: 41/41, axe-core 0 violations.

**Suggested commit message**

```
feat: add shop photo, photo gallery and moderated customer reviews

- add a big shop photo in Shop Settings, shown below the product list
- add an admin photo gallery (multi-upload, captions, max 40) with a full-screen viewer
- add customer reviews with owner approval, rate limit, honeypot and pending cap
- redesign product cards (price panel, MRP saving) and the customer footer
- show the tractor unit as Per Trolley / प्रति ट्रॉली
- load the new sections after the prices; add tests
```

**Short description:** Customers now see the shop, its photos and approved reviews below the price list, and can leave a review that the owner checks before it appears.

---

## Update – Shorter customer page: gallery row, review box, folded descriptions

**Work completed**

- Gallery photos are now one row that scrolls sideways (swipe on phones, arrow buttons on computers, a "swipe to see all" hint), so the gallery is one photo tall however many photos there are.
- Reviews sit in a box of fixed height that scrolls up and down; "Show more reviews" is at the end of the box. The box can be scrolled with the keyboard.
- Product descriptions are folded behind "विवरण देखें / View description" in a strip at the bottom of each card (a real button, outside the card's link).
- Tests: frontend 148 (new: description toggle, gallery row and arrows, review box). Browser check in Edge: 48/48, axe-core 0 violations.

**Suggested commit message**

```
feat: keep the customer page short with a gallery row and review box

- show gallery photos in one sideways-scrolling row with arrow buttons
- put customer reviews in a fixed-height scrolling box
- fold product descriptions behind a "View description" button
- add tests
```

**Short description:** The photos, reviews and descriptions no longer stretch the customer page; customers swipe, scroll or tap to see more.

---

## Update – Header and footer redesign

**Work completed**

- Colour palette added as design tokens: forest green #173B32 (branding), construction orange #E69A2D (accent icons), WhatsApp green #25D366; soft white, dark slate, muted grey and light grey use Tailwind slate-50/800/500/200.
- Header: white background, forest-green shop icon and name, the full address below it (no longer cut off on phones), a cleaner Admin button and language switch, forest-green Call button. The header scrolls away with the page (never sticky or fixed); the search box and category buttons are no longer pinned either, so nothing stays fixed at the top.
- Footer: light background with three balanced sections (shop name in both languages with a short description; Call and WhatsApp buttons; address with Google Maps link) and a slim forest-green bottom bar with © and Back to top.
- Shop description set to the owner's short text in Shop Settings (English and Hindi).
- Tests: frontend 150 (new: nothing pinned to the top, footer names and sections). Browser check in Edge: 48/48, axe-core 0 violations.

**Suggested commit message**

```
style: redesign customer header and footer with the new colour palette

- add forest green, construction orange and WhatsApp colour tokens
- make the header light with forest-green branding and the full address
- let the header and search bar scroll with the page (nothing pinned)
- redesign the footer into three balanced light sections
- add tests
```

**Short description:** A cleaner, lighter header and footer in the shop's colours; the whole page now scrolls naturally.

---

## Update – Header colour refinements

**Work completed**

- Header colours refined (layout, spacing and behaviour unchanged): top row #F7F8F3, Admin button #EAF1ED, shop name and Call button #174C3A (hover #113A2C), address #64756C, borders #E5EBE5. Header still scrolls with the page (not sticky or fixed).
- Tests: frontend 150 passed; checked in Edge at 360 and 1280 px.

**Suggested commit message**

```
style: refine customer header colours
```

---

## Update – Balanced Customer Reviews layout

**Work completed**

- On computers and tablets the reviews list and the "Write a review" form are side by side, 50/50 and the same height: the form sets the height and the reviews box fills it and scrolls inside, however many reviews there are. Phones keep them one above the other.
- Tests: frontend 150 passed; browser check in Edge 49/49 (new 50/50 check), axe-core 0 violations.

**Suggested commit message**

```
style: balance the customer reviews list and form 50/50
```

---

## Update – Remove the description from product cards

**Work completed**

- Removed the "विवरण देखें / View description" strip from product cards: the product page (opened by tapping the card, "पूरी जानकारी") already shows the full description. The whole card is again one tap target.
- Tests: frontend 149 passed; browser check in Edge 48/48, axe-core 0 violations.

**Suggested commit message**

```
refactor: remove duplicate description toggle from product cards
```

---

## Deployment – live addresses recorded

**Work completed**

- Code pushed to https://github.com/ankitgpt9798/NIRMAAN (branch `main`) on 12 November 2026; deployed by the owner: website https://ankitbuildingmaterials.vercel.app (Vercel), API https://nirmaan-api-a2vy.onrender.com (Render).
- Live check (read-only) in Edge: 14/14 – Hindi by default, 6 products, all photos from Cloudinary, gallery, reviews, footer, product page, English switch, admin login page; API healthy, database connected, CORS limited to the website; axe-core 0 violations.
- README updated with the live addresses and repository.

**Commit message used**

```
docs: record live deployment addresses in README
```
