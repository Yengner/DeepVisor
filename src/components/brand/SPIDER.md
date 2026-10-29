# DeepVisor spider mascot

The approved reference is `Pixel Spider Robot Mascot Sheet.png` at the repository root.
The new artwork recreates its compact navy body, two cyan square eyes and blue/light-blue
legs on a consistent 64×48 grid. It has no mouth, glow, gradient, drop shadow, white matte,
or presentation labels. The company logo is unchanged.

```tsx
import SpiderMascot from '@/components/brand/SpiderMascot';

<SpiderMascot state="idle" size={48} />
<SpiderMascot state="working" size={64} label="Preparing your report" />
<SpiderMascot state="sleep" size={48} tone="dark" framed />
```

- `state`: idle, blink, walking, working, thinking, scanning, success, sleep, attention.
- `size`: square layout box in CSS pixels (default 48); artwork keeps a 4:3 frame inside
  it. Prefer 32/48/64/96. Rendering uses nearest pixels and fixed frame registration.
- `tone`: light/dark backplate colors; `framed` opts into a quiet backplate. The spider's
  palette is identical on both backgrounds. `className` styles the wrapper.
- `label`: accessible image name. Omit when adjacent text already explains the state;
  the default is decorative and hidden from assistive technology. No automatic live
  announcements. Caller-owned task text can use `role="status"` when appropriate.
- `paused`: freeze animation when a placement is inactive. `sleep` is a deliberate
  inactive expression, never inferred from advertising status or time online.

State must come from the real task or an explicitly labeled illustration. The component
never starts AI work, syncs accounts, changes advertising, or infers success. Success
finishes a 650ms nod and keeps its completed expression until the caller changes state.
Blink is a single 240ms blink. Idle gently lifts the body one grid pixel and blinks every
8 seconds. Walking is an eight-frame 960ms anchored loop; move the wrapper separately
if a future interaction needs travel. Working adds the reference laptop with subtle
hand/keyboard movement. Sleep and attention are still. No random timers or endless
success celebrations.

## Assets and regeneration

```sh
node scripts/design/export-mascots.mjs
```

Source: `scripts/design/spider-art.mjs` (integer geometry, fixed opaque palette).
Output: `public/images/brand/mascot/deepvisor-spider-sprite.png` (512×432, eight frames
per row, nine rows, ~3 KB), plus `deepvisor-spider-idle.svg` for static use. One shared
sheet is fetched regardless of component count/state; no state-dependent downloads.
Rows must match `spiderStates` in the component; a regression test verifies the order
and every encoded pixel. Asset editing needs no external image service or new dependency.
The original sheet stays as a reference and is never loaded by the application.

CSS uses discrete background-position frames, isolated paint, and fixed dimensions.
There are no React effects, JS timers, subscriptions, or unmount cleanup obligations.
Changing state remounts only the visual span so finite feedback restarts reliably.
`prefers-reduced-motion: reduce` disables all animations and selects each state's useful
first frame. Avoid CSS transitions that interpolate pixels or enlarge low-res artwork
with smoothing. At small sizes, use adjacent text for meaning rather than relying on
fine details such as the laptop or scan brackets.

`PixelCompanion` remains a compatibility wrapper for existing auth, marketing,
Dashboard, and Decisions placements. It maps analyzing→scanning, planning→thinking,
and completed→success. The earlier Weaver/Scout/Orbit exports are superseded design
explorations, not runtime assets. New interfaces should import `SpiderMascot` directly.

## Validation

Node 24: five focused tests cover accessibility, invalid sizes, state mapping, all sprite
pixels/alpha/row order, and walking eye registration. Browser review covers all nine
states on light/dark backgrounds at 1440px and 390px, eight distinct walking frames,
finite feedback, pause, reduced motion, and actual landing-page state changes/login
placement. Typecheck and targeted lint pass. No database or advertising logic changed.
