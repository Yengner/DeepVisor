# DeepVisor spider mascot (v3)

The approved character reference is `Pixel Spider Robot Mascot Sheet.png` at the repository
root: compact navy dome body, two square cyan eyes, blue legs with light-blue joints, no mouth.
v3 redraws it on a **32×32 grid** so it can always be shown at a whole-number scale.
Keep it small and simple: two short legs per side (upper one darker) built from straight
2px segments, plain cyan eyes with no white glint. Long, spread-out spider legs were tried
and rejected as too creepy; the eye glint was rejected as too cute. The
company logo is unchanged.

```tsx
import SpiderMascot from '@/components/brand/SpiderMascot';

<SpiderMascot state="idle" size={32} />
<SpiderMascot state="working" size={64} label="Preparing your report" />
<SpiderMascot state="sleep" size={48} tone="dark" framed />
```

- `state`: idle, blink, walking, working, thinking, scanning, success, sleep, attention,
  wave, idea, dangle.
- `size`: square layout box in CSS pixels (default 48). The artwork is drawn at the
  largest whole multiple of 32 that fits (minimum 1×) and centred on whole pixels, so
  **use 32, 64, 96 or 128** to fill the box. Other sizes keep the art crisp and add space
  around it; sizes under 32 grow the box to 32.
- `tone`: the surface the mascot sits on. `dark` loads a sheet with a 1px outer rim so the
  ink outline stays visible on navy; for large hero placements a light tile reads better.
  `framed` adds a quiet backplate. `className` styles the wrapper.
- `label`: accessible image name. Omit when adjacent text already explains the state;
  the default is decorative and hidden from assistive technology. No live announcements.
- `paused`: freeze animation when a placement is inactive. `sleep` is a deliberate
  inactive expression, never inferred from advertising status or time online.

## Why v2 looked glitchy (fixed)

v2 drew a 64×48 sheet into 48/28/26/76px boxes using percentage background sizes. Those
are 0.75×/0.44×/0.41×/1.19× scales, so nearest-neighbour rendering dropped or doubled
pixel columns differently in each frame, and the four overlapping legs per side plus front
legs drawn across the face turned into noise. v3 renders only at integer scales with
pixel-valued offsets (verified in-browser: every art pixel is a uniform device-pixel block).
Its legs all sit behind the body, and the outline is generated, so it is always one
continuous pixel.

## States and timing

State must come from the real task or an explicitly labeled illustration. The component
never starts AI work, syncs accounts, changes advertising, or infers success.

| State | Motion |
| --- | --- |
| idle | 9.6s loop with uneven holds: breathes, blinks, glances left/right, taps a foot |
| blink | one 300ms blink |
| walking | alternating gait with 1px body bob, 800ms loop, in place (move the wrapper for travel) |
| working | eyes down, typing on a keyboard (two staggered key rows and a space bar); feet tap in turn and the pressed key lights up (1.2s loop) |
| thinking | looks up; three dots appear one by one (2.8s loop) |
| scanning | eyes sweep while a beam passes over the frame (1.6s loop) |
| success | crouch, jump, burst, land in 800ms, then **keeps** the happy pose |
| sleep | slow breathing and drifting z’s (4.8s loop) |
| attention | startles twice, then holds a steady “!” (no endless flashing) |
| wave | lifts the whole upper arm and holds it; the forearm tips back and forth by 1–2px so the arm stays solid (1.05s loop) |
| idea | lightbulb pops in, then glows softly |
| dangle | bobs up and down on a straight silk thread, legs kicking (2.4s loop); no sideways swing so the thread never kinks |

CSS only: discrete background-position steps, no React effects, JS timers or cleanup.
Changing state remounts the visual span so finite feedback restarts reliably.
`prefers-reduced-motion: reduce` disables all animation and shows each state's most
meaningful still (thinking → dots, success → happy, wave/idea → raised leg/bulb).

## Assets and regeneration

```sh
node scripts/design/export-mascots.mjs
```

Source: `scripts/design/spider-art.mjs`. It contains the body bitmap, leg solver, per-state
choreography and the locked 16-colour palette, plus one extra rim colour for the dark
sheet. Output: `public/images/brand/mascot/deepvisor-spider-sprite.png` and
`deepvisor-spider-sprite-dark.png` (each 256×384: 8 frames × 12 rows, about 3–4 KB) plus
`deepvisor-spider-idle.svg`. Rows must match `spiderStates`. Tests verify the row order,
every pixel of both sheets, integer scaling, and the walking body anchor.

PixelLab was used to explore proportions (pixflux img2img from the reference sheet), and
its workbench was used for QA. The latest sheet scored 87/100 and the idle frame linted
with 0 errors/warnings; the six "holes" are the gaps between legs, which are intended.
Raw AI output was not shipped because it had 54–57 noisy colours and was not symmetric.

`PixelCompanion` remains a compatibility wrapper for existing auth, marketing,
Dashboard, and Decisions placements (default 32px). It maps analyzing→scanning,
planning→thinking, completed→success. New interfaces should import `SpiderMascot`.
`/mascot-preview` (development only, behind the normal auth middleware) shows every state
on light and dark surfaces at 32/64/96/128px. `review-v2/` assets are a superseded
exploration and are no longer loaded.
