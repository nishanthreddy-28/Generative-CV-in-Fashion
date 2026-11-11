import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {registrationBinding,registrationLink,registrationOrigin,validBinding,registrationRequest,registrationStatus,resendRegistration} from '../src/services/auth/registration.ts';
import {resolveCustomerAccess} from '../src/services/auth/customerAccess.ts';
import {patchPayload} from '../src/features/validation.ts';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;});
const binding={attemptId:'12345678-1234-4234-8234-123456789abc',capability:'a'.repeat(43)};
test('start and resend response copy is excluded from the binding sent to verification',()=>{
 assert.deepEqual(registrationBinding({...binding,message:'Check your inbox'}),binding);
 assert.equal(registrationBinding({...binding,capability:'short'}),null);
});
test('independent link stays in fragment and original attempt binding is validated',()=>{
 assert.ok(validBinding(binding));assert.ok(!validBinding({...binding,capability:'short'}));
 const url='https://fashion.example/verify-registration#attempt='+binding.attemptId+'&link='+'b'.repeat(43);
 assert.deepEqual(registrationLink(url,'https://fashion.example'),{attemptId:binding.attemptId,link:'b'.repeat(43)});
 assert.equal(registrationLink(url,'https://other.example'),null);
 assert.equal(registrationLink(url.replace('#','?'),'https://fashion.example'),null);
 assert.equal(registrationOrigin('http://localhost:9999'),null);
 assert.equal(registrationOrigin('https://fashion.example/private'),null);
});
test('registration uses JSON POST, no cookies, no redirects and no query secrets',async()=>{
 globalThis.fetch=async(url,options)=>{
  assert.equal(url,'https://verify.example/auth/registration/link');
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  assert.deepEqual(JSON.parse(options.body),binding);
  return new Response(JSON.stringify({status:'link_verified'}),{headers:{'Content-Type':'application/json'}});
 };
 assert.deepEqual(await registrationRequest('https://verify.example','link',binding),{status:'link_verified'});
});
test('registration errors never reflect sensitive service response bodies',async()=>{
 globalThis.fetch=async()=>new Response('private-code',{status:400});
 await assert.rejects(registrationRequest('https://verify.example','verify',binding),error=>!error.message.includes('private-code'));
});
test('lost resend response restores the replacement with the original capability',async()=>{
 const calls=[];
 const attemptId='abcdef12-1234-4234-8234-123456789abc';
 globalThis.fetch=async(url,options)=>{
  calls.push(new URL(url).pathname);
  assert.deepEqual(JSON.parse(options.body),binding);
  if(url.endsWith('/resend'))throw new TypeError('Connection lost');
  return Response.json({status:'pending',attemptId});
 };
 const restored=await resendRegistration('https://verify.example',binding);
 assert.deepEqual(restored.binding,{...binding,attemptId});
 assert.equal(restored.status,'pending');
 assert.deepEqual(calls,['/auth/registration/resend','/auth/registration/status']);
});
test('status restoration rejects a malformed replacement and keeps the original error when nothing rotated',async()=>{
 globalThis.fetch=async(url)=>url.endsWith('/resend') ? new Response(null,{status:429}) : Response.json({status:'pending'});
 await assert.rejects(resendRegistration('https://verify.example',binding),/wait a minute/);
 globalThis.fetch=async()=>Response.json({status:'pending',attemptId:['abcdef12-1234-4234-8234-123456789abc']});
 await assert.rejects(registrationStatus('https://verify.example',binding),/Unexpected verification response/);
});
test('Auth session alone cannot grant normal or administrative UI access',async()=>{
 assert.deepEqual(await resolveCustomerAccess(async()=>({userId:'a',isCatalogAdmin:false}),'a'),{role:'user',deleting:false});
 assert.deepEqual(await resolveCustomerAccess(async()=>({userId:'a',isCatalogAdmin:true}),'a'),{role:'admin',deleting:false});
 await assert.rejects(resolveCustomerAccess(async()=>({userId:'b',isCatalogAdmin:true}),'a'));
 await assert.rejects(resolveCustomerAccess(async()=>({role:'admin'}),'a'));
 await assert.rejects(resolveCustomerAccess(async()=>{throw new Error('offline');},'a'));
});
test('account access preserves temporary service errors without granting access', async()=>{
 const timeout=Object.assign(new Error('The service took too long to respond.'),{kind:'timeout'});
 await assert.rejects(resolveCustomerAccess(async()=>{throw timeout;},'a'),error=>error===timeout);
 const unauthorized=Object.assign(new Error('Your session has expired.'),{status:401});
 await assert.rejects(resolveCustomerAccess(async()=>{throw unauthorized;},'a'),error=>error===unauthorized);
});
test('restored deleting sessions get only the deletion screen boundary',async()=>{
 const read=async path=>{if(path==='/admin/catalog/access')throw Object.assign(new Error('denied'),{status:403});return {status:'deleting'};};
 assert.deepEqual(await resolveCustomerAccess(read,'a'),{role:'user',deleting:true});
 await assert.rejects(resolveCustomerAccess(async path=>{if(path==='/admin/catalog/access')throw Object.assign(new Error('denied'),{status:403});return {status:'not_requested'};},'a'));
});
test('sparse form saves preserve untouched server fields and explicit clears',()=>{
 const fields=[{key:'name',label:'Name'},{key:'bio',label:'Bio'},{key:'height',label:'Height',kind:'number'}];
 assert.deepEqual(patchPayload(fields,{name:'Stale name',bio:'',height:'168'},{bio:''}),{bio:''});
 assert.deepEqual(patchPayload(fields,{height:''},{height:''}),{height:null});
 assert.deepEqual(patchPayload(fields,{name:'Stale name'},{}),{});
});

test('only the exact local registration endpoint is allowed in development preview',()=>{
 assert.equal(registrationOrigin('http://127.0.0.1:8001',true),'http://127.0.0.1:8001');
 assert.equal(registrationOrigin('http://127.0.0.1:8001'),null);
 assert.equal(registrationOrigin('http://127.0.0.1:8002',true),null);
 assert.equal(registrationOrigin('https://other.example',true),null);
});
