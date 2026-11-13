/** DeepVisor spider mascot — hand-authored 32×32 pixel art (v3).
 *
 * Proportions were explored with PixelLab (pixflux img2img over the approved reference
 * sheet); the production frames are authored here so the palette stays locked, the body is
 * identical in every frame, and the outline is generated rather than hand-drawn.
 *
 * Rules that prevent the "glitchy" look of earlier versions:
 * - One fixed 32×32 grid; the component only ever scales it by whole numbers.
 * - The body bitmap never changes; animation moves it in whole pixels.
 * - Legs are solved from a hip (moves with the body) to a foot (planted on the ground
 *   unless deliberately lifted), so the feet do not slide while the body breathes.
 * - A single 1px outline is computed after drawing, so it is always continuous.
 * Frame 0 of every row is a useful reduced-motion still.
 */
export const WIDTH = 32;
export const HEIGHT = 32;
export const FRAMES = 8;
export const STATES = ['idle', 'blink', 'walking', 'working', 'thinking', 'scanning', 'success', 'sleep', 'attention', 'wave', 'idea', 'dangle'];
export const PALETTE = {
  outline: '#07172f', body: '#0f2a5c', shade: '#0a1f45', rim: '#1d4c94', shine: '#3f82e6',
  eye: '#22c7f5', glint: '#c8f3ff', leg: '#1f6fe0', legLight: '#6fb6ff', legDark: '#164f9f',
  laptop: '#3a5a86', laptopLight: '#6d8fbd', screen: '#7fe3ff', bulb: '#ffd23f', bulbBase: '#9aa9bf', thread: '#9fb4d3',
};
/** Dark-surface sheet adds this outer rim around the ink outline: on navy panels the ink
 * outline alone disappears, and recolouring the outline blurs the legs together. */
export const DARK_RIM = '#3a6cb5';

// Body fill (16×12), outline added later. Eyes are drawn separately so expressions never
// touch the body bitmap. Light comes from the top-left (H = shine).
const BODY = [
  '.....RRRRRR.....',
  '...HHRRRRRRRR...',
  '..HRRBBBBBBRRR..',
  '.HRBBBBBBBBBBRR.',
  '.RBBBBBBBBBBBBR.',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'BBBBBBBBBBBBBBBB',
  'DBBBBBBBBBBBBBBD',
  '.DDBBBBBBBBBBDD.',
  '...DDDDDDDDDD...',
];
const BODY_KEY = { R: 'rim', H: 'shine', B: 'body', D: 'shade' };
const BODY_X = 8, BODY_Y = 15; // body occupies x 8..23, y 15..26 at rest

function canvas() { return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null)); }

function line(set, x0, y0, x1, y1, c) {
  let dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (;;) {
    set(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Glyphs for small accessories (outlined like the body). */
const GLYPH = {
  z: ['zzz', '..z', '.z.', 'zzz'],
  Z: ['zzzz', '..z.', '.z..', 'zzzz'],
  bang: ['e', 'e', 'e', '.', 'e'],
  dot: ['ee', 'ee'],
};

/**
 * pose: {
 *   dx, dy           body offset in whole pixels
 *   eyes             'open'|'half'|'closed'|'happy'|'sleep'|'wide'|'down'
 *   look             [x,y] pupil offset for open/wide/down eyes
 *   feet             per-leg foot lift, keyed L0/L1 (upper/lower) and R0/R1 (0 = planted)
 *   wave             upper-left arm raised: 0 none, 1 lifting, 2 out, 3 in
 *   hanging          dangle pose: feet move with the body instead of staying planted
 * }
 */
/** Raised upper-left arm for waving: [kneeX, kneeY, footX, footY] per wave pose. */
const WAVE_ARM = [
  [5, 17, 4, 13],  // 1: lifting
  [5, 16, 3, 11],  // 2: raised, tipped slightly back
  [5, 16, 5, 11],  // 3: raised, tipped slightly forward
];

function drawSpider(pose = {}) {
  const fill = canvas(), overlay = canvas();
  const dx = pose.dx ?? 0, dy = pose.dy ?? 0;
  const set = (layer) => (x, y, c) => { if (x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT) layer[y][x] = PALETTE[c]; };
  const put = set(fill), over = set(overlay);
  const feet = pose.feet ?? {};

  // Two legs per side, built from straight 2px segments so every limb reads as one clean
  // shape at 1×: a thigh out from the body, a knee, and a shin down to the foot. Left side
  // is defined here; the right side mirrors x around the body axis (15.5).
  //   A = upper/back leg (darker), B = lower/front leg.
  // Feet are planted on the ground (body moves, shins stretch) unless the pose lifts them;
  // when dangling, feet hang with the body instead.
  const LEGS = [
    { hipY: BODY_Y + 5, knee: 3, foot: 27, color: 'legDark', tip: 'leg' },
    { hipY: BODY_Y + 8, knee: 6, foot: 29, color: 'leg', tip: 'legLight' },
  ];
  const thick = (x0, y0, x1, y1, c, mx) => { line(put, mx(x0), y0, mx(x1), y1, c); line(put, mx(x0 + 1), y0, mx(x1 + 1), y1, c); };

  function leg(side, i) {
    const spec = LEGS[i];
    const mx = (x) => (side ? 31 - x : x);
    const key = (side ? 'R' : 'L') + i;
    const c = spec.color;
    const hipY = spec.hipY + dy, kneeX = spec.knee + dx, hipX = BODY_X + 1 + dx;
    const raised = !side && i === 0 && pose.wave ? WAVE_ARM[pose.wave - 1] : null;
    if (raised) {
      // Whole arm rotates: thigh and shin both change angle each frame.
      const [kx, ky, fx, fy] = raised.map((v, n) => v + (n % 2 ? dy : dx));
      thick(hipX - 1, hipY, kx, ky, 'leg', mx); thick(hipX - 1, hipY + 1, kx, ky + 1, 'leg', mx);
      thick(kx, ky, fx, fy, 'leg', mx);
      put(mx(fx), fy, 'legLight'); put(mx(fx + 1), fy, 'legLight');
      return;
    }
    const footY = (pose.hanging ? spec.foot + dy : spec.foot) - (feet[key] ?? 0);
    // Thigh: horizontal bar from the body to the knee, two pixels tall.
    for (let x = kneeX; x <= hipX; x++) { put(mx(x), hipY, c); put(mx(x), hipY + 1, c); }
    // Shin: vertical bar from the knee to the foot, two pixels wide.
    for (let y = hipY + 2; y <= footY; y++) { put(mx(kneeX), y, c); put(mx(kneeX + 1), y, c); }
    put(mx(kneeX), hipY, spec.tip);                       // knee joint
    put(mx(kneeX), footY, spec.tip); put(mx(kneeX + 1), footY, spec.tip); // foot
  }

  // Legs sit behind the body so nothing ever crosses the face.
  for (const i of [0, 1]) for (const side of [0, 1]) leg(side, i);
  for (let y = 0; y < BODY.length; y++) for (let x = 0; x < 16; x++) {
    const k = BODY[y][x]; if (k !== '.') put(BODY_X + x + dx, BODY_Y + y + dy, BODY_KEY[k]);
  }

  // Eyes (inside the body; drawn after legs so nothing crosses the face).
  const eyes = pose.eyes ?? 'open';
  const [lx, ly] = pose.look ?? [0, 0];
  for (const ex of [BODY_X + 3, BODY_X + 10]) {
    const x = ex + dx, y = BODY_Y + 6 + dy;
    if (eyes === 'open' || eyes === 'down') {
      const oy = eyes === 'down' ? 1 : ly;
      for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) put(x + xx + lx, y + yy + oy, 'eye');
    } else if (eyes === 'wide') {
      for (let yy = -1; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) put(x + xx + lx, y + yy + ly, 'eye');
    } else if (eyes === 'half') {
      for (let xx = 0; xx < 3; xx++) { put(x + xx, y + 1, 'eye'); put(x + xx, y + 2, 'eye'); }
    } else if (eyes === 'closed') {
      for (let xx = 0; xx < 3; xx++) put(x + xx, y + 2, 'eye');
    } else if (eyes === 'happy') { // ^ ^
      put(x + 1, y, 'eye'); put(x, y + 1, 'eye'); put(x + 2, y + 1, 'eye'); put(x, y + 2, 'eye'); put(x + 2, y + 2, 'eye');
    } else if (eyes === 'sleep') { // ‿ ‿
      put(x, y + 1, 'eye'); put(x + 1, y + 2, 'eye'); put(x + 2, y + 1, 'eye');
    }
  }
  return { fill, overlay, put, over, dx, dy };
}

function glyph(put, name, x, y, color) {
  GLYPH[name].forEach((row, yy) => [...row].forEach((ch, xx) => { if (ch !== '.') put(x + xx, y + yy, color); }));
}

/** Compose fill + generated outline + overlay into the final pixel grid. */
function finish({ fill, overlay }, rim = null) {
  const outline = PALETTE.outline;
  const out = canvas();
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    if (fill[y][x]) { out[y][x] = fill[y][x]; continue; }
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => fill[y + oy]?.[x + ox]);
    if (near) out[y][x] = outline;
  }
  if (rim) {
    const solid = out.map((row) => row.slice());
    for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
      if (solid[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([ox, oy]) => solid[y + oy]?.[x + ox])) out[y][x] = rim;
    }
  }
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) if (overlay[y][x]) out[y][x] = overlay[y][x];
  return out;
}

// --- Per-state choreography -------------------------------------------------------------
// Each state is eight frames. CSS chooses timing; some rows are pose libraries that CSS
// sequences with uneven holds (idle), others are straight loops (walking, working).

const IDLE = [ // pose library: 0 rest, 1 breathe-in, 2 half, 3 closed, 4 look-left, 5 look-right, 6 look-up, 7 foot tap
  { }, { dy: 1 }, { eyes: 'half' }, { eyes: 'closed' }, { look: [-1, 0] }, { look: [1, 0] }, { look: [0, -1] }, { feet: { L1: 1 } },
];
const BLINK = [{}, { eyes: 'half' }, { eyes: 'closed' }, { eyes: 'half' }, {}, {}, {}, {}];
// Diagonal gait: upper-left + lower-right lift together, then the other pair. Body bobs.
const WALK = [0, 1, 2, 3, 4, 5, 6, 7].map((f) => {
  const a = [0, 1, 2, 1, 0, 0, 0, 0][f], b = [0, 0, 0, 0, 0, 1, 2, 1][f];
  return { dy: [0, -1, -1, 0, 0, -1, -1, 0][f], feet: { L0: a, R1: a, L1: b, R0: b } };
});

export function drawFrame(state, frame = 0, { tone = 'light' } = {}) {
  if (!STATES.includes(state) || !Number.isInteger(frame) || frame < 0 || frame >= FRAMES) throw new Error('Invalid spider frame');
  let s;
  switch (state) {
    case 'idle': s = drawSpider(IDLE[frame]); break;
    case 'blink': s = drawSpider(BLINK[frame]); break;
    case 'walking': s = drawSpider(WALK[frame]); break;
    case 'working': {
      // Typing on a keyboard in front of it: eyes down, lower feet resting on the keys and
      // tapping in turn while the pressed key lights up.
      const tap = frame % 2;
      s = drawSpider({ eyes: 'down', feet: { L1: 2 + tap, R1: 3 - tap } });
      const { put, over } = s;
      // Keyboard case.
      for (let y = 28; y <= 31; y++) for (let x = 5; x <= 26; x++) put(x, y, 'laptop');
      // Two staggered rows of keys and a space bar.
      for (let x = 6; x <= 25; x++) {
        if ((x - 6) % 3 !== 2) put(x, 29, 'laptopLight');
        if ((x - 7) % 3 !== 2 && x >= 7 && x <= 24) put(x, 30, 'laptopLight');
      }
      for (let x = 11; x <= 20; x++) put(x, 31, 'laptopLight');
      // The key under the tapping foot lights up (left and right alternate).
      const key = [[6, 29], [24, 29], [9, 29], [21, 29], [7, 30], [23, 30], [12, 29], [18, 29]][frame];
      over(key[0], key[1], 'screen'); over(key[0] + 1, key[1], 'screen');
      break;
    }
    case 'thinking': {
      // Looks up and to the side; three dots appear one by one, then hold.
      const lookUp = frame < 2 ? [0, 0] : [1, -1];
      s = drawSpider({ look: lookUp, dy: frame === 1 ? 1 : 0 });
      const dots = [0, 0, 1, 2, 3, 3, 3, 0][frame];
      for (let i = 0; i < dots; i++) glyph(s.put, 'dot', 20 + i * 3, 10, 'eye');
      break;
    }
    case 'scanning': {
      // Eyes sweep left→right→left while a beam passes over the body.
      const look = [[-1, 0], [-1, 0], [0, 0], [1, 0], [1, 0], [1, 0], [0, 0], [-1, 0]][frame];
      s = drawSpider({ look });
      const beam = 12 + frame * 2;
      for (let x = 4; x <= 27; x++) if (s.fill[beam]?.[x] || (x > 6 && x < 25)) s.over(x, beam, x % 2 ? 'screen' : 'eye');
      // Corner brackets frame the target area.
      for (const [x, y, hx, vy] of [[4, 11, 1, 1], [27, 11, -1, 1]]) { s.over(x, y, 'eye'); s.over(x + hx, y, 'eye'); s.over(x, y + vy, 'eye'); }
      break;
    }
    case 'success': {
      // Crouch → jump → apex sparkle → land → happy hold (frame 7 is the resting result).
      const dy = [1, -2, -4, -4, -2, 1, 0, 0][frame];
      const lift = [0, 2, 3, 3, 2, 0, 0, 0][frame];
      const all = { L0: lift, L1: lift, R0: lift, R1: lift };
      s = drawSpider({ dy, feet: all, eyes: frame === 0 ? 'closed' : 'happy' });
      if (frame >= 2) { // \ | / burst above the head, like the reference sheet
        const y = Math.max(3, 11 + dy);
        for (const [x, yy] of [[15, y - 3], [15, y - 2], [16, y - 3], [16, y - 2], [10, y - 2], [11, y - 1], [21, y - 2], [20, y - 1]]) s.over(x, yy, 'eye');
      }
      break;
    }
    case 'sleep': {
      // Slow breathing with z's drifting up and to the right.
      s = drawSpider({ eyes: 'sleep', dy: [0, 0, 1, 1, 1, 1, 0, 0][frame] });
      // A small z rises from the head and grows; a second one starts halfway through.
      const a = [[22, 11, 'z'], [23, 10, 'z'], [23, 9, 'z'], [24, 7, 'Z'], [25, 6, 'Z'], [25, 5, 'Z'], [26, 3, 'Z'], [26, 2, 'Z']][frame];
      glyph(s.put, a[2], a[0], a[1], 'eye');
      if (frame >= 5) glyph(s.put, 'z', 21 + (frame - 5), 11 - (frame - 5), 'eye');
      break;
    }
    case 'attention': {
      // Startle hop, wide eyes and an exclamation mark; frame 0 is the steady hold.
      const dy = [0, -2, 0, 0, -1, 0, 0, 0][frame];
      const lift = [0, 1, 0, 0, 0, 0, 0, 0][frame];
      s = drawSpider({ dy, eyes: 'wide', feet: { L0: lift, L1: lift, R0: lift, R1: lift } });
      if (frame !== 3 && frame !== 6) glyph(s.put, 'bang', 26, 8 + Math.min(dy, 0), 'eye');
      break;
    }
    case 'wave': {
      // Raises the left front leg and waves twice; happy eyes.
      // Lifts the whole upper arm and holds it up; only the forearm tips back and forth by
      // one or two pixels so the arm stays solid.
      const w = [0, 1, 2, 3, 2, 3, 2, 1][frame];
      s = drawSpider({ wave: w, eyes: frame === 0 ? 'open' : 'happy' });
      break;
    }
    case 'idea': {
      // Looks up, a lightbulb pops in and glows.
      s = drawSpider({ eyes: frame === 0 ? 'open' : 'wide', look: frame === 0 ? [0, 0] : [0, -1], dy: frame === 1 ? -1 : 0 });
      if (frame >= 1) {
        const glow = frame % 2 === 0;
        const y = frame === 1 ? 4 : 3;
        // bulb 4×4 + base
        for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) if (!((yy === 0 || yy === 3) && (xx === 0 || xx === 3))) s.put(14 + xx, y + yy, 'bulb');
        s.put(15, y + 4, 'bulbBase'); s.put(16, y + 4, 'bulbBase');
        s.put(15, y + 1, 'glint');
        if (glow && frame >= 2) { s.over(12, y + 1, 'bulb'); s.over(19, y + 1, 'bulb'); s.over(15, y - 2, 'bulb'); s.over(16, y - 2, 'bulb'); }
      }
      break;
    }
    case 'dangle': {
      // Hangs on a straight silk thread and bobs up and down on it (a yo-yo, not a swing,
      // so the thread never kinks); legs kick gently in alternation.
      const dy = [-7, -8, -9, -9, -8, -7, -6, -6][frame];
      const kick = frame % 4 < 2;
      s = drawSpider({ dy, hanging: true, feet: { L0: kick ? 1 : 0, R0: kick ? 0 : 1, L1: kick ? 0 : 1, R1: kick ? 1 : 0 } });
      const top = BODY_Y + dy - 1; // outline row above the body
      for (let y = 0; y < top; y++) s.over(15, y, 'thread');
      break;
    }
  }
  return finish(s, tone === 'dark' ? DARK_RIM : null);
}

export function frameSvg(pixels) {
  const paths = new Map();
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH;) {
    const color = pixels[y][x]; let end = x + 1; while (end < WIDTH && pixels[y][end] === color) end++;
    if (color) paths.set(color, (paths.get(color) ?? '') + `M${x} ${y}h${end - x}v1H${x}z`);
    x = end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" shape-rendering="crispEdges">${[...paths].map(([color, d]) => `<path fill="${color}" d="${d}"/>`).join('')}</svg>`;
}
