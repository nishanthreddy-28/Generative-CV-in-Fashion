import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {tryonForm,tryonJob} from '../src/features/tryonJobs.ts';
import {apiRequest,ApiError} from '../src/services/api/client.ts';
const originalFetch=globalThis.fetch;const originalUrl=process.env.EXPO_PUBLIC_API_URL;
afterEach(()=>{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=originalUrl;});
const job={id:'job',status:'queued',workerAvailable:false,workerMessage:'No inference worker configured.',canCancel:true,inputAvailable:true,inputUrl:'/try-on/jobs/job/input'};
test('submission requires consent and sends a real photo plus source without owner/status overrides',()=>{
  assert.throws(()=>tryonForm(new Blob(['photo']),'garment','wardrobe',false),/consent/);
  const form=tryonForm(new Blob(['photo']),'garment','catalog',true);
  assert.equal(form.get('source'),'catalog');assert.equal(form.get('photoConsent'),'true');assert.ok(form.get('person') instanceof Blob);
  assert.equal(form.get('owner_id'),null);assert.equal(form.get('status'),null);
});
test('queued jobs explicitly advertise unavailable worker and never claim generated output',()=>{
  assert.equal(tryonJob(job).status,'queued');
  assert.throws(()=>tryonJob({...job,workerAvailable:true}),/Unexpected/);
  assert.throws(()=>tryonJob({...job,inputUrl:'https://public.invalid/photo'}),/Unexpected/);
  assert.throws(()=>tryonJob({...job,status:'completed'}),/Unexpected/);
});
test('live API request shapes support submission history detail and cancellation',async()=>{
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';const seen=[];
  globalThis.fetch=async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer latest');seen.push([url,options.method]);
    if(url.endsWith('/cancel'))return Response.json({...job,status:'failed',failureCode:'CANCELLED',canCancel:false,inputAvailable:false});
    if(options.method==='POST'){assert.ok(options.body instanceof FormData);assert.equal(options.headers['Content-Type'],undefined);return Response.json(job,{status:202});}
    return Response.json(url.endsWith('/job') ? job : {items:[job],nextCursor:'next'});
  };
  assert.equal(tryonJob(await apiRequest('/try-on/jobs',{method:'POST',body:tryonForm(new Blob(['photo']),'g','wardrobe',true),token:'latest'})).workerAvailable,false);
  assert.equal((await apiRequest('/try-on/jobs?limit=24&cursor=opaque',{token:'latest'})).items[0].id,'job');
  assert.equal(tryonJob(await apiRequest('/try-on/jobs/job',{token:'latest'})).status,'queued');
  assert.equal(tryonJob(await apiRequest('/try-on/jobs/job/cancel',{method:'POST',token:'latest'})).status,'failed');
  assert.equal(seen.length,4);
});
test('unauthorized invalid and unavailable failures remain errors, never fake completion',async()=>{
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';
  for(const status of [401,403,404,409,422,503]){
    globalThis.fetch=async()=>Response.json({detail:'Unavailable'},{status});
    await assert.rejects(apiRequest('/try-on/jobs',{token:'current'}),e=>e instanceof ApiError && e.status===status);
  }
});
