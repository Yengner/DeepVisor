/**
 * Browser event that opens the DeepVisor assistant with a pre-filled draft.
 * It never sends the question; the user reviews and submits it.
 */
export const ASK_EVENT = "deepvisor:ask";
export type AskDetail = { question: string };
export function askDeepVisor(question: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AskDetail>(ASK_EVENT, { detail: { question } }));
}
