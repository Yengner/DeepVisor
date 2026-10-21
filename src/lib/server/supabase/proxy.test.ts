import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({user:null as null|{id:string},refresh:false}));
vi.mock('@supabase/ssr',()=>({createServerClient:(_url:string,_key:string,options:{cookies:{setAll:(rows:unknown[])=>void}})=>({auth:{getUser:async()=>{
 if(m.refresh)options.cookies.setAll([{name:'session',value:'refreshed',options:{httpOnly:true,path:'/'}}]);
 return {data:{user:m.user},error:m.user?null:{message:'Session expired'}};
}}})}));
import { updateSession } from './proxy';
beforeEach(()=>{m.user=null;m.refresh=false;});
it.each(['/dashboard','/onboarding','/campaigns','/decisions'])('redirects missing or expired sessions from %s',async path=>{
 const response=await updateSession(new NextRequest(`http://localhost${path}`));
 expect(response.headers.get('location')).toBe('http://localhost/login');
});
it('preserves refreshed cookies on authenticated redirects',async()=>{
 m.user={id:'a'};m.refresh=true;
 const response=await updateSession(new NextRequest('http://localhost/login'));
 expect(response.headers.get('location')).toBe('http://localhost/api/auth/redirect');
 expect(response.cookies.get('session')?.value).toBe('refreshed');
});
it('allows authenticated protected navigation and public logged-out pages',async()=>{
 m.user={id:'a'};
 expect((await updateSession(new NextRequest('http://localhost/dashboard'))).headers.get('location')).toBeNull();
 m.user=null;
 expect((await updateSession(new NextRequest('http://localhost/features'))).headers.get('location')).toBeNull();
});
