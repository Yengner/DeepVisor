/**
 * Agency Control (autonomous decisions, review queue, `/agency` and `/decisions`) is hidden for the
 * beta: owners create and change ads by hand, and "Ask DeepVisor" only reads data and prepares
 * paused drafts. Set the server-only `DEEPVISOR_AGENCY=true` to bring the pages, navigation and
 * decision panels back. Hiding never deletes data or changes the decision pipeline itself.
 */
export const agencyEnabled = () => process.env.DEEPVISOR_AGENCY === 'true';
