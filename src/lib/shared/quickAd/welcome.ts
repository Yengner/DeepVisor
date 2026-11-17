/**
 * Meta click-to-WhatsApp welcome setup (`page_welcome_message` in a creative's
 * object_story_spec). It decides what a client sees or taps first in WhatsApp:
 * - autofill_message: a message pre-filled in the client's text box;
 * - ice_breakers: buttons the client taps, each with an automatic reply.
 * Quick ad carries the source ad's setup over unchanged; this module only recognizes it and
 * produces a short summary for review. Pure: no I/O.
 */
export type WelcomeMessage = {
  /** The setup exactly as Meta stored it, passed through to the draft. */
  spec: string;
  kind: 'autofill' | 'ice_breakers';
  /** What the client sends or taps first. */
  clientMessage: string;
  /** Automatic reply for ice breakers, when set. */
  autoReply: string | null;
};

const MAX_SPEC_BYTES = 16_384;
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const rec = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null);

/** Finds `page_welcome_message` in an object_story_spec (link_data or video_data). */
export function welcomeSpecFromStory(objectStorySpec: unknown): string | null {
  const story = rec(objectStorySpec);
  const value = rec(story?.link_data)?.page_welcome_message ?? rec(story?.video_data)?.page_welcome_message;
  return typeof value === 'string' && value.length <= MAX_SPEC_BYTES ? value : null;
}

export function parseWelcomeMessage(spec: string | null): WelcomeMessage | null {
  if (!spec) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(spec); } catch { return null; }
  const format = rec(rec(parsed)?.text_format);
  const message = rec(format?.message);
  if (!format || !message) return null;
  if (format.customer_action_type === 'autofill_message') {
    const content = text(rec(message.autofill_message)?.content);
    return content ? { spec, kind: 'autofill', clientMessage: content, autoReply: null } : null;
  }
  if (format.customer_action_type === 'ice_breakers' && Array.isArray(message.ice_breakers)) {
    const first = rec(message.ice_breakers[0]);
    const title = text(first?.title);
    return title ? { spec, kind: 'ice_breakers', clientMessage: title, autoReply: text(first?.response) } : null;
  }
  return null;
}
