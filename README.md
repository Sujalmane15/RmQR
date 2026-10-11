# RMQR — Modular QR Code, Digital Menu, Landing Page & Google Review SaaS Platform

**RMQR** is a full-stack, multi-tenant QR SaaS platform built with **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, and **Supabase PostgreSQL** (with an automatic zero-config transactional local persistence engine for immediate local execution and E2E testing).

Inspired by modern hospitality and business QR platforms such as OrbitQR, RMQR combines dynamic QR management, a customizable QR studio, real-time digital restaurant menus, mobile landing pages, and ethical Google review growth workflows in a unified workspace.

---

## Core Modules & Capabilities

1. **QR Code Studio (`/dashboard/qr-codes/new`)**
   - **14 Content Types:** Website URL, Plain Text, Email, Phone Call, SMS, WhatsApp, Wi-Fi Network, vCard Contact, Map Location, Google Review Link, Digital Restaurant Menu, Social Profile, File/Document Link, and Custom Landing Page.
   - **Static vs. Dynamic QR Modes:**
     - **Static QR:** Encodes payload directly into the QR matrix. Works offline forever; destination cannot be changed after printing.
     - **Dynamic QR:** Encodes a short RMQR redirect URL (`/r/[slug]`). Destination can be edited anytime without reprinting physical standees, packaging, or table tents.
   - **Visual Customization & Scan Reliability Guardrails:** Custom foreground/background colors, module patterns (`square`, `dots`, `rounded`, `diamond`), finder eye shapes (`square`, `rounded`, `circle`), center logo overlay, frames (`none`, `simple`, `banner_bottom`, `badge_top`), and real-time WCAG contrast, quiet-zone, color-inversion, and logo-coverage warnings.
   - **Print-Quality Exports:** Real, scannable **PNG**, **SVG**, and **Print-Ready PDF** exports verified by automated `jsQR` matrix decoding tests.

2. **Secure Dynamic Redirect Engine (`/r/[slug]`)**
   - Resolves dynamic slugs on the server, verifies QR status (`active`, `paused`, `expired`, `archived`), checks expiration timestamps (with optional fallback URL redirect), enforces optional password protection and smart iOS/Android/Desktop device routing, validates destination URLs against dangerous schemes (`javascript:`, `data:`, `vbscript:`, `file:`, protocol-relative `//`), records privacy-conscious telemetry, and issues a `307 Temporary Redirect`.
   - Renders clean, informative status pages when a QR code is paused, expired, archived, or missing.

3. **Privacy-Conscious Scan Analytics (`/dashboard/analytics`)**
   - Strictly backed by real persisted scan events—zero fabricated or hardcoded numbers.
   - Separates estimated **Human Scans** from **Bot / Crawler / Preview-Fetcher Hits** (`Googlebot`, `WhatsApp`, `Slackbot`, `facebookexternalhit`, `curl`, etc.).
   - Anonymizes visitor identity using a daily rotating salted hash (`SHA-256(dayBucket + anonymizedSubnet + truncatedUA)`) so raw IP addresses are never stored.
   - Includes date-range filters (`7d`, `30d`, `90d`, `all`), per-QR filtering, campaign filtering, daily scan timeline, device/OS/browser/country breakdowns, recent scan log, and **CSV Export**.

4. **Branded Mobile Landing Pages (`/dashboard/landing-pages` & `/p/[slug]`)**
   - Build mobile-first micro-pages (`business_profile`, `link_in_bio`, `product_promo`, `event`, `contact_card`) with custom theme colors, action buttons, WhatsApp & phone actions, social links, draft/published states, and live click/view tracking.

5. **Digital Restaurant Menus & AI/OCR Menu Import (`/dashboard/menus` & `/m/[slug]`)**
   - Category and item management with real-time price and stock updates (`In Stock` / `Sold Out`), Vegetarian / Non-Vegetarian indicators, dietary tags, **Today's Specials**, **Best-Seller** badges, and **High-Margin** internal profit tags.
   - **AI / OCR Menu Import Assistant:** Extracts candidate categories, dish names, descriptions, Veg/Non-Veg classification, and prices from raw menu text or uploaded menu files into a **Mandatory Human Review Queue** so owners can inspect, edit, or discard every item before importing to a live menu.
   - **Instant Public Sync:** Updating an item price or availability in `/dashboard/menus` immediately reflects on `/m/[slug]` without reprinting table QR codes.

6. **Google Review Growth Suite (`/dashboard/reviews` & `/review/[slug]`)**
   - Connects a legitimate Google Business Profile review URL and generates print-ready counter standee QR codes, WhatsApp/SMS/Email outreach templates, and optional customer review starter prompts.
   - **Ethical & Policy-Compliant:** Never blocks low ratings or fabricates reviews.
   - **AI Owner Reply Assistant:** Drafts warm, professional, or apologetic owner replies to customer reviews with mandatory human editing before posting.

7. **Campaigns, Folders & Bulk QR Generator (`/dashboard/campaigns`)**
   - Organize QR codes by campaign (`table_tents`, `packaging`, `events`, `print_ads`, `review_standees`) and folder.
   - **Bulk CSV / URL Import & ZIP Export:** Validate up to 100 rows at once (checking URL safety and duplicate slugs), batch-create QR codes, and download a single `.zip` archive containing individual high-resolution `.png` and `.svg` QR files plus a `manifest.csv`.

8. **AI Agent QR (`/dashboard/ai-agents` & `/agent/[slug]`)**
   - **All-in-One Business AI Assistant:** Create dedicated, scannable QR codes that open a mobile-first public AI chat page (`/agent/[slug]`) for 8 configurable business categories (`restaurant_cafe`, `retail_shop`, `salon_spa`, `real_estate`, `hotel_hospitality`, `professional_services`, `education_training`, `general_business`).
   - **5-Step Agent Creation Wizard:** Configure Basic Business Info, Structured Business Knowledge Base (About, Products/Services, Pricing, Opening Hours, FAQs, Policies, Contact Info, Special Offers, Custom Notes + optional linking to existing workspace Restaurant Menus & Landing Pages), Personality & Guardrails (tone, response length, prompt-injection defense, unknown-answer fallback), Branding (brand color, welcome message, starter questions, optional consented lead capture), and Automatic Dynamic QR Launch (`/r/[qrSlug]` -> `/agent/[slug]`).
   - **Strict Per-Business Grounding & Tenant Isolation:** Every public chat request is strictly scoped to that specific agent's knowledge base (`src/lib/ai/agent-engine.ts`) and never leaks data across businesses or workspaces.
   - **Server-Side AI Provider + Transparent Grounded Mode:** Supports Google Gemini (`AI_PROVIDER=gemini`) and OpenAI (`AI_PROVIDER=openai`) via server-side `AI_API_KEY`. When no API key is configured, the assistant operates transparently in **Grounded Knowledge Retrieval Mode** without faking a live LLM API call.

9. **Multi-Tenant Workspaces, RBAC, Billing & Admin Console**
   - Role-based access control (`owner`, `admin`, `editor`, `viewer`) and strict tenant isolation enforced on every server API route and in Supabase PostgreSQL Row Level Security (`supabase/migrations/0001_initial_schema.sql` and `supabase/migrations/0002_ai_agent_qr.sql`).
   - Subscription plans (`free`, `starter`, `pro`, `business`) with live usage meters (including `aiAgents` and `monthlyAiMessages`), honest sandbox checkout mode when Stripe/Razorpay keys are not configured, API keys, webhooks, audit logs (`/dashboard/settings`), and a protected Super-Admin Console (`/admin`).

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment (Optional for Local Run)

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

> **Local Persistence (`data/rmqr-db.json`) vs. Production Supabase PostgreSQL:**
> - By default in local development and E2E testing (when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not configured), RMQR's API routes persist data to a local atomic JSON store at `data/rmqr-db.json` (`src/lib/db/store.ts`) seeded with `scanCount: 0`. Existing user data in `data/rmqr-db.json` is automatically upgraded in-place with backward-compatible collections.
> - **Limitations of `data/rmqr-db.json`:** A local JSON file on disk is designed for single-node local evaluation and automated E2E testing; it is **not** suitable for multi-instance or serverless production deployments (such as Vercel serverless functions where disk state is ephemeral and concurrent writes across instances would race).
> - **Production Deployment Requirement:** For multi-user production persistence, provision a Supabase project, run `supabase/migrations/0001_initial_schema.sql`, `supabase/migrations/0002_ai_agent_qr.sql`, and `supabase/seed.sql`, and wire the data access layer to Supabase PostgreSQL + Supabase Auth using `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Run Development Server

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Integration Status & Environment Configuration

| Integration | Env Vars | Behavior Without External Credentials |
| :--- | :--- | :--- |
| **Database & Auth** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Uses local file store (`data/rmqr-db.json`) + HMAC-SHA256 HTTP-only cookie sessions (`src/lib/auth/session.ts`). Complete SQL schema & RLS policies are provided in `supabase/migrations/0001_initial_schema.sql` and `supabase/migrations/0002_ai_agent_qr.sql`. |
| **AI Agent QR Chat Engine** | `AI_PROVIDER` (`gemini` \| `openai`), `AI_MODEL`, `AI_API_KEY` (or `GEMINI_API_KEY` / `OPENAI_API_KEY`) | Operates transparently in **Grounded Knowledge Retrieval Mode** (`src/lib/ai/agent-engine.ts`), answering strictly from the agent's saved business knowledge, FAQs, opening hours, policies, and linked menus/pages, or returning the configured unknown-answer fallback. |
| **AI / OCR Menu & Review Assistant** | `GEMINI_API_KEY`, `OPENAI_API_KEY` | Uses deterministic structured line/price parser and template-based reply generator (`src/lib/ai/services.ts`) with mandatory human review before publishing. |
| **Stripe / Razorpay Billing** | `STRIPE_SECRET_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | Explicitly labels plan changes as **Sandbox Mode** (`paymentProvider: 'manual'`) and never fabricates live payment gateway receipts. |
| **Google Business Profile OAuth** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Supports direct Google Review URL connection (`https://search.google.com/local/writereview?placeid=...`) and manual review reply drafting; live GBP OAuth review sync requires Google OAuth credentials. |

---

## Pre-Seeded Demo Accounts

| Role | Email | Password | Workspace |
| :--- | :--- | :--- | :--- |
| **Workspace Owner** | `owner@rmqr.app` | `OwnerPass123!` | Saffron & Slate Hospitality (`Pro` Plan) |
| **Super Admin** | `admin@rmqr.app` | `AdminPass123!` | Platform Admin Console (`/admin`) |

### Pre-Seeded Public Customer Routes
- **Dynamic QR Redirect (Menu):** `http://localhost:3000/r/saffron-menu`
- **Dynamic QR Redirect (AI Agent QR):** `http://localhost:3000/r/saffron-ai`
- **Public AI Agent Chat Page:** `http://localhost:3000/agent/saffron-concierge`
- **Public Digital Restaurant Menu:** `http://localhost:3000/m/saffron-bistro`
- **Public Branded Landing Page:** `http://localhost:3000/p/saffron-hub`
- **Public Google Review Flow:** `http://localhost:3000/review/saffron-reviews`


---

## Verification & Automated Testing

RMQR includes both **Vitest** unit/integration tests (including real PNG QR generation and `jsQR` matrix decoding) and **Playwright** end-to-end browser & API acceptance tests:

```bash
# 1. TypeScript static verification
npm run typecheck

# 2. Unit & integration tests (QR PNG decoding, security validators, RBAC, bulk CSV, AI parser)
npm test

# 3. Production Next.js build
npm run build

# 4. End-to-End Playwright acceptance suite (all 15 acceptance criteria + browser exports + admin auth)
npm run test:e2e
```

