# PixelLab spider — first review batch

Open `/mascot-preview` on the local development server. Production SpiderMascot
and company branding remain unchanged; the review route returns 404 in production.

## Assets

`public/images/brand/mascot/review-v2/` contains transparent 64×48 open, half-closed,
and closed PNGs; a 192×48 strip; pixel-exact static SVG; a light/dark review sheet;
and a manifest defining frame order, timings, hashes and PixelLab provenance.

The master was refined through PixelLab Pixen (seed 110926, one charged generation).
Exact PixelLab workbench edits then removed an unwanted mouth-like mark, locked
44 near-duplicate shades to eight brand colors, and changed only eye pixels for
both blink frames. Editable decisions are in `pixellab-edits.json`; the original
PixelLab result is `pixellab-source.png`. Final master and strip are saved in the
user's PixelLab gallery (IDs in manifest). No unrelated gallery assets were changed.

Repackage/verify locally: `node scripts/design/spider-v2/package.mjs` (Node 24).
It checks dimensions, binary transparency, palette size, unchanged silhouettes,
eye-only differences and exact strip contents before producing the review sheet.
It does not modify artwork or production assets and requires no API credits.

## Character rules and sequencing

Primary: compact rounded navy body, square cyan eyes, four legs per side, blue
leg highlights, constant lighting and baseline; no mouth, glow, shadows or text.
Blink: half 40ms, closed 80ms, half 60ms, then open. Idle holds vary 4.2/6.2/5.1s.
Preview animations pause when hidden/offscreen and respect reduced motion.

Second batch: seven exact PixelLab workbench frames supply working (two laptop
cursor positions), scanning/thinking (two indicator positions), success, attention,
and sleep. Static states do not run animations. Anatomy remains fixed; every
change is restricted to documented eye or accessory regions. No additional AI
generation credits were used. Decisions and provenance are in `state-edits.json`.
Run `node scripts/design/spider-v2/package-states.mjs` to verify and package them.
`states-manifest.json` defines the strip and timings. The development review page
shows every state on light/dark surfaces and at 32/48/64px, with reduced motion.

After this batch is reviewed: adapt existing SpiderMascot while retaining its API.
Walking comes last because foot-contact consistency needs separate validation.

Supporting concepts only (not generated): Scout with discovery lens, Studio with
creative tile, Keeper with safeguard shield. All are secondary spider specialists
sharing anatomy, palette and pixel scale. They do not represent implemented agents.
