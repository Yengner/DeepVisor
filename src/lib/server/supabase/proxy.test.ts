import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only',()=>({}));
const m=vi.hoisted(()=>({user:null as null|{id:string},refresh:false,locale:null as string|null,localeError:false,queries:0}));
vi.mock('@supabase/ssr',()=>({createServerClient:(_url:string,_key:string,options:{cookies:{setAll:(rows:unknown[])=>void}})=>({auth:{getUser:async()=>{
 if(m.refresh)options.cookies.setAll([{name:'session',value:'refreshed',options:{httpOnly:true,path:'/'}}]);
 return {data:{user:m.user},error:m.user?null:{message:'Session expired'}};
}},from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>{m.queries++;return m.localeError?{data:null,error:{message:'down'}}:{data:{preferred_locale:m.locale},error:null};}})})})})}));
import { updateSession } from './proxy';
beforeEach(()=>{m.user=null;m.refresh=false;m.locale=null;m.localeError=false;m.queries=0;});
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

it('syncs the signed-in user\'s saved language into the locale cookie once per user',async()=>{
 m.user={id:'a'};m.locale='es';
 const first=await updateSession(new NextRequest('http://localhost/dashboard'));
 expect(first.cookies.get('dv_locale')?.value).toBe('es');
 expect(first.cookies.get('dv_locale_user')?.value).toBe('a');
 const synced=new NextRequest('http://localhost/dashboard',{headers:{cookie:'dv_locale=es; dv_locale_user=a'}});
 expect((await updateSession(synced)).cookies.get('dv_locale')).toBeUndefined();
 expect(m.queries).toBe(1);
 m.user={id:'b'};m.locale=null;
 const other=await updateSession(new NextRequest('http://localhost/dashboard',{headers:{cookie:'dv_locale=es; dv_locale_user=a'}}));
 expect(other.cookies.get('dv_locale')?.value).toBe('auto');
 expect(other.cookies.get('dv_locale_user')?.value).toBe('b');
});
it('leaves the language unset when the preference cannot be read, without affecting navigation',async()=>{
 m.user={id:'a'};m.localeError=true;
 const response=await updateSession(new NextRequest('http://localhost/dashboard'));
 expect(response.headers.get('location')).toBeNull();
 expect(response.cookies.get('dv_locale')).toBeUndefined();
});
