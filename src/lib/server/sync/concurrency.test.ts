import {expect,it,vi} from 'vitest';
import {parallelTasks} from './concurrency';
it('reduces eight independent 30ms operations to three waves at concurrency three',async()=>{
 vi.useFakeTimers();let active=0,max=0;
 const start=Date.now();
 const work=parallelTasks(Array.from({length:8},(_,i)=>async()=>{active++;max=Math.max(max,active);await new Promise(r=>setTimeout(r,30));active--;return i;}));
 await vi.runAllTimersAsync();expect(await work).toEqual([0,1,2,3,4,5,6,7]);expect(max).toBe(3);expect(Date.now()-start).toBe(90);vi.useRealTimers();
});
it('waits for in-flight work before propagating failure',async()=>{
 let finished=false;
 await expect(parallelTasks([async()=>{throw new Error('failed');},async()=>{await Promise.resolve();finished=true;}])).rejects.toThrow('failed');
 expect(finished).toBe(true);
});
