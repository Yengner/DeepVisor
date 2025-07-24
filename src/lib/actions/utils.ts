import { AdAccountMetrics, InsightEntry } from "../api/platforms/meta/types";




export const date = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });




export async function logProgress(supabase: any, jobId: string, step: string, status: string, metaObj?: any) {

    try {
        await supabase
            .from("campaign_job_progress")
            .insert({ job_id: jobId, step, status, meta: metaObj || {} });
    } catch (error) {
        console.warn(`Failed to log progress [${step} - ${status}]:`, (error as Error).message);
    }
}