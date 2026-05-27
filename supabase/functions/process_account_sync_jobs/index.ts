import { serve } from "https://deno.land/std/http/server.ts";
import { handleProcessAccountSyncJobsRequest } from "../_shared/processAccountSyncJobs.ts";

serve((req) => handleProcessAccountSyncJobsRequest(req, "process_account_sync_jobs"));
