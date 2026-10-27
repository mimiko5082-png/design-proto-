import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreviewCredentials, deployPreview } from '../preview/deploy.mjs';
const token = 'test-only-api-token_not-a-real-secret';
const account = '1234567890abcdef1234567890abcdef';
const environment = { GITHUB_REF:'refs/heads/codex-preview', GITHUB_REPOSITORY:'mimiko5082-png/design-proto-', CLOUDFLARE_API_TOKEN:token, CLOUDFLARE_ACCOUNT_ID:account };
test('credential edge whitespace is removed without changing the token body', () => {
 const result=normalizePreviewCredentials({...environment,CLOUDFLARE_API_TOKEN:' \r\n'+token+'\r\n ',CLOUDFLARE_ACCOUNT_ID:'\n'+account+'\t'});
 assert.equal(result.CLOUDFLARE_API_TOKEN,token);assert.equal(result.CLOUDFLARE_ACCOUNT_ID,account);
});
test('invalid credential errors never echo the input, and stop before Wrangler',()=>{
 for(const bad of [token+'\nWRONG_VALUE', '使用例'+token, 'CLOUDFLARE_API_TOKEN="'+token+'\nWRONG_VALUE"', 'CLOUDFLARE_API_TOKEN="'+token+'"\nCLOUDFLARE_API_TOKEN="another-token"', 'CLOUDFLARE_API_TOKEN=$(do-not-execute)']){
  let called=false;
  assert.throws(()=>deployPreview({environment:{...environment,CLOUDFLARE_API_TOKEN:bad},spawn(){called=true;}}),error=>error.message.includes('CLOUDFLARE_PREVIEW_API_TOKEN')&&!error.message.includes(token)&&!error.message.includes(bad));
  assert.equal(called,false);
 }
});
test('wrong Account IDs are rejected without printing the value',()=>{
 for(const bad of ['https://account.example.test','CLOUDFLARE_ACCOUNT_ID='+account,account+'\nEXTRA']) {
  assert.throws(()=>normalizePreviewCredentials({...environment,CLOUDFLARE_ACCOUNT_ID:bad}),error=>error.message.includes('CLOUDFLARE_PREVIEW_ACCOUNT_ID')&&!error.message.includes(bad));
 }
});
test('only the preview branch can deploy and credentials stay out of arguments',()=>{
 let called=0;
 assert.throws(()=>deployPreview({environment:{...environment,GITHUB_REF:'refs/heads/main'},spawn(){called++;}}));
 assert.equal(called,0);
 const exit=deployPreview({environment:{...environment,CLOUDFLARE_API_TOKEN:'\n'+token+'\n'},spawn(command,args,options){
  called++;assert.equal(command,'npx');assert.deepEqual(args,['--yes','wrangler@4.151.0','deploy','--config','preview/wrangler.jsonc']);
  assert.ok(!args.join(' ').includes(token));assert.equal(options.env.CLOUDFLARE_API_TOKEN,token);assert.equal(options.shell,false);
  return {status:0};
 }});
 assert.equal(exit,0);assert.equal(called,1);
});
test('failed deployments keep their failure exit code',()=>{
 assert.equal(deployPreview({environment,spawn:()=>({status:7})}),7);
});


test('known quotation, header and usage formats yield only the token, without executing pasted code',()=>{
 const forms=[
  '"'+token+'"', "'"+token+"'", 'Bearer '+token, 'Authorization: Bearer '+token,
  'export CLOUDFLARE_API_TOKEN="'+token+'"\nnpx wrangler deploy',
  'CLOUDFLARE_ACCOUNT_ID="'+account+'" \\\nCLOUDFLARE_API_TOKEN="'+token+'" \\\nnpx wrangler deploy',
 ];
 for(const form of forms){
  let calls=0;
  assert.equal(deployPreview({environment:{...environment,CLOUDFLARE_API_TOKEN:form},spawn(command,args,options){
   calls++;assert.equal(command,'npx');assert.equal(options.env.CLOUDFLARE_API_TOKEN,token);
   assert.deepEqual(args,['--yes','wrangler@4.151.0','deploy','--config','preview/wrangler.jsonc']);
   assert.equal(options.shell,false);return {status:0};
  }}),0);
  assert.equal(calls,1);
 }
});
