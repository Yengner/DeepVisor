import type { DecisionProvider, DecisionProviderIdentity } from '../types';

/** Development fixture, not a calibrated advertising model or an execution policy. */
export class DeterministicDecisionProvider implements DecisionProvider {
  readonly identity: DecisionProviderIdentity = {
    providerId: 'deepvisor-mock', providerVersion: '1',
    modelId: 'deterministic-fixture', modelVersion: '1',
  };

  evaluate: DecisionProvider['evaluate'] = async (state) => {
    const sufficient = state.windows.recent7d.dataSufficiency.status === 'sufficient';
    const decision = !sufficient ? 'INSUFFICIENT_DATA'
      : state.creativeFatigue.elevatedFrequency === true ? 'REVIEW_CREATIVE' : 'HOLD';
    return {
      ...this.identity,
      decision,
      confidence: 1,
      probabilities: { [decision]: 1 },
      explanation: !sufficient ? 'Recent evidence is insufficient.'
        : decision === 'REVIEW_CREATIVE' ? 'Elevated frequency warrants creative review.'
          : 'The mock rules found no reason to change delivery.',
      evidence: {
        window: 'recent7d',
        sufficiency: state.windows.recent7d.dataSufficiency.status,
        elevatedFrequency: state.creativeFatigue.elevatedFrequency,
      },
      rawResponse: { mock: true, rule: decision },
    };
  };
}
