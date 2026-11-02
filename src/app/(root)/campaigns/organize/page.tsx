import Link from 'next/link';
import DesignSurface from '@/components/design/DesignSurface';
import { loadOverviewContext } from '@/lib/server/dashboard/overview/load';
import Organizer from './Organizer';
export const maxDuration=180;
export const metadata={title:'Organize Account | DeepVisor'};
export default async function Page(){
 const context=await loadOverviewContext();
 return <DesignSurface label="DeepVisor · Account organizer">{context.account?<Organizer key={context.account.id} accountId={context.account.id} accountName={context.account.name??'Meta account'}/>:<p>Select a Meta account in <Link href="/integration">Connections</Link>.</p>}</DesignSurface>;
}
