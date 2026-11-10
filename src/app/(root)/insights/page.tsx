import { notFound } from 'next/navigation';
import { insightsEnabled } from '@/lib/server/insights/issues';
import { InsightsHistory } from '@/components/insights/InsightsView';
export default function InsightsPage(){if(!insightsEnabled())notFound();return <InsightsHistory/>;}
