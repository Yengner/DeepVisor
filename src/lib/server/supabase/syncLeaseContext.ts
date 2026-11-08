import 'server-only';
import { AsyncLocalStorage } from 'node:async_hooks';
/** Internal database fencing context. This never replaces row-level authorization. */
const leases = new AsyncLocalStorage<{jobId:string;generation:number}>();
export function withSyncLease<T>(jobId:string,generation:number,operation:()=>Promise<T>) { return leases.run({jobId,generation},operation); }
export function currentSyncLease() { return leases.getStore(); }
export function syncLeaseHeaders(): Record<string,string> {
  const lease=leases.getStore();
  return lease ? {'x-deepvisor-sync-job':lease.jobId,'x-deepvisor-sync-generation':String(lease.generation)} : {};
}
