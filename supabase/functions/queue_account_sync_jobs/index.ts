import { serve } from "https://deno.land/std/http/server.ts";
import { handleQueueAccountSyncJobsRequest } from "../_shared/queueAccountSyncJobs.ts";

serve((req) => handleQueueAccountSyncJobsRequest(req, "queue_account_sync_jobs"));
