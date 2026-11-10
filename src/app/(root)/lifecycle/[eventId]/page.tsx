import {notFound} from 'next/navigation';
import {LifecycleReport} from '@/components/lifecycle/LifecycleView';
import {lifecycleEnabled} from '@/lib/server/lifecycle/service';
export default async function Page({params}:{params:Promise<{eventId:string}>}){if(!lifecycleEnabled())notFound();const {eventId}=await params;return <section style={{maxWidth:900,margin:'auto',padding:24}}><LifecycleReport id={eventId}/></section>;}
