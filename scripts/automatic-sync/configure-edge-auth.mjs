import { createClient } from '@supabase/supabase-js';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const project='gkdyyjqepzayjdpvqnja';
if(process.env.DEEPVISOR_CONFIGURE_EDGE_AUTH!==project||process.env.NEXT_PUBLIC_SUPABASE_URL!==`https://${project}.supabase.co`)throw new Error('Explicit development project authorization required');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const secretId=process.env.DEEPVISOR_CRON_VAULT_SECRET_ID;
if(!/^[a-f0-9-]{36}$/.test(secretId??''))throw new Error('Vault secret ID required');
const secret=await client.rpc('get_platform_token',{secret_id:secretId});
if(secret.error||typeof secret.data!=='string'||!secret.data.trim())throw new Error('Unable to read designated Vault credential');
const dir=await mkdtemp(join(tmpdir(),'deepvisor-edge-auth-'));
try{
 const file=join(dir,'secrets.env');await writeFile(file,`CRON_SECRET=${JSON.stringify(secret.data)}\nSKIP_CRON_SECRET=false\n`,{mode:0o600});
 try{await promisify(execFile)('supabase',['secrets','set','--project-ref',project,'--env-file',file],{maxBuffer:256*1024});}
 catch{throw new Error('Edge secret update failed; secret contents suppressed');}
 console.log('Edge CRON_SECRET aligned with Vault; legacy skip flag disabled. No secret values logged.');
}finally{await rm(dir,{recursive:true,force:true});}
