import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { fetchMetaObject,fetchMetaCollection } from './client';
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});
it('applies a bounded request deadline to normal Graph requests',async()=>{
 const transport=vi.fn().mockResolvedValue(new Response(JSON.stringify({id:'example'})));
 vi.stubGlobal('fetch',transport);
 expect(await fetchMetaObject({path:'example',accessToken:'test-only'})).toEqual({id:'example'});
 expect(transport.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
});
it('retries a transient provider error then follows pagination',async()=>{
 vi.useFakeTimers();
 const transport=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({error:{message:'rate limit'}}),{status:429}))
 .mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:1}],paging:{next:'https://graph.facebook.com/v24.0/example?page=2'}})))
 .mockResolvedValueOnce(new Response(JSON.stringify({data:[{id:2}]})));
 vi.stubGlobal('fetch',transport);
 const pending=fetchMetaCollection({path:'example',accessToken:'test-only'});
 await vi.runAllTimersAsync();expect(await pending).toEqual([{id:1},{id:2}]);expect(transport).toHaveBeenCalledTimes(3);
});
it('does not retry permission failures',async()=>{
 const transport=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'Missing permissions'}}),{status:403}));
 vi.stubGlobal('fetch',transport);
 await expect(fetchMetaObject({path:'example',accessToken:'test-only'})).rejects.toThrow('Missing permissions');
 expect(transport).toHaveBeenCalledTimes(1);
});
