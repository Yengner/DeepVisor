import 'server-only';
import { getRequiredAppContext } from '@/lib/server/actions/app/context';
import { resolveCurrentSelection } from '@/lib/server/actions/app/selection';
import { insightsEnabled } from './issues';
import type { Scope } from './service';
export const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function insightsScope():Promise<Scope|null>{
 if(!insightsEnabled())return null;
 const {businessId,user}=await getRequiredAppContext();
 const selected=await resolveCurrentSelection(businessId);
 return selected.selectedAdAccountId?{business:businessId,user:user.id,account:selected.selectedAdAccountId,integration:selected.selectedPlatformId}:null;
}
