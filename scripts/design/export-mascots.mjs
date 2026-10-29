// Node 24. Rebuild the production sheet from deterministic, integer pixel geometry.
import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { WIDTH, HEIGHT, FRAMES, STATES, drawFrame, frameSvg } from './spider-art.mjs';
const directory=new URL('../../public/images/brand/mascot/',import.meta.url);
await mkdir(directory,{recursive:true});
const width=WIDTH*FRAMES,height=HEIGHT*STATES.length;
const rgba=Buffer.alloc(width*height*4);
for(const [row,state] of STATES.entries()){
  for(let frame=0;frame<FRAMES;frame++){
    const pixels=drawFrame(state,frame);
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      if(!pixels[y][x])continue;
      const offset=((row*HEIGHT+y)*width+frame*WIDTH+x)*4;
      rgba[offset]=parseInt(pixels[y][x].slice(1,3),16);rgba[offset+1]=parseInt(pixels[y][x].slice(3,5),16);rgba[offset+2]=parseInt(pixels[y][x].slice(5,7),16);rgba[offset+3]=255;
    }
  }
}
const png=await sharp(rgba,{raw:{width,height,channels:4}}).png({palette:true,compressionLevel:9}).toBuffer();
await writeFile(new URL('deepvisor-spider-sprite.png',directory),png);
await writeFile(new URL('deepvisor-spider-idle.svg',directory),frameSvg(drawFrame('idle')));
console.log(`Spider sheet: ${width}×${height}, ${STATES.length} states, ${png.length} bytes. Transparent static SVG also written.`);
