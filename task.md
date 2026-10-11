# RMQR — Implementation Task Tracker

## Milestone 1: Project Setup, Design System & Public Pages
- [x] Initialize Next.js TypeScript project with Tailwind CSS and core packages (`qrcode`, `jspdf`, `jszip`, `zod`, `lucide-react`, `vitest`, `@playwright/test`)
- [x] Configure RMQR Design System (Dark Navy, Electric Violet, Cyan/Emerald accents, light/dark mode support, custom geometric QR logo)
- [x] Build public navigation bar and footer
- [x] Implement `/` (Home page with interactive QR preview, Google Review showcase, AI Menu showcase, Landing Pages, Pricing preview)
- [x] Implement `/features` page
- [x] Implement `/pricing` page
- [x] Implement `/about` page
- [x] Implement `/contact` page with working server-persisted support form
- [x] Implement `/privacy` and `/terms` pages
- [x] Build responsive Dashboard shell (desktop sidebar, top bar, workspace switcher, mobile drawer, profile menu)

## Milestone 2: Authentication, Database Schema, Workspaces & Onboarding
- [x] Write complete PostgreSQL schema and RLS migrations in `supabase/migrations/0001_initial_schema.sql` and `supabase/seed.sql`
- [x] Build Supabase integration layer + local server-side persistent database engine (`src/lib/db/`)
- [x] Implement authentication API routes and session management (`register`, `login`, `logout`, `forgot-password`, `reset-password`, `verify-email`)
- [x] Build `/login`, `/register`, `/forgot-password`, and `/reset-password` pages
- [x] Build 6-step `/onboarding` wizard (Account -> Business Info -> Logo -> Theme -> First QR -> Test & Publish)
- [x] Implement Organization/Workspace switching, member invitations, and RBAC (`owner`, `admin`, `editor`, `viewer`) enforcement

## Milestone 3: QR Code Studio & Static/Dynamic Generation
- [x] Build custom SVG/Canvas QR Renderer (`src/lib/qr/renderer.ts`) supporting custom colors, module patterns, corner eyes, center logo, frames, and CTA text
- [x] Implement WCAG contrast and quiet-zone scan reliability validator
- [x] Implement PNG, SVG, and print-ready PDF export pipeline
- [x] Build `/dashboard/qr-codes/new` QR Studio wizard supporting all 14 content types

## Milestone 4: Dynamic Redirects, QR Management & Scan Tracking
- [x] Implement `/r/[slug]` dynamic redirect endpoint with safe URL validation, status/expiration checks, optional password gate, device routing, and 307 redirect
- [x] Build privacy-conscious scan event recorder (salted visitor hash, bot/crawler detection, device/OS/browser parsing)
- [x] Build `/dashboard/qr-codes` listing page with search, status/type/folder/campaign filters, duplicate, archive/restore, pause/activate, and delete actions
- [x] Build `/dashboard/qr-codes/[id]` detail & editor view allowing live destination updates without altering the printed QR image

## Milestone 5: Analytics Dashboard, Folders, Campaigns & Bulk QR Studio
- [x] Build `/dashboard/analytics` with real persisted metrics, date-range filters, human vs bot toggle, time-series charts, device/browser/OS breakdown, top QRs, and CSV export
- [x] Build `/dashboard/campaigns` with campaign CRUD, UTM parameter builder, and campaign-level scan metrics
- [x] Implement Bulk QR generation from CSV or pasted URLs with template download, row-level validation, duplicate detection, and ZIP export

## Milestone 6: Branded Landing Pages
- [x] Build `/dashboard/landing-pages` manager and interactive visual editor supporting 8 page types
- [x] Implement `/p/[slug]` mobile-first public landing page renderer with safe sanitized content and real-time view & button-click tracking

## Milestone 7: Digital Restaurant Menu & AI Menu Import
- [x] Build `/dashboard/menus` administration (restaurant profile, categories CRUD/reorder, items CRUD/reorder, veg/non-veg, dietary tags, bestseller, high-margin badge, Today's Specials)
- [x] Implement AI/OCR Menu Import workflow (upload image/PDF/menu text -> extract candidate categories, items, prices -> human review & edit table -> approve & import)
- [x] Build `/m/[slug]` fast mobile-first public QR menu with search, category navigation, veg/non-veg filter, and zero stale cache

## Milestone 8: Google Review Growth Module
- [x] Build `/dashboard/reviews` management console (connect Google review URL, customize review landing page, manage review campaigns, track scans & clicks, copy outreach templates)
- [x] Build AI Review Reply assistant for business owners with human review/edit before publishing
- [x] Build `/review/[slug]` public review request flow with star selector, optional AI-assisted review copy helper, and direct redirect to Google Reviews

## Milestone 9: Subscriptions, Billing, Settings & Admin Portal
- [x] Build `/dashboard/billing` with Free, Pro, and Business plans, server-enforced entitlement gauges, upgrade/downgrade flows, and billing history
- [x] Build `/dashboard/settings` (profile, organization, team members & roles, custom domain config, scoped REST API keys, webhooks, audit logs)
- [x] Build `/admin` protected system administrator portal (user/org management, account suspension/restoration, platform metrics, abuse monitoring, support tickets, global audit trail)

## Milestone 10: Security, Automated Testing & Documentation
- [x] Enforce security headers, rate limiting, CSRF protection, and strict URL sanitization
- [x] Write and run Vitest unit/integration tests (QR generation & `jsqr` decoding, URL safety, tenant isolation, analytics, CSV bulk parser)
- [x] Write and run Playwright E2E browser acceptance tests covering the 15 required acceptance criteria
- [x] Create `.env.example` and comprehensive `README.md`
- [x] Update `implementation_plan.md` and `task.md` with final verification results
