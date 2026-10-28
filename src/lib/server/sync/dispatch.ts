import 'server-only';
import { after } from 'next/server';
import { revalidatePath, revalidateTag } from 'next/cache';
import { processMetaBackfillJobs } from './meta/processBackfillJobs';

/** Existing durable worker; after() keeps the authenticated response nonblocking. */
export function dispatchAccountSync(jobId: string, businessId: string) {
  after(async () => {
    try {
      await processMetaBackfillJobs({ targetJobId: jobId });
      revalidateTag(`dashboard-context:${businessId}`, { expire: 0 });
      revalidatePath('/dashboard');
    } catch { console.error('Meta refresh worker unavailable', { jobId }); }
  });
}
