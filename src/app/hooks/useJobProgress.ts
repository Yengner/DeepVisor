"use client";
import { createClient } from "@/lib/utils/supabase/clients/browser";
import { useEffect, useState } from "react";

export type Job = {
    id: string;
    user_id: string;
    type: string;
    status: "queued" | "running" | "done" | "error" | "canceled";
    step: string | null;
    percent: number | null;
    error: string | null;
    meta: any;
    created_at: string;
    updated_at: string;
};

export type JobEvent = {
    id: string;
    job_id: string;
    step: string;
    status: "loading" | "success" | "error";
    percent: number | null;
    message: string | null;
    meta: any;
    created_at: string;
};

export function useJobProgress(jobId: string) {
    const [job, setJob] = useState<Job | null>(null);
    const [events, setEvents] = useState<JobEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const supabase = createClient();

    useEffect(() => {
        let mounted = true;

        (async () => {
            // initial load
            const { data: jobData } = await supabase
                .from("jobs")
                .select("*")
                .eq("id", jobId)
                .single();

            const { data: evData } = await supabase
                .from("job_progress")
                .select("*")
                .eq("job_id", jobId)
                .order("created_at", { ascending: true });

            if (!mounted) return;
            setJob(jobData as Job);
            setEvents((evData || []) as JobEvent[]);
            setLoading(false);
        })();

        // realtime: job row updates
        const ch1 = supabase
            .channel(`jobs-${jobId}`)
            .on("postgres_changes",
                { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
                (payload) => setJob(payload.new as Job)
            )
            .subscribe();

        // realtime: new progress events
        const ch2 = supabase
            .channel(`job-progress-${jobId}`)
            .on("postgres_changes",
                { event: "INSERT", schema: "public", table: "job_progress", filter: `job_id=eq.${jobId}` },
                (payload) => setEvents((prev) => [...prev, payload.new as JobEvent])
            )
            .subscribe();

        return () => {
            mounted = false;
            supabase.removeChannel(ch1);
            supabase.removeChannel(ch2);
        };
    }, [jobId]);

    return { job, events, loading };
}
