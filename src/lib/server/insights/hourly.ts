import 'server-only';
import {createAdminClient} from '@/lib/server/supabase/admin';
import {readAllPages} from '@/lib/server/repositories/pagination';
import {summarizeHours} from '@/lib/shared/insights/hourly';
import type {HourlyRecap} from '@/lib/shared/insights/model';
export async function loadHourlyRecap(business:string,account:string,day:string,currency:string|null):Promise<HourlyRecap>{
 const client=createAdminClient();
 // The legacy hourly view has account scope, but no business column.
 const owner=await client.from('ad_accounts').select('id').eq('business_id',business).eq('id',account).maybeSingle();
 if(owner.error||!owner.data)throw new Error('Hourly account scope unavailable');
 try{
  const rows=await readAllPages((from,to)=>client.from('meta_hourly_performance').select('day,hour_of_day,spend,leads,messages,calls,currency_code').eq('ad_account_id',account).eq('entity_level','adset').eq('time_basis','advertiser').eq('day',day).order('hour_of_day').order('entity_id').range(from,to),{nullDataError:'Hourly observations unavailable'});
  return summarizeHours(rows,day,currency);
 }catch{return {...summarizeHours([],day,currency),status:'error'};}
}
