import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminClient } from '@/lib/server/supabase/admin';
import { JevDecisionProvider } from '@/lib/server/decisions/providers/JevDecisionProvider';
import { limitedAutoEnabled, runLimitedAuto } from '@/lib/server/advertising/limitedAuto';
import { POST } from './route';

vi.mock('server-only',()=>({}));
vi.mock('@/lib/server/supabase/admin',()=>({createAdminClient:vi.fn()}));
vi.mock('@/lib/server/decisions/providers/JevDecisionProvider',()=>({JevDecisionProvider:vi.fn(class {})}));
vi.mock('@/lib/server/advertising/limitedAuto',()=>({limitedAutoEnabled:vi.fn(),runLimitedAuto:vi.fn()}));
const body={businessId:'00000000-0000-4000-8000-000000000001',sourceSnapshotId:'00000000-0000-4000-8000-000000000002'};
const request=(authorized=true,payload:unknown=body)=>new NextRequest('https://deepvisor.test/api/internal/decisions/limited-auto',{method:'POST',headers:authorized?{authorization:'Bearer internal-test'}:{},body:JSON.stringify(payload)});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('INTERNAL_API_KEY','internal-test');vi.mocked(limitedAutoEnabled).mockReturnValue(true);vi.spyOn(console,'info').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{});});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
describe('limited auto internal endpoint',()=>{
  it('requires internal authentication',async()=>{expect((await POST(request(false))).status).toBe(401);expect(runLimitedAuto).not.toHaveBeenCalled();});
  it('requires configured authentication',async()=>{vi.stubEnv('INTERNAL_API_KEY','');expect((await POST(request())).status).toBe(401);});
  it('rejects arbitrary action input',async()=>{expect((await POST(request(true,{...body,targetBudgetMinor:999999}))).status).toBe(400);expect(runLimitedAuto).not.toHaveBeenCalled();});
  it('does not construct a provider or client while disabled',async()=>{vi.mocked(limitedAutoEnabled).mockReturnValue(false);expect(await (await POST(request())).json()).toMatchObject({outcome:'BLOCK'});expect(createAdminClient).not.toHaveBeenCalled();expect(JevDecisionProvider).not.toHaveBeenCalled();});
  it('holds on missing provider configuration without fallback',async()=>{vi.mocked(JevDecisionProvider).mockImplementationOnce(function(){throw new Error('missing config');});expect(await (await POST(request())).json()).toEqual({outcome:'HOLD',reason:'PROVIDER_UNAVAILABLE'});expect(runLimitedAuto).not.toHaveBeenCalled();});
  it('uses the persisted snapshot pipeline only',async()=>{vi.mocked(runLimitedAuto).mockResolvedValueOnce({outcome:'HOLD',reason:'HOLD'});expect((await POST(request())).status).toBe(200);expect(runLimitedAuto).toHaveBeenCalledWith(undefined,expect.objectContaining(body));});
  it('does not retry uncertain failures or expose raw errors',async()=>{vi.mocked(runLimitedAuto).mockRejectedValueOnce(new Error('private token'));const result=await POST(request());expect(result.status).toBe(503);expect(await result.text()).not.toContain('private token');expect(runLimitedAuto).toHaveBeenCalledOnce();});
});
