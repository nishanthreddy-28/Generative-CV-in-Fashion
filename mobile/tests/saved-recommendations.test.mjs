import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {savedStatus,createMutationGate,saveRecommendation,removeSavedRecommendation,savedPage} from '../src/features/savedRecommendationActions.ts';
import {apiRequest,ApiError} from '../src/services/api/client.ts';
const originalFetch=globalThis.fetch;const originalUrl=process.env.EXPO_PUBLIC_API_URL;
afterEach(()=>{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=originalUrl;});
const rec={id:'rec',savedId:'saved',name:'Look',items:[{source:'wardrobe',garmentId:'top',name:'Top'},{source:'catalog',garmentId:'bottom',name:'Bottom'}],reasons:['Compatible categories']};
const saved={id:'saved',recommendationId:'rec',savedAt:'2026-11-09T00:00:00Z',available:true,recommendation:rec};

test('save posts provenance ID only, handles both created and existing responses, and removal targets saved ID',async()=>{
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';const methods=[];
  globalThis.fetch=async(url,options)=>{
    assert.equal(options.headers.Authorization,'Bearer current');methods.push(options.method);
    assert.equal(options.body,undefined);
    if(options.method==='POST'){
      assert.ok(url.endsWith('/recommendations/rec/save'));return Response.json(saved,{status:methods.length===1 ? 201 : 200});
    }
    assert.ok(url.endsWith('/recommendations/saved/saved'));return new Response(null,{status:204});
  };
  const request=(path,options)=>apiRequest(path,{...options,token:'current'});
  assert.equal((await saveRecommendation(request,'rec')).id,'saved');
  assert.equal((await saveRecommendation(request,'rec')).id,'saved');
  await removeSavedRecommendation(request,'saved');assert.deepEqual(methods,['POST','POST','DELETE']);
});

test('duplicate clicks before React disabled state cause exactly one mutation',async()=>{
  const gate=createMutationGate();let calls=0;let release;
  const action=async()=>{calls++;await new Promise(resolve=>{release=resolve;});return saved;};
  const first=gate.run(action);const second=gate.run(action);
  assert.equal(await second,undefined);assert.equal(calls,1);release();assert.equal((await first).id,'saved');
  assert.equal(await gate.run(async()=>42),42);
});

test('failed save unlocks retry and never fabricates a saved state',async()=>{
  const gate=createMutationGate();let attempts=0;
  await assert.rejects(gate.run(async()=>{attempts++;throw new Error('Unavailable');}),/Unavailable/);
  await gate.run(async()=>{attempts++;return saved;});assert.equal(attempts,2);
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';
  for(const status of [401,403,404,409,503]){
    globalThis.fetch=async()=>Response.json({detail:'Unavailable'},{status});
    await assert.rejects(saveRecommendation((path,options)=>apiRequest(path,{...options,token:'current'}),'rec'),e=>e instanceof ApiError && e.status===status);
  }
});

test('saved page preserves unavailable entries as removable provenance without garment data',()=>{
  const unavailable={...saved,available:false,recommendation:null};
  const value=savedPage({items:[saved,unavailable],nextCursor:'opaque'});
  assert.equal(value.items[1].recommendation,null);assert.equal(value.items[1].id,'saved');assert.equal(value.nextCursor,'opaque');
  assert.deepEqual(savedPage({items:[],nextCursor:null}).items,[]);
  assert.throws(()=>savedPage({items:[{...unavailable,recommendation:rec}],nextCursor:null}),/Unexpected/);
  assert.throws(()=>savedPage({items:[{...saved,recommendationId:'other'}],nextCursor:null}),/provenance/);
});

test('saved pagination uses current bearer and opaque continuation rather than garment IDs',async()=>{
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';
  globalThis.fetch=async(url,options)=>{
    assert.ok(url.endsWith('/recommendations/saved?limit=24&cursor=opaque'));
    assert.equal(options.headers.Authorization,'Bearer latest');return Response.json({items:[saved],nextCursor:null});
  };
  assert.equal(savedPage(await apiRequest('/recommendations/saved?limit=24&cursor=opaque',{token:'latest'})).items[0].id,'saved');
});


test('removal overrides stale generated savedId while fresh server projection can reconcile state',()=>{
  assert.equal(savedStatus('rec','old-saved',{}),'old-saved');
  assert.equal(savedStatus('rec','old-saved',{rec:null}),null);
  assert.equal(savedStatus('rec',null,{rec:'new-saved'}),'new-saved');
});
