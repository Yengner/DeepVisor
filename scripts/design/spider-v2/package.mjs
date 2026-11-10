// Node 24. Verify PixelLab exports and package review artifacts; never touches production sprites.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {frameSvg} from '../spider-art.mjs';
const directory=new URL('../../../public/images/brand/mascot/review-v2/',import.meta.url);
const names=['open','half','closed'],frames=[];
for(const name of names){
 const png=await readFile(new URL(`deepvisor-spider-${name}.png`,directory));
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,64);assert.equal(info.height,48);
 const colors=new Set();for(let i=0;i<data.length;i+=4){assert.ok(data[i+3]===0||data[i+3]===255,'No partial alpha or white halos');if(data[i+3])colors.add(data.subarray(i,i+4).toString('hex'));}
 assert.ok(colors.size<=8);frames.push({name,png,data,sha256:createHash('sha256').update(png).digest('hex')});
}
for(const [index,frame] of frames.entries()){
 let changed=0;
 for(let y=0;y<48;y++)for(let x=0;x<64;x++){
  const offset=(y*64+x)*4;
  assert.equal(frame.data[offset+3],frames[0].data[offset+3],'Silhouette must not move');
  if(!frame.data.subarray(offset,offset+4).equals(frames[0].data.subarray(offset,offset+4))){changed++;assert.ok(y>=23&&y<=28&&((x>=24&&x<=29)||(x>=36&&x<=41)),'Only eyes may change');}
 }
 assert.equal(changed,[0,36,60][index]);
}
const strip=await sharp(new URL('deepvisor-spider-blink-strip.png',directory).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(strip.info.width,192);assert.equal(strip.info.height,48);
for(let frame=0;frame<3;frame++)for(let y=0;y<48;y++)assert.ok(strip.data.subarray((y*192+frame*64)*4,(y*192+frame*64+64)*4).equals(frames[frame].data.subarray(y*64*4,(y+1)*64*4)));
const blink=[{frame:1,durationMs:40},{frame:2,durationMs:80},{frame:1,durationMs:60}];
const idle=[4200,6200,5100].flatMap(durationMs=>[{frame:0,durationMs},...blink]);
const manifest={version:1,status:'review-only',canvas:{width:64,height:48},strip:'deepvisor-spider-blink-strip.png',frames:frames.map(({name,sha256},index)=>({name,index,x:index*64,y:0,width:64,height:48,file:`deepvisor-spider-${name}.png`,sha256})),blink:{sequence:[...blink,{frame:0,durationMs:1}],loop:false},idle:{sequence:idle,durationMs:idle.reduce((n,f)=>n+f.durationMs,0),loop:true},reducedMotionFrame:0,provenance:{provider:'PixelLab',model:'pixen',seed:110926,generationJob:'8c0b509b-46f7-4ab1-9173-ff02e68ca68e',masterWorkbench:'481b0154-6ef3-40fb-b0a2-d4796b57d02b',halfWorkbench:'b36892ff-b9d5-42a0-ad82-6af6ee568644',closedWorkbench:'eb772209-a7b3-4b5d-8d88-97e167364eec',stripWorkbench:'059c1f2c-af4e-4b4a-b062-24fe25149689',masterGallery:'e80c9bf7-6e92-4fbb-9b8f-497d6e77d093',stripGallery:'f9e6086e-94cf-4e71-bc33-64c7d7f77b44',generationsCharged:1}};
await writeFile(new URL('manifest.json',directory),JSON.stringify(manifest,null,2)+'\n');
const pixels=Array.from({length:48},(_,y)=>Array.from({length:64},(_,x)=>{const i=(y*64+x)*4;return frames[0].data[i+3]?'#'+frames[0].data.subarray(i,i+3).toString('hex'):null;}));
await writeFile(new URL('deepvisor-spider-open.svg',directory),frameSvg(pixels));
const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600"><rect width="960" height="600" fill="#f5f8ff"/><rect x="480" y="90" width="480" height="510" fill="#081a30"/><g font-family="Helvetica,Arial,sans-serif"><text x="28" y="38" font-size="23" fill="#123455" font-weight="bold">DeepVisor · PixelLab spider refinement</text><text x="28" y="67" font-size="14" fill="#536b86">Review candidate · three registered frames · eye-only animation · production mascot unchanged</text><text x="28" y="126" font-size="14" fill="#536b86">LIGHT SURFACE</text><text x="508" y="126" font-size="14" fill="#a9bdd6">DARK SURFACE</text>${['Open','Half closed','Closed'].flatMap((label,i)=>[0,480].map(offset=>`<text x="${28+i*150+offset}" y="${410}" fill="${offset?'#c7d9ed':'#23486d'}" font-size="13">${label}</text>`)).join('')}<text x="28" y="456" fill="#536b86" font-size="14">ACTUAL UI SIZES · 32 / 48 / 64 PX</text><text x="508" y="456" fill="#a9bdd6" font-size="14">ACTUAL UI SIZES · 32 / 48 / 64 PX</text><text x="28" y="573" fill="#536b86" font-size="13">No mouth, glow, shadows, labels or matte in the source assets.</text></g></svg>`);
const layers=[];
for(const offset of [0,480]){
 layers.push({input:await sharp(frames[0].png).resize(256,192,{kernel:'nearest'}).toBuffer(),left:112+offset,top:130});
 for(let i=0;i<3;i++)layers.push({input:await sharp(frames[i].png).resize(96,72,{kernel:'nearest'}).toBuffer(),left:28+i*150+offset,top:326});
 for(const [i,size]of [32,48,64].entries())layers.push({input:await sharp(frames[0].png).resize(size,size*3/4,{kernel:'nearest'}).toBuffer(),left:40+i*120+offset,top:480});
}
await sharp(svg).composite(layers).png().toFile(new URL('review-sheet.png',directory).pathname);
console.log('Verified: 64x48 transparent frames; 8 colors; 36/60 eye-only changes; identical silhouettes; exact 192x48 strip. Review sheet, SVG and manifest written.');
