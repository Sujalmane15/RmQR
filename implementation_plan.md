# RMQR — Master Implementation Plan

## 1. Executive Summary & Product Vision
**RMQR** is a production-ready, modular QR SaaS platform inspired by OrbitQR. It unifies:
1. **QR Code Studio (Static & Dynamic QR Codes)** with 14 content types, rich visual customization (colors, module patterns, corner eye styles, frames, logos), contrast & quiet-zone validation, and crisp PNG/SVG/PDF exports.
2. **Dynamic Redirect Engine (`/r/[slug]`)** with zero-downtime destination updates, expiration & fallback rules, password protection, device-aware routing, dangerous URL scheme blocking, and privacy-conscious scan telemetry.
3. **Real-Time Analytics & Reporting** based strictly on persisted scan events, separating human scans from bot/crawler hits, with device/OS/browser breakdowns, time-series charts, ranking, and CSV export.
4. **Branded Mobile Landing Pages (`/p/[slug]`)** supporting 8 templates (Link-in-bio, Business profile, Product/Service, Contact card, Event, Restaurant Menu, Promotion, Google Review invite) with block customization and click tracking.
5. **Google Review Growth Suite (`/review/[slug]`)** allowing businesses to connect legitimate Google Review links, generate review QRs, provide optional frictionless review-draft assistance, copy outreach templates, and generate AI-assisted owner reply drafts with human review safeguards.
6. **Digital Restaurant Menu Platform (`/m/[slug]`)** with category & item management, Veg/Non-Veg & dietary labels, Best-Seller & High-Margin badges, Today's Specials, instant live publishing, and an **AI/OCR Menu Import** pipeline with mandatory human review before publishing.
7. **Campaigns, Folders & Bulk QR Operations** with UTM builders, CSV upload & validation, duplicate detection, and batch ZIP export.
8. **Multi-Tenant Organizations, RBAC, Billing & Admin Console** with Owner/Admin/Editor/Viewer roles, strict server-side tenant isolation, PostgreSQL Row Level Security (RLS), configurable Free/Pro/Business plans, API keys, webhooks, audit logs, and an `/admin` portal.

---

## 2. Technology Stack & Architecture

- **Framework:** Next.js 15+ (App Router) with React 19 and TypeScript.
- **Styling & Design System:** Tailwind CSS with custom RMQR design tokens (Dark Navy `#0B0F19`, Electric Violet `#7C3AED`, Cyan `#06B6D4`, Emerald `#10B981`), accessible UI primitives, dark/light mode support, and Lucide icons.
- **Database & Persistence:**
  - **Primary Production Schema:** Supabase PostgreSQL (`supabase/migrations/0001_initial_schema.sql` & `supabase/seed.sql`) with complete Foreign Keys, Indexes, Triggers, and Row Level Security (RLS) policies.
  - **Unified Repository & Local Persistent Engine:** Server-side repository layer (`src/lib/db/`) that connects to Supabase when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured, and seamlessly falls back to a transactional server-side persistent JSON/file database (`data/rmqr-db.json`) in local/CI environments without cloud credentials. This guarantees 100% real persistence, real authentication, and real tenant isolation out of the box.
- **Authentication & Authorization:**
  - Supabase Auth integration + server-side HTTP-only signed session management (`src/lib/auth/`).
  - Password hashing with salted SHA-256 / PBKDF2.
  - Server-side RBAC enforcement (`owner`, `admin`, `editor`, `viewer`, plus system `super_admin`).
- **QR Code Generation & Decoding:**
  - `qrcode` matrix engine + custom SVG & HTML5 Canvas renderer supporting custom module shapes (`square`, `dots`, `rounded`, `classy`), custom corner eye shapes (`square`, `rounded`, `circle`), custom frames with CTA text, center logo overlay, WCAG contrast ratio calculation, and PNG / SVG / PDF (`jspdf`) export.
  - `jsqr` for automated QR scannability & decoding verification in tests.
- **Bulk Operations:** `jszip` for batch QR archive downloads and RFC-4180 CSV parser/validator.
- **Validation:** `zod` schemas on both client forms and server API routes.
- **Testing:** `vitest` for unit & integration tests + `@playwright/test` for browser end-to-end acceptance criteria verification.

---

## 3. Normalized Database Schema

All tenant-owned tables reference `organization_id` (UUID) with cascading constraints and Row Level Security policies restricting access to members of that organization according to their role:

1. `profiles` — `id`, `email`, `full_name`, `avatar_url`, `is_super_admin`, `onboarding_completed`, `onboarding_step`, `created_at`, `updated_at`
2. `organizations` — `id`, `name`, `slug`, `industry`, `logo_url`, `brand_primary_color`, `brand_secondary_color`, `custom_domain`, `status` (`active`, `suspended`), `created_by`, `created_at`, `updated_at`
3. `organization_members` — `id`, `organization_id`, `user_id`, `invited_email`, `role` (`owner`, `admin`, `editor`, `viewer`), `status` (`active`, `invited`), `created_at`
4. `subscriptions` — `id`, `organization_id`, `plan_id` (`free`, `pro`, `business`), `status` (`active`, `past_due`, `canceled`), `billing_cycle` (`monthly`, `annual`), `current_period_start`, `current_period_end`, `payment_provider`, `external_subscription_id`, `created_at`, `updated_at`
5. `qr_folders` — `id`, `organization_id`, `name`, `color`, `created_at`
6. `campaigns` — `id`, `organization_id`, `name`, `description`, `start_date`, `end_date`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `status`, `created_at`, `updated_at`
7. `qr_codes` — `id`, `organization_id`, `folder_id`, `campaign_id`, `name`, `description`, `slug`, `qr_type` (`static`, `dynamic`), `content_type` (14 supported types), `status` (`active`, `paused`, `expired`, `archived`), ` encoded_content`, `destination_url`, `fallback_url`, `expires_at`, `password_hash`, `routing_rules` (JSONB for device/time routing), `style_config` (JSONB: colors, pattern, eye style, frame, CTA, logo), `tags` (TEXT[]), `scan_count`, `last_scanned_at`, `created_by`, `created_at`, `updated_at`
8. `qr_destinations` — `id`, `qr_code_id`, `organization_id`, `destination_url`, `is_active`, `weight`, `device_rule`, `created_by`, `created_at` (tracks history and multi-URL routing rules)
9. `qr_scan_events` — `id`, `qr_code_id`, `organization_id`, `campaign_id`, `scanned_at`, `visitor_hash` (privacy-preserving daily salted hash, never raw IP), `is_bot`, `device_type` (`mobile`, `tablet`, `desktop`, `other`), `os`, `browser`, `country`, `region`, `referrer`, `destination_resolved`
10. `landing_pages` — `id`, `organization_id`, `qr_code_id`, `slug`, `title`, `description`, `page_type` (8 types), `status` (`draft`, `published`), `theme_config` (JSONB: colors, logo, cover image, font), `social_links` (JSONB), `contact_info` (JSONB), `view_count`, `click_count`, `created_at`, `updated_at`
11. `landing_page_blocks` — `id`, `landing_page_id`, `organization_id`, `block_type` (`button`, `text`, `image`, `hours`, `map`, `whatsapp`, `social`), `title`, `subtitle`, `url`, `icon`, `sort_order`, `click_count`, `is_enabled`
12. `business_profiles` — `id`, `organization_id`, `business_name`, `category`, `description`, `address`, `phone`, `whatsapp`, `email`, `website`, `google_review_url`, `google_place_id`, `logo_url`, `cover_url`, `opening_hours` (JSONB), `created_at`, `updated_at`
13. `review_campaigns` — `id`, `organization_id`, `business_profile_id`, `qr_code_id`, `slug`, `name`, `google_review_url`, `headline`, `subheadline`, `cta_text`, `brand_color`, `logo_url`, `suggested_topics` (TEXT[]), `ai_drafts_enabled`, `scan_count`, `google_click_count`, `status` (`active`, `paused`), `created_at`, `updated_at`
14. `menus` — `id`, `organization_id`, `qr_code_id`, `slug`, `restaurant_name`, `description`, `currency`, `logo_url`, `cover_url`, `theme_config` (JSONB), `status` (`draft`, `published`), `published_at`, `updated_at`, `created_at`
15. `menu_categories` — `id`, `menu_id`, `organization_id`, `name`, `description`, `sort_order`, `is_available`, `created_at`
16. `menu_items` — `id`, `menu_id`, `category_id`, `organization_id`, `name`, `description`, `price`, `image_url`, `is_veg`, `dietary_tags` (TEXT[]), `is_bestseller`, `is_recommended`, `is_high_margin`, `show_high_margin_badge`, `is_todays_special`, `is_available`, `sort_order`, `created_at`, `updated_at`
17. `menu_featured_items` — `id`, `menu_id`, `menu_item_id`, `organization_id`, `badge_label`, `sort_order`
18. `uploaded_assets` — `id`, `organization_id`, `file_name`, `mime_type`, `size_bytes`, `storage_path`, `public_url`, `asset_type` (`logo`, `menu_image`, `cover`, `ocr_upload`), `created_by`, `created_at`
19. `api_keys` — `id`, `organization_id`, `name`, `key_prefix`, `key_hash`, `scopes` (TEXT[]), `last_used_at`, `expires_at`, `revoked_at`, `created_by`, `created_at`
20. `webhook_endpoints` — `id`, `organization_id`, `url`, `secret`, `events` (TEXT[]), `is_active`, `created_at`
21. `webhook_deliveries` — `id`, `webhook_endpoint_id`, `organization_id`, `event_type`, `payload` (JSONB), `response_status`, `delivered_at`
22. `audit_logs` — `id`, `organization_id`, `actor_id`, `actor_email`, `action`, `entity_type`, `entity_id`, `metadata` (JSONB), `created_at`
23. `support_tickets` — `id`, `organization_id`, `name`, `email`, `subject`, `message`, `status` (`open`, `in_progress`, `resolved`), `created_at`

---

## 4. Implementation Milestones

- **Milestone 1:** Project setup, TypeScript & Tailwind config, RMQR design system, public marketing & legal pages (`/`, `/features`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`), dashboard layout shell, responsive navigation.
- **Milestone 2:** Database schema & SQL migrations (`supabase/migrations/0001_initial_schema.sql`), unified server-side persistent DB & Auth engine, registration, login, password reset, onboarding flow (`/onboarding`), multi-tenant workspace & role-based access control.
- **Milestone 3:** QR Studio (`/dashboard/qr-codes/new`), 14 content types, Static QR generation, custom styling (colors, patterns, corner eyes, frames, logo upload), contrast & quiet-zone validation, PNG/SVG/PDF downloads.
- **Milestone 4:** Dynamic QR codes, `/r/[slug]` secure redirect handler, destination editing without changing printed QR, status transitions (`active`, `paused`, `expired`, `archived`), password-protected & device-routed QRs, privacy-conscious scan event recording.
- **Milestone 5:** Analytics dashboard (`/dashboard/analytics`), search, filters, folders, campaigns (`/dashboard/campaigns`), and bulk CSV QR generation with ZIP export.
- **Milestone 6:** Branded Landing Page builder (`/dashboard/landing-pages`) and public mobile pages (`/p/[slug]`) with view & button click analytics.
- **Milestone 7:** Digital Restaurant Menu management (`/dashboard/menus`), real-time public QR menu (`/m/[slug]`), and AI/OCR Menu Import workflow with human review step.
- **Milestone 8:** Google Review Growth module (`/dashboard/reviews`) and public review flow (`/review/[slug]`), outreach templates, and AI review reply drafting.
- **Milestone 9:** Subscription & Billing UI (`/dashboard/billing`), server-side plan limit enforcement, Settings/API Keys/Webhooks (`/dashboard/settings`), and Admin Console (`/admin`).
- **Milestone 10:** Security hardening (rate limiting, URL sanitization, security headers), Vitest unit/integration test suite, Playwright E2E acceptance test suite, `.env.example`, and `README.md`.
