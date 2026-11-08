'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { emptyAssistantState, type AssistantState, type AssistantPlan } from '@/lib/shared/assistant/contracts';
export function useAssistantConversation(accountId: string | null | undefined) {
    const [state, setState] = useState<AssistantState>(emptyAssistantState);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ready, setReady] = useState(false);
    const [configured, setConfigured] = useState(false);
    const [currency, setCurrency] = useState<string | null>(null);
    const [timezone, setTimezone] = useState<string | null>(null);
    const abort = useRef<AbortController | null>(null);
    const active = useRef(false);
    const reload = useCallback(async () => {
        abort.current?.abort();
        const controller = new AbortController();
        abort.current = controller;
        setReady(false);
        setError(null);
        if (!accountId)
            return;
        try {
            const response = await fetch('/api/intelligence/assistant', { signal: controller.signal, cache: 'no-store' });
            const body = await response.json();
            if (!response.ok || !body.success)
                throw new Error(body.error || 'Conversation unavailable.');
            if (body.accountId !== accountId)
                throw new Error('Account selection changed. Reload the page.');
            if (controller.signal.aborted)
                return;
            setState(body.state);
            setConfigured(body.configured);
            setCurrency(body.currency);
            setTimezone(body.timezone);
            setReady(true);
        }
        catch (e) {
            if (!controller.signal.aborted)
                setError(e instanceof Error ? e.message : 'Conversation unavailable.');
        }
    }, [accountId]);
    useEffect(() => { setState(emptyAssistantState()); setBusy(false); active.current = false; void reload(); return () => abort.current?.abort(); }, [reload]);
    async function request(body: Record<string, unknown>) {
        if (active.current || !ready || !accountId)
            return false;
        active.current = true;
        setBusy(true);
        setError(null);
        const controller = new AbortController();
        abort.current = controller;
        try {
            const response = await fetch('/api/intelligence/assistant', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, adAccountId: accountId, revision: state.revision }) });
            const result = await response.json();
            if (!response.ok || !result.success)
                throw new Error(result.error || 'Request unavailable.');
            if (!controller.signal.aborted)
                setState(result.state);
            return !controller.signal.aborted;
        }
        catch (e) {
            if (!controller.signal.aborted)
                setError(e instanceof Error ? e.message : 'Request unavailable.');
            return false;
        }
        finally {
            if (!controller.signal.aborted) {
                active.current = false;
                setBusy(false);
            }
        }
    }
    async function upload(file: File) {
        if (active.current || !ready || !accountId)
            return false;
        active.current = true;
        setBusy(true);
        setError(null);
        const controller = new AbortController();
        abort.current = controller;
        const form = new FormData();
        form.set('file', file);
        form.set('adAccountId', accountId);
        form.set('revision', String(state.revision));
        try {
            const response = await fetch('/api/intelligence/assistant/media', { method: 'POST', body: form, signal: controller.signal });
            const result = await response.json();
            if (!response.ok || !result.success)
                throw new Error(result.error || 'Upload unavailable.');
            if (!controller.signal.aborted)
                setState(result.state);
            return !controller.signal.aborted;
        }
        catch (e) {
            if (!controller.signal.aborted)
                setError(e instanceof Error ? e.message : 'Upload unavailable.');
            return false;
        }
        finally {
            if (!controller.signal.aborted) {
                active.current = false;
                setBusy(false);
            }
        }
    }
    return { state, busy, error, ready, configured, currency, timezone, reload, upload,
        ask: (question: string) => { const params = new URLSearchParams(window.location.search); const period = params.get('period'); const platform = params.get('publisher'); return request({ action: 'message', question, context: { period: period === '7d' || period === '30d' ? period : 'today', platform: platform === 'facebook' || platform === 'instagram' ? platform : 'combined' } }); },
        save: (plan: AssistantPlan) => request({ action: 'save', plan, confirmed: true }),
        modify: (plan: AssistantPlan) => request({ action: 'modify', plan }),
        clear: () => request({ action: 'clear' }),
    };
}
