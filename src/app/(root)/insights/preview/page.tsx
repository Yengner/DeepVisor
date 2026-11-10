import {notFound} from 'next/navigation';
import InsightsPreview from '@/components/insights/InsightsPreview';
import {getRequiredAppContext} from '@/lib/server/actions/app/context';
export default async function PreviewPage(){
 if(process.env.NODE_ENV!=='development')notFound();
 await getRequiredAppContext();
 return <InsightsPreview/>;
}
