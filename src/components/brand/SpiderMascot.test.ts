import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import SpiderMascot, { spiderStates } from './SpiderMascot';
import PixelCompanion from './PixelCompanion';
import { drawFrame, WIDTH, HEIGHT, FRAMES, STATES, PALETTE } from '../../../scripts/design/spider-art.mjs';

const render = (props: Parameters<typeof SpiderMascot>[0]) => renderToStaticMarkup(createElement(SpiderMascot, props));
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
  it('preserves caller sizes and explicit pauses without timers or layout changes', () => {
    expect(render({ size: 64, paused: true })).toContain('--spider-size:64px');
    expect(render({ paused: true })).toContain('data-paused="true"');
    for (const size of [NaN, Infinity, 0, -2]) expect(render({ size })).toContain('--spider-size:48px');
    for (const state of spiderStates) expect(render({ state, size: 48 })).toContain('--spider-size:48px');
  });
  it('maps existing UI states without inventing success for attention or loading', () => {
    for (const [state, expected] of [['analyzing','scanning'],['completed','success'],['attention','attention']] as const) {
      expect(renderToStaticMarkup(createElement(PixelCompanion, { state }))).toContain(`data-state="${expected}"`);
    }
  });
});
describe('production sprite contract', () => {
  it('matches the component row order and every generated pixel, with no white matte or partial alpha', async () => {
    expect([...spiderStates]).toEqual(STATES);
    const png = await readFile(new URL('../../../public/images/brand/mascot/deepvisor-spider-sprite.png', import.meta.url));
    expect(png.length).toBeLessThan(10_000);
    const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height]).toEqual([WIDTH * FRAMES, HEIGHT * STATES.length]);
    const palette = new Set(Object.values(PALETTE));
    for (const [row,state] of STATES.entries()) for (let frame=0;frame<FRAMES;frame++) {
      const pixels=drawFrame(state,frame);
      let count=0;
      for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++) {
        const offset=((row*HEIGHT+y)*info.width+frame*WIDTH+x)*4;
        const expected=pixels[y][x];
        if(expected){
          count++;
          if(data[offset+3]!==255 || '#'+data.subarray(offset,offset+3).toString('hex')!==expected || !palette.has(expected)) throw new Error(`Pixel mismatch: ${state}/${frame}/${x}/${y}`);
        } else if(data[offset+3]!==0) throw new Error('Unexpected background pixel');
      }
      expect(count).toBeGreaterThan(600);
    }
  });
  it('keeps eyes square and face position stable throughout walking', () => {
    const positions=[];
    for(let frame=0;frame<FRAMES;frame++) {
      const pixels=drawFrame('walking',frame), eyes=[];
      for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(pixels[y][x]===PALETTE.eye)eyes.push([x,y]);
      expect(eyes.length).toBe(72);
      expect(Math.min(...eyes.map(p=>p[0]))).toBe(24);
      positions.push(Math.min(...eyes.map(p=>p[1])));
    }
    expect(Math.max(...positions)-Math.min(...positions)).toBeLessThanOrEqual(1);
  });
});
