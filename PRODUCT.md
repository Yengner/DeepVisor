# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Long-term: businesses of every size (local shops to larger companies) and the agencies that serve them. Initial market:

Owners and operators of local businesses (salons, trades, clinics, studios, restaurants, and other local services) who run Meta (Facebook/Instagram) ads, usually without an in-house marketer. They visit between other work and want to know, quickly and honestly, what is running, how it is performing, and whether anything needs their attention.

## Product Purpose

DeepVisor reads a connected Meta ad account and turns it into a clear picture: what is running now, how it performed over a chosen period, what DeepVisor observed, and whether action is needed. Success is an owner who understands their advertising without living inside Ads Manager.

## Positioning

Long-term (founder vision, 2026-11-15): an all-in-one advertising platform that makes digital advertising simpler, smarter, and accessible to businesses of every size, across Meta, Google/YouTube, TikTok, LinkedIn, Reddit, Snapchat, X and others. Two ways to work: self-service, or an AI assistant that turns plain-language goals into plans and acts only within budgets and permissions the business approves. "DeepVisor handles the complexity. Businesses stay in control." The spider is the emblem of this: one center, a thread to every ad platform.

Today: evidence before action. Every observation shows the numbers behind it, and "Hold" or "not enough data yet" are legitimate answers rather than failures. DeepVisor recommends; it does not change advertising on its own.

## Operating Context

- Surfaces: Overview (`/dashboard`), Decisions (`/decisions`), Campaigns (`/campaigns`), Connections, Settings.
- Entity levels: account → campaign → ad set → ad/creative.
- Meta is the only connected platform today; other platforms are roadmap only.
- Meta connection requests read-oriented scopes: `ads_read`, `business_management`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`.
- Sign-in via email/password or Google OAuth (Supabase Auth).

## Capabilities and Constraints

- Commercial state (confirmed 2026-11-15): **free beta, no billing**. Stripe code exists but is not offered to customers.
- Customer access is **read-only**: DeepVisor reads, syncs and recommends. Approval-gated and opt-in automated execution exist in code but are off and not offered; describe them only as possible future, opt-in capabilities.
- Operator: **DeepVisor LLC**. Governing-law state not yet confirmed.
- Service providers evidenced in code: Supabase (database, auth, storage), Meta Graph API, OpenAI (summaries/assistant), TypeSafe "Jev" decision model, Google Maps/Places (business lookup during onboarding). No analytics or ad-tracking scripts on the site.
- Contact: info@deepvisor.com.

## Brand Commitments

- Name: DeepVisor. Lockup and app icons in `public/images/brand/`.
- Spider mascot (`src/components/brand/SpiderMascot.tsx`, see `SPIDER.md`): "good ad decisions are a web; ours sits in the middle and watches every thread." Long-term meaning: one center with a thread (leg) to every ad platform.
- Voice: plain, honest, calm; no hype, no invented outcomes.

## Public Messaging Rules

- Lead with the mission; separate Today (Meta, read-only, free beta) from Coming. Never present planned capabilities as available.
- Minimal copy, no meta-labels or clutter (no "illustrative", "synced …", visible pause controls).

## Evidence on Hand

- No customer testimonials, logos, case studies, usage numbers, or benchmarks exist. Never fabricate them (files under `public/images/testimonial-*` are legacy placeholders, not real customers).
- Product screens exist in the app. Marketing examples must be obviously generic (no realistic fake customer accounts), so they need no disclaimer labels.

## Product Principles

1. Missing or failed data is never zero, healthy, or HOLD.
2. Current delivery ("Active now") is distinct from selected-period history.
3. The owner decides; nothing changes in an ad account without explicit permission.
4. Show the evidence; avoid invented scores, savings, or certainty.

## Accessibility & Inclusion

Public pages must be fully keyboard operable (visible focus, skip link, logical tab order, no keyboard traps), screen-reader labeled, readable contrast (WCAG 2.2 AA), and honor reduced motion.
