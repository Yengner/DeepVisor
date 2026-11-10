import {NextRequest,NextResponse} from 'next/server';
import {unstable_rethrow} from 'next/navigation';
import {getRequiredAppContext} from '@/lib/server/actions/app/context';
import {resolveCurrentSelection} from '@/lib/server/actions/app/selection';
import {createAdminClient} from '@/lib/server/supabase/admin';
import {lifecycleEnabled} from '@/lib/server/lifecycle/service';
export async function POST(req:NextRequest,{params}:{params:Promise<{eventId:string}>}){
 if(!lifecycleEnabled())return new NextResponse(null,{status:404});
 if(req.headers.get('origin')!==req.nextUrl.origin)return new NextResponse(null,{status:403});
 try{const {eventId}=await params;if(!/^[0-9a-f-]{36}$/i.test(eventId))return new NextResponse(null,{status:400});const {businessId,user}=await getRequiredAppContext();const {selectedAdAccountId}=await resolveCurrentSelection(businessId);const db=createAdminClient();
 const e=await db.from('ad_lifecycle_events').select('id').eq('id',eventId).eq('business_id',businessId).eq('ad_account_id',selectedAdAccountId??'').maybeSingle();if(e.error)throw e.error;if(!e.data)return new NextResponse(null,{status:404});
 const saved=await db.from('ad_lifecycle_acknowledgements').insert({event_id:eventId,user_id:user.id});if(saved.error&&saved.error.code!=='23505')throw saved.error;return NextResponse.json({acknowledged:true});
 }catch(e){unstable_rethrow(e);return new NextResponse(null,{status:503});}
}
