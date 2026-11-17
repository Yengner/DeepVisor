import { describe, expect, it } from 'vitest';
import { parseWelcomeMessage, welcomeSpecFromStory } from './welcome';

// Shapes follow Meta's stored visual-editor v2 setup; text is synthetic.
const iceBreakers = JSON.stringify({
  type: 'VISUAL_EDITOR', version: 2, landing_screen_type: 'welcome_message',
  text_format: { customer_action_type: 'ice_breakers', message: {
    ice_breakers: [{ title: '¡Hola! Quiero agendar una cita.', response: 'Gracias por escribirnos. ¿Qué día te interesa?' }],
    quick_replies: [], text: '¡Hola! ¿En qué te ayudamos?',
  } },
});
const autofill = JSON.stringify({
  type: 'VISUAL_EDITOR', version: 2,
  text_format: { customer_action_type: 'autofill_message', message: { autofill_message: { content: 'Hello! Can I get more info on this?' }, text: 'Hi!' } },
});

describe('welcome message', () => {
  it('reads ice breakers and keeps the exact setup', () => {
    expect(parseWelcomeMessage(iceBreakers)).toEqual({
      spec: iceBreakers, kind: 'ice_breakers', clientMessage: '¡Hola! Quiero agendar una cita.', autoReply: 'Gracias por escribirnos. ¿Qué día te interesa?',
    });
  });

  it('reads a pre-filled message', () => {
    expect(parseWelcomeMessage(autofill)).toMatchObject({ kind: 'autofill', clientMessage: 'Hello! Can I get more info on this?', autoReply: null });
  });

  it('finds the setup in link or video ads and rejects anything unrecognized', () => {
    expect(welcomeSpecFromStory({ link_data: { page_welcome_message: autofill } })).toBe(autofill);
    expect(welcomeSpecFromStory({ video_data: { page_welcome_message: autofill } })).toBe(autofill);
    expect(welcomeSpecFromStory({ link_data: {} })).toBeNull();
    expect(welcomeSpecFromStory(null)).toBeNull();
    expect(welcomeSpecFromStory({ link_data: { page_welcome_message: 'x'.repeat(20_000) } })).toBeNull();
    expect(parseWelcomeMessage('not json')).toBeNull();
    expect(parseWelcomeMessage(JSON.stringify({ text_format: { customer_action_type: 'quick_replies', message: {} } }))).toBeNull();
    expect(parseWelcomeMessage(JSON.stringify({ text_format: { customer_action_type: 'ice_breakers', message: { ice_breakers: [{ title: ' ' }] } } }))).toBeNull();
  });
});
