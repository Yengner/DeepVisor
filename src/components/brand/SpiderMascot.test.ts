import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import SpiderMascot, { spiderStates, spiderScale, SPIDER_FRAME } from './SpiderMascot';
import PixelCompanion from './PixelCompanion';
import { drawFrame, WIDTH, HEIGHT, FRAMES, STATES, PALETTE, DARK_RIM } from '../../../scripts/design/spider-art.mjs';

const render = (props: Parameters<typeof SpiderMascot>[0]) => renderToStaticMarkup(createElement(SpiderMascot, props));
const eyePixels = (pixels: (string | null)[][]) => pixels.flat().filter((c) => c === PALETTE.eye || c === PALETTE.glint).length;

describe('SpiderMascot accessibility and compatibility', () => {
  it('is decorative unless explicitly labeled; escapes accessible copy', () => {
    expect(render({})).toContain('aria-hidden="true"');
    expect(render({})).not.toContain('role="img"');
    const labeled = render({ state: 'working', label: 'Preparing <report>' });
    expect(labeled).toContain('role="img"');
    expect(labeled).toContain('aria-label="Preparing &lt;report&gt;"');
    expect(labeled).not.toContain('aria-live');
    expect(render({ label: '  ' })).not.toContain('role="img"');
  });
  it('preserves caller sizes and explicit pauses; invalid sizes fall back safely', () => {
    expect(render({ size: 64, paused: true })).toContain('--spider-size:64px');
    expect(render({ paused: true })).toContain('data-paused="true"');
    for (const size of [NaN, Infinity, 0, -2]) expect(render({ size })).toContain('--spider-size:48px');
  });
  it('maps existing UI states without inventing success for attention or loading', () => {
    for (const [state, expected] of [['analyzing', 'scanning'], ['completed', 'success'], ['attention', 'attention']] as const) {
      expect(renderToStaticMarkup(createElement(PixelCompanion, { state }))).toContain(`data-state="${expected}"`);
    }
  });
});

describe('whole-pixel scaling (the source of the old visual glitches)', () => {
  it('always renders the 32px grid at an integer multiple, centred on whole pixels', () => {
    for (const size of [1, 26, 28, 32, 40, 44, 48, 56, 64, 76, 96, 128, 200]) {
      const { box, scale } = spiderScale(size);
      expect(Number.isInteger(scale)).toBe(true);
      expect(scale).toBeGreaterThanOrEqual(1);
      expect(SPIDER_FRAME * scale).toBeLessThanOrEqual(box);
      const html = render({ size });
      const inset = Number(html.match(/--spider-inset:(-?\d+(?:\.\d+)?)px/)?.[1]);
      expect(Number.isInteger(inset)).toBe(true);
      expect(html).toContain(`--spider-frame:${SPIDER_FRAME * scale}px`);
    }
    expect(spiderScale(64)).toEqual({ box: 64, scale: 2 });
    expect(spiderScale(28)).toEqual({ box: 32, scale: 1 });
  });
  it('selects whole-pixel sprite rows and the dark sheet for dark surfaces', () => {
    for (const [row, state] of spiderStates.entries()) expect(render({ state, size: 64 })).toContain(`--spider-row:${row === 0 ? 0 : -row * 64}px`);
    expect(render({ tone: 'dark' })).toContain('data-tone="dark"');
  });
});

describe('production sprite contract', () => {
  it('matches the component row order and every generated pixel, for light and dark sheets', async () => {
    expect([...spiderStates]).toEqual(STATES);
    const palette = new Set([...Object.values(PALETTE), DARK_RIM]);
    for (const [tone, file] of [['light', 'deepvisor-spider-sprite.png'], ['dark', 'deepvisor-spider-sprite-dark.png']] as const) {
      const png = await readFile(new URL(`../../../public/images/brand/mascot/${file}`, import.meta.url));
      expect(png.length).toBeLessThan(10_000);
      const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([WIDTH * FRAMES, HEIGHT * STATES.length]);
      for (const [row, state] of STATES.entries()) for (let frame = 0; frame < FRAMES; frame++) {
        const pixels = drawFrame(state, frame, { tone });
        let count = 0;
        for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
          const offset = ((row * HEIGHT + y) * info.width + frame * WIDTH + x) * 4;
          const expected = pixels[y][x];
          if (expected) {
            count++;
            if (data[offset + 3] !== 255 || '#' + data.subarray(offset, offset + 3).toString('hex') !== expected || !palette.has(expected)) throw new Error(`Pixel mismatch: ${tone}/${state}/${frame}/${x}/${y}`);
          } else if (data[offset + 3] !== 0) throw new Error(`Unexpected background pixel: ${tone}/${state}/${frame}`);
        }
        expect(count).toBeGreaterThan(250);
      }
    }
  });
  it('keeps the eyes visible in every frame of every state', () => {
    for (const state of STATES) for (let frame = 0; frame < FRAMES; frame++) {
      const pixels = drawFrame(state, frame);
      expect(eyePixels(pixels)).toBeGreaterThanOrEqual(4);
    }
  });
  it('keeps the walking body anchored: feet move, the body only bobs one pixel', () => {
    const bodyTop = (pixels: (string | null)[][]) => pixels.findIndex((row) => row.slice(13, 19).includes(PALETTE.rim));
    const tops = Array.from({ length: FRAMES }, (_, f) => bodyTop(drawFrame('walking', f)));
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);
    const frames = new Set(Array.from({ length: FRAMES }, (_, f) => JSON.stringify(drawFrame('walking', f))));
    expect(frames.size).toBeGreaterThanOrEqual(5);
  });
  it('renders every state as a distinct first frame or a distinct sequence', () => {
    const sequences = new Set(STATES.map((state) => JSON.stringify(Array.from({ length: FRAMES }, (_, f) => drawFrame(state, f)))));
    expect(sequences.size).toBe(STATES.length);
  });
});
