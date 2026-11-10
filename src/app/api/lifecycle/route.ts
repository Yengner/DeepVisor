import {NextRequest,NextResponse} from 'next/server';
import {unstable_rethrow} from 'next/navigation';
import {getRequiredAppContext} from '@/lib/server/actions/app/context';
import {resolveCurrentSelection} from '@/lib/server/actions/app/selection';
import {createAdminClient} from '@/lib/server/supabase/admin';
import {lifecycleEnabled} from '@/lib/server/lifecycle/service';
import {lifecycleBrief} from '@/lib/server/lifecycle/brief';
export async function GET(req:NextRequest){
 if(!lifecycleEnabled())return NextResponse.json({events:[]});
 try{
 const {businessId,user}=await getRequiredAppContext();const {selectedAdAccountId:account}=await resolveCurrentSelection(businessId);
 if(!account)return NextResponse.json({events:[]});
 const db=createAdminClient(),id=req.nextUrl.searchParams.get('id');
 if(id){if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid event'},{status:400});const brief=await lifecycleBrief(businessId,account,id,false,true);return NextResponse.json(brief??{error:'Not found'},{status:brief?200:404,headers:{'Cache-Control':'private, no-store'}});}
 const events=await db.from('ad_lifecycle_events').select('id,explanation,created_at').eq('business_id',businessId).eq('ad_account_id',account).order('created_at',{ascending:false}).limit(30);
 if(events.error)throw events.error;
 const ack=await db.from('ad_lifecycle_acknowledgements').select('event_id').eq('user_id',user.id).in('event_id',events.data.map(e=>e.id));if(ack.error)throw ack.error;
 return NextResponse.json({events:events.data.filter(e=>!ack.data.some(a=>a.event_id===e.id))},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){unstable_rethrow(e);return NextResponse.json({error:'Lifecycle details unavailable'},{status:503});}
}
