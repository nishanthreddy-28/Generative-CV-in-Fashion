import {test,afterEach} from "node:test";
import assert from "node:assert/strict";
import {recommendationResults} from "../src/features/recommendationResults.ts";
import {apiRequest,ApiError} from "../src/services/api/client.ts";
import {itemRoute} from "../src/features/outfitItems.ts";
const originalFetch=globalThis.fetch;const originalUrl=process.env.EXPO_PUBLIC_API_URL;
afterEach(()=>{globalThis.fetch=originalFetch;if(originalUrl===undefined)delete process.env.EXPO_PUBLIC_API_URL;else process.env.EXPO_PUBLIC_API_URL=originalUrl;});
const look={id:'result',requestId:'run',name:'Everyday look 1',occasion:'Everyday',score:77,engineVersion:'rules-v1',reasons:['Category rule (+60).','Other matching rules (+17).'],
  items:[{source:'wardrobe',garmentId:'shirt',name:'Shirt',category:'Tops',color:'Blue'},{source:'catalog',garmentId:'trousers',name:'Trousers',category:'Bottoms',color:'Black'}],garmentIds:['shirt']};

test("real response records retain explanations, scores and typed garment routes",()=>{
  const result=recommendationResults({items:[look],nextCursor:null});
  assert.deepEqual(result,[look]);assert.equal(result[0].reasons.length,2);
  assert.equal(itemRoute(result[0].items[0]),'/wardrobe/shirt');assert.equal(itemRoute(result[0].items[1]),'/catalog/trousers');
});

test("empty results are valid while malformed explanations and fabricated incomplete records are errors",()=>{
  assert.deepEqual(recommendationResults({items:[],nextCursor:null}),[]);
  for(const bad of [{...look,reasons:[]},{...look,score:101},{...look,items:[]},{...look,engineVersion:'unknown'}, {id:'missing details'}])
    assert.throws(()=>recommendationResults({items:[bad],nextCursor:null}),/Unexpected/);
  assert.throws(()=>recommendationResults({items:[],nextCursor:'fake'}),/Unexpected/);
});

test("generation and history requests use actual authenticated API results",async()=>{
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';const calls=[];
  globalThis.fetch=async(url,options)=>{
    calls.push([url,options.method]);assert.equal(options.headers.Authorization,'Bearer latest');
    if(options.method==='POST')assert.deepEqual(JSON.parse(options.body),{occasion:'Everyday',preferences:'Linen',wardrobeOnly:false});
    return Response.json({items:[look],nextCursor:null});
  };
  const response=await apiRequest('/recommendations',{method:'POST',token:'latest',body:{occasion:'Everyday',preferences:'Linen',wardrobeOnly:false}});
  assert.equal(recommendationResults(response)[0].score,77);
  assert.deepEqual(recommendationResults(await apiRequest('/recommendations?limit=10',{token:'latest'})),[look]);
  assert.equal(calls.length,2);
});

test("request failure is surfaced and never replaced by mock recommendations",async()=>{
  process.env.EXPO_PUBLIC_API_URL='https://service.example.invalid';
  for(const status of [401,403,422,503]) {
    globalThis.fetch=async()=>Response.json({detail:'Unable to generate'},{status});
    await assert.rejects(apiRequest('/recommendations',{method:'POST',token:'current',body:{occasion:'Everyday',wardrobeOnly:true}}),e=>e instanceof ApiError && e.status===status);
  }
});
