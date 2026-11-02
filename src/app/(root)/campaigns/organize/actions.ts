'use server';
import { unstable_rethrow } from 'next/navigation';
import { inspect,history,save } from '@/lib/server/organizer/service';
export async function organizerAction(account:string,operation:'inspect'|'history'|'save',payload?:{consent?:string;baselineId?:string;previous?:number;draft?:unknown;sourceVersion?:string;versionId?:string}) {
 try {
  const data=operation==='inspect'?await inspect(account,payload?.consent):operation==='history'?await history(account,payload?.versionId):operation==='save'?await save(account,payload?.baselineId??'',payload?.previous??-1,payload?.draft,payload?.sourceVersion):null;
  return {data,error:null};
 }catch(error){unstable_rethrow(error);return {data:null,error:error instanceof Error?error.message:'Organizer unavailable'};}
}

export async function renameAction(account:string,operation:'history'|'preview'|'approve'|'execute'|'reconcile'|'restore',payload:{id?:string;fingerprint?:string;confirmed?:boolean}={}){
 try{
  const api=await import('@/lib/server/organizer/renaming');
  const data=operation==='history'?await api.renameHistory(account):operation==='preview'?await api.previewRename(account,payload.id??''):operation==='approve'?await api.approveRename(account,payload.id??'',payload.fingerprint??'',payload.confirmed===true):operation==='execute'?await api.executeRename(account,payload.id??''):operation==='reconcile'?await api.reconcileRename(account,payload.id??''):operation==='restore'?await api.restoreRename(account,payload.id??''):null;
  return {data,error:null};
 }catch(error){unstable_rethrow(error);console.error('Organizer operation failed',{operation,code:'ORGANIZER_OPERATION_FAILED'});return {data:null,error:error instanceof Error?error.message:'Organizer operation unavailable'};}
}
