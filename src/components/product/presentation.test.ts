import { describe, expect, it } from 'vitest';
import { meaningfulConfidence, monitoringSummary, ownerMessages, statusPresentation } from './presentation';
describe('owner-facing presentation',()=>{
  it('uses the same approval wording and never equates approval with execution',()=>{
    expect(statusPresentation('Needs approval')).toEqual(statusPresentation('Approval required'));
    expect(statusPresentation('Approved - not executed')).toEqual({label:'Approved · Not executed',tone:'information'});
    expect(statusPresentation('Executed').tone).toBe('positive');
  });
  it('keeps delivery separate from health and treats paused/off as neutral',()=>{
    expect(statusPresentation('ACTIVE')).toEqual({label:'Active',tone:'information'});
    expect(statusPresentation('Healthy').tone).toBe('positive');
    for(const status of ['Paused','PAUSED','OFF','Insufficient data'])expect(statusPresentation(status).tone).toBe('neutral');
    expect(statusPresentation(null).label).toBe('Unavailable');
  });
  it.each(['Blocked','Needs reconciliation','Execution failed'])('makes %s visibly require checking',status=>{
    expect(statusPresentation(status).tone).toBe('problem');
  });
  it('suppresses sample confidence and invalid probabilities',()=>{
    expect(meaningfulConfidence('Sample evaluation',0.99,0.8)).toBeNull();
    expect(meaningfulConfidence('DeepVisor evaluation',null,0.8)).toBe(0.8);
    expect(meaningfulConfidence('DeepVisor evaluation',1.4,0.8)).toBeNull();
    expect(meaningfulConfidence('DeepVisor evaluation',NaN,null)).toBeNull();
  });
  it('states only recorded monitoring evidence, never scheduler liveness',()=>{
    expect(monitoringSummary(0,0)).toContain('No completed evaluations recorded');
    expect(monitoringSummary(3,2)).toBe('2 evaluations recommended no change today.');
    expect(monitoringSummary(1,2)).toContain('unavailable');
    expect(monitoringSummary(0,0)).not.toMatch(/still monitoring|unchanged|healthy/i);
  });
  it('keeps user errors independent of raw service messages and avoids retry guarantees',()=>{
    for(const text of Object.values(ownerMessages))expect(text).not.toMatch(/supabase|jev|stack|will retry|ads are unchanged/i);
    expect(ownerMessages.review).toContain('check its latest status');
  });
});
