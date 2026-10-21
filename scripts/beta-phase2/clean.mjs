import { readFile,unlink } from 'node:fs/promises';
import { adminClient,statePath,tag } from './state.mjs';
const admin=adminClient();
let data;
try {data=JSON.parse(await readFile(statePath,'utf8'));}
catch(error) {if(error.code!=='ENOENT')throw error;console.log('No Phase 2 fixture manifest; nothing to clean.');process.exit(0);}
// All identities must match the private manifest and server-managed designation before any delete.
const scopes=[];
for(const user of data.users) {
  if(!user.id)continue;
  const {data:found,error}=await admin.auth.admin.getUserById(user.id);
  if(error?.code==='user_not_found')continue;
  if(error)throw error;
  if(found.user.email!==user.email || !found.user.app_metadata[tag])throw new Error('Refusing cleanup of an undesignated identity');
  const members=await admin.from('organization_memberships').select('organization_id').eq('user_id',user.id);if(members.error)throw members.error;
  // A prior cleanup may have removed the organization before Auth deletion completed.
  if(members.data.length===0) {scopes.push({user,org:null,business:null});continue;}
  if(members.data.length!==1)throw new Error('Unexpected workspace scope');
  const org=members.data[0].organization_id;
  const others=await admin.from('organization_memberships').select('user_id').eq('organization_id',org);if(others.error)throw others.error;
  if(others.data.some(m=>m.user_id!==user.id))throw new Error('Synthetic workspace has additional members');
  const businesses=await admin.from('business_profiles').select('id,business_name').eq('organization_id',org);if(businesses.error)throw businesses.error;
  if(businesses.data.length!==1 || !businesses.data[0].business_name.startsWith('[SIMULATED] Phase 2 Salon'))throw new Error('Unexpected business scope');
  const business=businesses.data[0].id;
  for(const table of ['action_proposals','executed_actions','action_outcomes','autonomy_policies']) {
    const rows=await admin.schema('ai').from(table).select('id').eq('business_id',business).limit(1);
    if(rows.error)throw rows.error;if(rows.data.length)throw new Error('Refusing to delete decision/action history or policy');
  }
  const integrations=await admin.from('platform_integrations').select('integration_details,access_token_secret_id,refresh_token_secret_id').eq('business_id',business);
  if(integrations.error)throw integrations.error;
  if(integrations.data.some(i=>!i.integration_details?.[tag]||i.access_token_secret_id||i.refresh_token_secret_id))throw new Error('Unexpected credentials or integration');
  scopes.push({user,org,business});
}
for(const {user,org,business} of scopes) {
 if(org && business) {
  const jobs=await admin.from('account_sync_jobs').delete().eq('business_id',business);if(jobs.error)throw jobs.error;
  const features=await admin.schema('ai').from('creative_feature_snapshots').delete().eq('business_id',business);if(features.error)throw features.error;
  const removed=await admin.from('organizations').delete().eq('id',org);if(removed.error)throw removed.error;
 }
  const deleted=await admin.auth.admin.deleteUser(user.id);if(deleted.error)throw deleted.error;
}
await unlink(statePath);
console.log(JSON.stringify({cleaned:scopes.length,scope:tag}));
