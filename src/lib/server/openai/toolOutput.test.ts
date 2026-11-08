import { expect,it } from 'vitest';
import { boundedToolOutput } from './toolOutput';
it('limits whole rows and declares partial coverage without changing metrics or identifiers',()=>{
 const rows=Array.from({length:20},(_,i)=>({id:`native-id-${i}`,spend:50+i,name:'x'.repeat(100)}));
 const output=boundedToolOutput(rows,500),parsed=JSON.parse(output);
 expect(Buffer.byteLength(output)).toBeLessThanOrEqual(500);
 expect(parsed.truncated).toBe(true);expect(parsed.availableRows).toBe(20);
 expect(parsed.data).toEqual(rows.slice(0,parsed.returnedRows));
 const nested=JSON.parse(boundedToolOutput({currency:'USD',nodes:rows},500));
 expect(nested.currency).toBe('USD');expect(nested.truncated).toBe(true);expect(nested.nodes[0]).toEqual(rows[0]);
});
it('does not truncate identifiers or unstructured objects to manufacture valid JSON',()=>{
 expect(()=>boundedToolOutput({id:'x'.repeat(1000)},100)).toThrow('too broad');
});
