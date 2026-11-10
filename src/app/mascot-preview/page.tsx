import {notFound} from 'next/navigation';
import SpiderDesignReview from '@/components/brand/SpiderDesignReview';
export default function MascotPreviewPage(){
 if(process.env.NODE_ENV!=='development')notFound();
 return <SpiderDesignReview/>;
}
