# DeepVisor design system — Stage A/B

Status: implemented proof of concept, awaiting visual approval. Stage C is not started.

## Direction

Premium modern SaaS with subtle pixel intelligence. Quiet reading surfaces, precise
numeric hierarchy, an occasional rich navy-to-blue gradient, and a small friendly
companion. The company logo remains unchanged. No pixel fonts or fabricated agent activity.

Logo colors were sampled from opaque pixels in
`public/images/brand/source/deepvisor-symbol-transparent.png`: electric blue
`#0065FC`, navy `#082D56`, ocean blue `#0369CC`. Neutrals and pale highlights are
supporting colors derived for contrast, not additional colors claimed from the logo.

## Foundation

`DesignSurface` scopes theme tokens to the landing page and Dashboard. It follows
system preference until changed with the theme button, persists the choice locally,
and works for the current session if storage is unavailable. Existing Mantine theme
and other routes are not migrated. Dashboard chrome color adjustments are scoped
to the mounted design surface, including the mobile navigation portal.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas / panel | `#F4F7FC` / `#FFFFFF` | `#09172A` / `#10233C` |
| Main / secondary text | `#102C46` / `#53677D` | `#EDF4FF` / `#AFC1D8` |
| Interactive text | `#0056DB` | `#91BBFF` |
| Dividers / control outlines | `#D9E3EF` / `#7C91AC` | `#2A4361` / `#6D88AA` |
| Primary filled action | `#0065FC` + white text | Same |

All `--ui-*` tokens live in `DesignSurface.module.css`:

- Typography: existing Manrope body and Sora display fonts; 12/14/16/20px scale.
  Use 14–16px body text, 12px supporting metadata, and tabular numerals for metrics.
  Small uppercase labels are accents, never the only presentation of financial data.
- Spacing: 4/8/12/16/24/32/48px; 16px mobile gutters; content max width ~1264px.
- Radius: 8px controls, 16px panels, 24px occasional hero surfaces.
- Elevation: subtle navy shadows, a stronger hover shadow; no permanent glow.
- Controls: minimum 44px target, visible 3px focus outline. Dividers are decorative;
  control boundaries use the stronger outline token. Preserve validation/help text.
- Charts: primary, grid, and label tokens; selected metric controls use a pale
  accent surface. Keep missing points, timezone, ratios, and source coverage intact.
- Tables: subdued header/divider tokens, tabular numeric alignment, local overflow
  on narrow screens. Actual table rollout is reserved for Stage C.
- Status: separate positive, negative, warning colors and tinted backgrounds;
  always accompany color with text or a meaningful icon.
- Motion: 160ms interactions; finite mascot animations; no motion when reduced
  motion is requested. A hover lift is reserved for the marketing primary CTA.

Reusable primitives: `Panel`, `ActionLink`, `AgentMessage`. The latter requires
truthful visible copy; it does not fetch data or simulate background work.

## Mascot — updated reference direction

The supplied **Pixel Spider Robot Mascot Sheet** supersedes the earlier Weaver/Scout/Orbit
exploration. The production mascot now uses a compact navy body, cyan square eyes and
blue pixel legs with no mouth. See [the component guide](../brand/SPIDER.md) for all states,
accessibility, motion rules, the typed API and reproducible sprite generation. Existing
`PixelCompanion` placements are mapped to this implementation; no task behavior changes.

## Stage B implementation and validation

- Landing: concise hero, interactive intelligence illustration, three workflow
  principles, companion introduction, clear signup CTA. Removes unsupported ROI
  targets and implied always-on activity from the prior marketing illustration.
- Dashboard: separate account header, four legible KPI surfaces, refined chart and
  attention panels, larger mobile creative cards, preserved aspect ratios, real
  data/period/account/sync controls. All server queries and advertising permissions
  are unchanged. A one-card mobile highlight fills available width; no duplication.
- Node 24: typecheck and targeted ESLint passed. Existing model/advertising-board/
  control-model tests: 37 passed. Full test suite/build intentionally not repeated.
- Authenticated existing synthetic account reviewed at 1440×900 and 390×844 in
  light/dark themes; no page overflow or browser runtime errors. Chart metric
  switching, illustration buttons, keyboard focus, stored theme, reduced motion checked.
- Base text contrast: light main 13.30:1, secondary 5.43:1; dark main 16.26:1,
  secondary 9.80:1 (against canvas). Primary button white/blue ~4.92:1.
- Screenshots and review sheet: `/tmp/deepvisor-design-review/`. Dashboard also has
  `dashboard-advertising-*` screenshots because the application scrolls internally.
  Review checks cover these surfaces, not a full WCAG or application audit.

## Stage C recommendation — only after approval

Approve the palette, density, and mascot first. Then migrate shell + auth/onboarding,
Campaigns/explorer, Decisions/Connections/Settings, and Reports in that order.
Reuse the tokens and primitives; remove route-specific legacy overrides as each
surface is migrated. Verify overlays, tables, charts, and errors in both themes.
Future agency workspace should map real orchestration events to these states;
no agent execution or orchestration was added in this design phase.
