import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const directory=new URL('../../../public/images/brand/mascot/review-v2/',import.meta.url);
const source=JSON.parse(await readFile(new URL('state-edits.json',import.meta.url),'utf8'));
const base=await sharp(new URL('deepvisor-spider-open.png',directory).pathname).ensureAlpha().raw().toBuffer();
const strip=await sharp(new URL('deepvisor-spider-states-strip.png',directory).pathname).ensureAlpha().raw().toBuffer({resolveWithObject:true});
assert.equal(strip.info.width,448);assert.equal(strip.info.height,48);
const frames=[];
for(const [index,state] of source.states.entries()){
 const file=`deepvisor-spider-${state.name}.png`,png=await readFile(new URL(file,directory));
 const {data,info}=await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(info.width,64);assert.equal(info.height,48);
 const palette=new Set();
 for(let y=0;y<48;y++)for(let x=0;x<64;x++){
  const i=(y*64+x)*4,alpha=data[i+3];assert.ok(alpha===0||alpha===255);
  if(alpha)palette.add(data.subarray(i,i+4).toString('hex'));
  const permitted=state.name.startsWith('working')?x>=19&&x<=46&&y>=32&&y<=43:state.name.startsWith('scanning')?x>=29&&x<=35&&y>=6&&y<=7:state.name==='attention'?x>=31&&x<=32&&y>=3&&y<=9:y>=23&&y<=28&&((x>=24&&x<=29)||(x>=36&&x<=41));
  if(!permitted)assert.ok(data.subarray(i,i+4).equals(base.subarray(i,i+4)),`${state.name}: anatomy changed at ${x},${y}`);
 }
 assert.ok(palette.size<=8);
 for(let y=0;y<48;y++)assert.ok(strip.data.subarray((y*448+index*64)*4,(y*448+index*64+64)*4).equals(data.subarray(y*64*4,(y+1)*64*4)));
 frames.push({name:state.name,index,file,workbench:state.workbench,sha256:createHash('sha256').update(png).digest('hex')});
}
const states={
 working:{sequence:[{frame:0,durationMs:800},{frame:1,durationMs:800}],loop:true,reducedMotionFrame:0},
 scanning:{sequence:[{frame:2,durationMs:900},{frame:3,durationMs:900}],loop:true,reducedMotionFrame:2},
 success:{sequence:[{frame:4,durationMs:1200}],loop:false,reducedMotionFrame:4},
 attention:{sequence:[{frame:5,durationMs:1}],loop:false,reducedMotionFrame:5},
 sleep:{sequence:[{frame:6,durationMs:1}],loop:false,reducedMotionFrame:6},
};
await writeFile(new URL('states-manifest.json',directory),JSON.stringify({version:1,status:'review-only',canvas:{width:64,height:48},strip:'deepvisor-spider-states-strip.png',frames,states,provenance:{provider:'PixelLab workbench',master:source.master,stripWorkbench:'94abaca9-0341-4162-b8cf-a8ded041df54',stripGallery:'41681fb1-488c-4a85-8adc-2e8bcb9ca6a4',generationsCharged:0}},null,2)+'\n');
console.log('Verified seven PixelLab frames: stable anatomy, exact strip contents, binary transparency, eight-color palette.');
