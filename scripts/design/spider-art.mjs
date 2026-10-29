/** Hand-authored 64×48 pixel artwork, faithful to Pixel Spider Robot Mascot Sheet.png.
 * Integer geometry and opaque palette only: no tracing noise, matte, shadows or gradients.
 * Frame zero of every row is a useful reduced-motion/static representation.
 */
export const WIDTH = 64;
export const HEIGHT = 48;
export const FRAMES = 8;
export const STATES = ['idle', 'blink', 'walking', 'working', 'thinking', 'scanning', 'success', 'sleep', 'attention'];
export const PALETTE = {
  outline: '#07172f', body: '#0a2148', face: '#0b254f', rim: '#10366b',
  blue: '#125ac5', mid: '#237beb', light: '#71b8ff', highlight: '#c2e2ff', eye: '#14b8ee',
  laptopEdge: '#153052', laptop: '#415f87', laptopLight: '#6583a8',
};
export function drawFrame(state, frame = 0) {
  if (!STATES.includes(state) || frame < 0 || frame >= FRAMES) throw new Error('Invalid spider frame');
  const pixels = Array.from({length: HEIGHT}, () => Array(WIDTH).fill(null));
  const set = (x,y,c) => { if (x>=0 && x<WIDTH && y>=0 && y<HEIGHT) pixels[y][x]=PALETTE[c]; };
  const rect = (x,y,w,h,c) => { for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)set(xx,yy,c); };
  function poly(points,c) {
    for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
      let inside=false;
      for(let i=0,j=points.length-1;i<points.length;j=i++){
        const [xi,yi]=points[i], [xj,yj]=points[j];
        if((yi>y+.5)!==(yj>y+.5) && x+.5<(xj-xi)*(y+.5-yi)/(yj-yi)+xi) inside=!inside;
      }
      if(inside)set(x,y,c);
    }
  }
  const walking=state==='walking';
  const lift=state==='idle' && frame===1 ? -1 : walking && [1,2,5,6].includes(frame) ? -1 : state==='success' && [2,3].includes(frame) ? -1 : 0;
  // Four independent legs per side, drawn back-to-front. Foot positions stay inside a common canvas.
  const gait=[0,-1,-2,-1,0,1,2,1];
  function leg(side,index,front=false) {
    const motion=walking ? gait[(frame+index*2+(side?4:0))%8] : state==='working' && index===3 ? (frame%4===1 ? -1:0) : 0;
    const feet=[5,9,13,16], tops=[16,18,20,19];
    const x=feet[index], top=tops[index], y=22+index*2, foot=39+(index%2)+motion;
    function shape(points,c){poly(points.map(([px,py])=>[side?64-px:px,py]),c);}
    shape([[top,y-2],[top+3,y-2],[top+3,y+4],[x+5,y+4],[x+5,foot-2],[x+3,foot-2],[x+3,foot+2],[x-2,foot+2],[x-2,foot-5],[x,foot-5],[x,y+3],[x+3,y+3],[x+3,y],[top,y]],'outline');
    shape([[top,y],[top+1,y],[top+1,y+3],[x+4,y+3],[x+4,foot-3],[x+2,foot-3],[x+2,foot],[x,foot],[x,foot-6],[x+2,foot-6],[x+2,y+4],[x+4,y+4],[x+4,y+1],[top,y+1]],index===0?'blue':'mid');
    shape([[x+4,y+1],[top,y+1],[top,y+3],[x+5,y+3],[x+5,y+5],[x+2,y+5],[x+2,y+3],[x+4,y+3]],'light');
    if(front || index===1)shape([[x+4,y+1],[x+6,y+1],[x+6,y+3],[x+3,y+3],[x+3,y+5],[x+1,y+5],[x+1,y+3],[x+4,y+3]],'highlight');
  }
  for(let index=0;index<3;index++){leg(0,index);leg(1,index);}
  const body = (p,c) => poly(p.map(([x,y])=>[x,y+lift]),c);
  body([[23,11],[41,11],[41,13],[45,13],[45,15],[48,15],[48,18],[50,18],[50,23],[51,23],[51,33],[49,33],[49,36],[46,36],[46,38],[18,38],[18,36],[15,36],[15,32],[14,32],[14,23],[16,23],[16,19],[18,19],[18,16],[21,16],[21,13],[23,13]],'outline');
  body([[23,13],[40,13],[40,15],[44,15],[44,17],[47,17],[47,21],[49,21],[49,33],[47,33],[47,35],[44,35],[44,36],[19,36],[19,34],[17,34],[17,23],[19,23],[19,19],[22,19],[22,16],[23,16]],'body');
  body([[24,13],[40,13],[40,15],[44,15],[44,18],[46,18],[46,21],[44,21],[44,18],[40,18],[40,16],[23,16],[23,18],[20,18],[20,21],[18,21],[18,19],[20,19],[20,16],[23,16],[23,14],[24,14]],'rim');
  rect(24,14+lift,15,2,'blue');
  body([[20,26],[45,26],[45,34],[43,34],[43,36],[21,36],[21,34],[19,34],[19,28],[20,28]],'face');
  for(const x of [24,36]){
    const closed=state==='sleep' || (['idle','blink'].includes(state) && frame===3);
    const half=['idle','blink'].includes(state) && [2,4].includes(frame);
    if(state==='success'){
      rect(x,28+lift,2,3,'eye');rect(x+2,26+lift,2,2,'eye');rect(x+4,28+lift,2,3,'eye');
    } else if(closed) rect(x,30+lift,6,1,'eye');
    else if(half) rect(x,29+lift,6,2,'eye');
    else rect(x+(state==='thinking' && frame>2 && frame<6 ? 1:0),26+lift,6,6,'eye');
  }
  leg(0,3,true);leg(1,3,true);
  if(state==='working'){
    poly([[19,33],[43,33],[46,44],[48,44],[48,46],[17,46],[17,44],[21,44]],'laptopEdge');
    poly([[20,33],[42,33],[44,43],[22,43]],'laptopLight');
    poly([[21,35],[41,35],[43,43],[23,43]],'laptop');
    rect(30,38,2,2,'mid');rect(22,44,23,1,'laptopLight');
    rect(25+(frame%4)*3,44,2,1,'light');
  }
  if(state==='scanning'){
    // Small pair of scan brackets; no glow or orbiting decoration.
    const x=23+frame*2;rect(x,7,3,1,'mid');rect(x,8,1,2,'mid');rect(x+10,7,3,1,'mid');rect(x+12,8,1,2,'mid');
  }
  if(state==='attention'){rect(53,14,2,5,'eye');rect(53,21,2,2,'eye');}
  return pixels;
}
export function frameSvg(pixels) {
  const paths=new Map();
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;){
    const color=pixels[y][x];let end=x+1;while(end<WIDTH && pixels[y][end]===color)end++;
    if(color)paths.set(color,(paths.get(color) ?? '')+`M${x} ${y}h${end-x}v1H${x}z`);
    x=end;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48" shape-rendering="crispEdges">${[...paths].map(([color,d])=>`<path fill="${color}" d="${d}"/>`).join('')}</svg>`;
}
