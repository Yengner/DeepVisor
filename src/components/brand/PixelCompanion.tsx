import SpiderMascot, { type SpiderMascotProps, type SpiderMascotState } from './SpiderMascot';

export type CompanionState = 'idle' | 'thinking' | 'analyzing' | 'planning' | 'completed' | 'attention';
const states: Record<CompanionState, SpiderMascotState> = {
  idle: 'idle', thinking: 'thinking', analyzing: 'scanning', planning: 'thinking', completed: 'success', attention: 'attention',
};
/** Compatibility for existing placements. Use SpiderMascot in new UI. */
export default function PixelCompanion({ state = 'idle', size = 28, ...props }: Omit<SpiderMascotProps, 'state'> & { state?: CompanionState }) {
  return <SpiderMascot {...props} size={size} state={states[state]} />;
}
