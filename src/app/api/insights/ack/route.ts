import { NextRequest,NextResponse } from 'next/server';
import { unstable_rethrow } from 'next/navigation';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { insightsScope,uuid } from '@/lib/server/insights/http';
export async function POST(req:NextRequest){
 if(req.headers.get('origin')!==req.nextUrl.origin)return NextResponse.json({error:'Forbidden'},{status:403});
 const b=await req.json().catch(()=>null);if(!b||!uuid.test(b.id??'')||!uuid.test(b.token??''))return NextResponse.json({error:'Invalid request'},{status:400});
 try{const s=await insightsScope();if(!s)return NextResponse.json({error:'Not found'},{status:404});
 const r=await createAdminClient().rpc('acknowledge_insights',{p_account:s.account,p_user:s.user,p_id:b.id,p_token:b.token});
 if(r.error||!r.data)return NextResponse.json({error:'This update is no longer claimed by this tab. Reopen it from history.'},{status:409});
 return NextResponse.json({ok:true});
 }catch(e){unstable_rethrow(e);return NextResponse.json({error:'Unable to save review'},{status:503});}
}
