// Node 24. Rebuild the production sheets from deterministic, integer pixel geometry.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { WIDTH, HEIGHT, FRAMES, STATES, drawFrame, frameSvg } from './spider-art.mjs';

const directory = new URL('../../public/images/brand/mascot/', import.meta.url);
await mkdir(directory, { recursive: true });
const width = WIDTH * FRAMES, height = HEIGHT * STATES.length;

async function sheet(tone) {
  const rgba = Buffer.alloc(width * height * 4);
  for (const [row, state] of STATES.entries()) {
    for (let frame = 0; frame < FRAMES; frame++) {
      const pixels = drawFrame(state, frame, { tone });
      for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
        const color = pixels[y][x];
        if (!color) continue;
        const offset = ((row * HEIGHT + y) * width + frame * WIDTH + x) * 4;
        rgba[offset] = parseInt(color.slice(1, 3), 16); rgba[offset + 1] = parseInt(color.slice(3, 5), 16);
        rgba[offset + 2] = parseInt(color.slice(5, 7), 16); rgba[offset + 3] = 255;
      }
    }
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).png({ palette: true, compressionLevel: 9 }).toBuffer();
}

for (const [tone, name] of [['light', 'deepvisor-spider-sprite.png'], ['dark', 'deepvisor-spider-sprite-dark.png']]) {
  const png = await sheet(tone);
  await writeFile(new URL(name, directory), png);
  console.log(`${name}: ${width}×${height}, ${STATES.length} states × ${FRAMES} frames, ${png.length} bytes`);
}
await writeFile(new URL('deepvisor-spider-idle.svg', directory), frameSvg(drawFrame('idle')));
