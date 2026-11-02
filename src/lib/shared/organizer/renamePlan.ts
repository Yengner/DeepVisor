import { z } from 'zod';
import { validateDraft, type Snapshot, type Node } from './model';
export const stateSchema=z.object({id:z.string().min(1),accountId:z.string().min(1),level:z.enum(['campaign','adset','ad']),parentId:z.string().nullable(),name:z.string(),updatedAt:z.string().min(1),creativeId:z.string().nullable().optional()}).strict();
export type RenameState=z.infer<typeof stateSchema>;
export type RenameChange={entityId:string;before:RenameState;afterName:string};
export function selectedRenames(snapshot:Snapshot,value:unknown){
 const draft=validateDraft(snapshot,value);const nodes=new Map(snapshot.nodes.map(n=>[n.id,n]));
 const changes=draft.edits.filter(e=>e.selected&&e.name!==nodes.get(e.id)!.name).map(e=>({node:nodes.get(e.id)!,name:e.name}));
 if(!changes.length||changes.length>5)throw new Error('Select between one and five actual name changes per approval.');
 return changes;
}
export function sameState(a:RenameState,b:RenameState){return ['id','accountId','level','parentId','name','updatedAt','creativeId'].every(k=>a[k as keyof RenameState]===b[k as keyof RenameState]);}
export function sameIdentity(a:RenameState,b:RenameState){return ['id','accountId','level','parentId','creativeId'].every(k=>a[k as keyof RenameState]===b[k as keyof RenameState]);}

/** Restoration subsets preserve verified native parents, even when absent from the first baseline. */
export function nativeParent(node:Node,source:Snapshot,baseline:Snapshot){return node.parentExternalId??(node.parentId?source.nodes.find(n=>n.id===node.parentId)?.externalId??baseline.nodes.find(n=>n.id===node.parentId)?.externalId:null)??null;}
