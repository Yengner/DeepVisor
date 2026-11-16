/**
 * Browser event that opens the DeepVisor assistant with a pre-filled draft.
 * It never sends the question; the user reviews and submits it. An empty question only opens it.
 */
export const ASK_EVENT = "deepvisor:ask";
export type AskDetail = { question: string };
export function askDeepVisor(question: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AskDetail>(ASK_EVENT, { detail: { question } }));
}
/** Open the assistant without changing its draft (e.g. the phone top-bar button). */
export function openDeepVisor() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AskDetail>(ASK_EVENT, { detail: { question: "" } }));
}
