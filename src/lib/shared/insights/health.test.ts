import {describe,expect,it} from 'vitest';
import {accountCause,accountHealthIssues,causeFromCode} from './health';

describe('account health causes', () => {
 it('names billing only from Meta billing statuses', () => {
  expect(accountCause(3)).toBe('billing');
  expect(accountCause(8)).toBe('billing-pending');
  expect(accountCause(9)).toBe('billing-pending');
  expect(accountCause(2,3)).toBe('payment-risk');
  expect(accountHealthIssues({account_status:3})![0]).toMatchObject({title:'Meta reports an unpaid balance',code:'ACCOUNT_STATUS_3'});
 });
 it('maps disabled reasons to policy, review, compromise or closure', () => {
  expect(accountCause(2,1)).toBe('policy');
  expect(accountCause(2,11)).toBe('policy');
  expect(accountCause(2,2)).toBe('review');
  expect(accountCause(7)).toBe('review');
  expect(accountCause(2,15)).toBe('compromised');
  expect(accountCause(101)).toBe('closed');
  expect(accountCause(2,7)).toBe('closed');
 });
 it('keeps an unrecognized disable reason generic and an unknown status silent', () => {
  expect(accountCause(2)).toBe('unavailable');
  expect(accountCause(2,99)).toBe('unavailable');
  expect(accountCause(2,4)).toBe('unavailable');
  expect(accountHealthIssues({account_status:2,disable_reason:4})![0].explanation).not.toMatch(/payment|policy/i);
  expect(accountHealthIssues({account_status:42})).toBeNull();
  expect(accountHealthIssues({})).toBeNull();
 });
 it('reads the cause back from a saved code', () => {
  expect(causeFromCode('ACCOUNT_STATUS_2_REASON_3')).toBe('payment-risk');
  expect(causeFromCode('ACCOUNT_STATUS_9')).toBe('billing-pending');
  expect(causeFromCode('DISAPPROVED')).toBeNull();
 });
});

describe('Meta account links', () => {
 it('targets the ad account in Meta links and leaves others alone', async () => {
  const {metaAccountLink}=await import('./health');
  expect(accountHealthIssues({account_status:3},'act_123456')![0].href).toBe('https://business.facebook.com/billing_hub/payment_settings?asset_id=123456');
  expect(accountHealthIssues({account_status:2,disable_reason:1},'987')![0].href).toBe('https://business.facebook.com/accountquality?asset_id=987');
  expect(accountHealthIssues({account_status:101},'987')![0].href).toBe('/integration');
  expect(metaAccountLink('https://business.facebook.com/billing_hub/payment_settings','act_12a')).toBe('https://business.facebook.com/billing_hub/payment_settings');
  expect(metaAccountLink('https://business.facebook.com/billing_hub/payment_settings',null)).toBe('https://business.facebook.com/billing_hub/payment_settings');
  expect(metaAccountLink('https://evil.example.com/x','123')).toBe('https://evil.example.com/x');
 });
});
