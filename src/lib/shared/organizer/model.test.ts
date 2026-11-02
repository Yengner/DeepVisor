import {expect,it} from 'vitest';
import {defaults,renderName,parentMap,propose,validateDraft,type Snapshot} from './model';
const snapshot:Snapshot={accountId:'a',accountName:'Test',capturedAt:'2026-10-30',zone:'UTC',currency:'USD',nodes:[{id:'11111111-1111-4111-8111-111111111111',externalId:'meta-1',parentId:null,level:'campaign',name:'Salon',creativeId:null,createdAt:'2026-01-01',objective:'LEADS',optimization:null,status:'ACTIVE',image:null,spend:null,firstDelivery:'2026-02-01',lastDelivery:'2026-10-29'}]};
it('formats known values and omits missing dates without inventing launch dates',()=>{
 expect(renderName(defaults.ad,{Concept:'Hair',Version:'V02',LaunchDate:'2026-09-19'},defaults)).toBe('Hair | V02 | 2026-09-19');
 expect(renderName(defaults.ad,{Concept:'Hair',LaunchDate:'2026-09-19'},{...defaults,dateFormat:'DD/MM/YYYY',separator:' / '})).toBe('Hair / 19/09/2026');
 const d=propose(snapshot);expect(d.edits[0].fields.StartDate).toBeUndefined();expect(d.edits[0].name).toBe('LEADS | Salon');expect(d.edits[0].selected).toBe(false);
});
it('rejects invented tokens and foreign or duplicate entity IDs',()=>{
 expect(()=>renderName('{Revenue}',{},defaults)).toThrow();
 const d=propose(snapshot);expect(()=>validateDraft(snapshot,{...d,edits:[{...d.edits[0],id:'22222222-2222-4222-8222-222222222222'}]})).toThrow();
 expect(()=>validateDraft(snapshot,{...d,edits:[d.edits[0],d.edits[0]]})).toThrow();
});
it('keeps native hierarchy separate from user families and prevents cyclic or invalid nesting',()=>{
 const n=snapshot.nodes[0];expect(parentMap([{...n,parentId:n.id}]).get(n.id)).toBeNull();
 const d=propose(snapshot);d.edits[0].family='My family';expect(validateDraft(snapshot,d).edits[0].family).toBe('My family');expect(snapshot.nodes[0].parentId).toBeNull();
});

it('detects changed rename evidence independently of performance and media',async()=>{
 const {organizationSignature,snapshotStale}=await import('./model');
 expect(snapshotStale(snapshot)).toBe(true);
 expect(organizationSignature({...snapshot,nodes:[{...snapshot.nodes[0],spend:100,image:'https://test/image'}]})).toBe(organizationSignature(snapshot));
 expect(organizationSignature({...snapshot,nodes:[{...snapshot.nodes[0],name:'External rename'}]})).not.toBe(organizationSignature(snapshot));
});
it('rejects invalid calendar dates and handles long original names without truncation',()=>{
 const draft=propose(snapshot);draft.edits[0].fields.StartDate='2026-02-30';expect(()=>validateDraft(snapshot,draft)).toThrow();
 const long={...snapshot,nodes:[{...snapshot.nodes[0],name:'x'.repeat(255)}]};expect(propose(long).edits[0].name).toBe(long.nodes[0].name);
});
it('supports thousands of stable entities without guessed groupings or dates',()=>{
 const nodes=Array.from({length:4000},(_,i)=>({...snapshot.nodes[0],id:`11111111-1111-4111-8111-${String(i).padStart(12,'0')}`,externalId:String(i)}));
 const large={...snapshot,nodes};expect(validateDraft(large,propose(large)).edits).toHaveLength(4000);expect(propose(large).edits.every(e=>!e.selected&&!e.family&&!e.fields.StartDate)).toBe(true);
});
