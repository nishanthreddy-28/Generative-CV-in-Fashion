import {test} from "node:test";
import assert from "node:assert/strict";
import {emptyOutfitFilters,outfitQuery,loadOutfitPages,mergeOutfits} from "../src/features/outfitCollection.ts";
import {createDraftStore} from "../src/features/draftStore.ts";

test("filter query includes source, category, name search and inclusive UTC dates",()=>{
  const filters={...emptyOutfitFilters,search:" Alpha ",source:"catalog",category:"Tops",sort:"name",from:"2026-11-01",through:"2026-11-08"};
  const params=new URLSearchParams(outfitQuery(filters,"opaque").split('?')[1]);
  assert.equal(params.get('search'),'Alpha');assert.equal(params.get('source'),'catalog');assert.equal(params.get('category'),'Tops');
  assert.equal(params.get('sort'),'name');assert.equal(params.get('created_from'),'2026-11-01T00:00:00.000Z');
  assert.equal(params.get('created_before'),'2026-11-09T00:00:00.000Z');assert.equal(params.get('cursor'),'opaque');
});

test("invalid and reversed calendar dates are rejected before requests",()=>{
  for(const from of ['2026-02-30','2026-13-01','yesterday','2026-1-01'])assert.throws(()=>outfitQuery({...emptyOutfitFilters,from}));
  assert.throws(()=>outfitQuery({...emptyOutfitFilters,from:'2026-11-09',through:'2026-11-08'}));
  assert.doesNotThrow(()=>outfitQuery({...emptyOutfitFilters,from:'2026-11-08',through:'2026-11-08'}));
});

test("additional pages preserve order and suppress duplicate cards",async()=>{
  const calls=[];const pages=[{items:[{id:'a',name:'A'}],nextCursor:'next'},{items:[{id:'a',name:'Updated A'},{id:'b',name:'B'}],nextCursor:null}];
  const result=await loadOutfitPages(async(path)=>{calls.push(path);return pages.shift();},emptyOutfitFilters,2);
  assert.equal(new URLSearchParams(calls[0].split('?')[1]).get('cursor'),null);
  assert.equal(new URLSearchParams(calls[1].split('?')[1]).get('cursor'),'next');
  assert.deepEqual(result.items,[{id:'a',name:'Updated A'},{id:'b',name:'B'}]);assert.equal(result.nextCursor,null);
  assert.deepEqual(mergeOutfits([{id:'a'}],[{id:'b'}]).map(item=>item.id),['a','b']);
});

test("return from editing re-anchors saved page count using current cursor boundaries",async()=>{
  const filters={...emptyOutfitFilters,search:'Look'};const paths=[];
  const request=async(path)=>{paths.push(path);return paths.length===1 ? {items:[{id:'new',name:'Edited look'}],nextCursor:'new-boundary'} : {items:[{id:'old',name:'Look'}],nextCursor:null};};
  const result=await loadOutfitPages(request,filters,2);
  assert.equal(new URLSearchParams(paths[0].split('?')[1]).get('cursor'),null);
  assert.equal(new URLSearchParams(paths[1].split('?')[1]).get('cursor'),'new-boundary');
  assert.equal(result.items[0].name,'Edited look');
});

test("empty/end-of-list stops requests even with previously loaded page count",async()=>{
  let count=0;const result=await loadOutfitPages(async()=>{count++;return {items:[],nextCursor:null};},emptyOutfitFilters,4);
  assert.equal(count,1);assert.deepEqual(result,{items:[],nextCursor:null});
});

test("failed or cancelled refresh does not return partial pages as a successful refresh",async()=>{
  let count=0;
  await assert.rejects(loadOutfitPages(async()=>{if(count++)throw new Error('Network unavailable');return {items:[{id:'a'}],nextCursor:'next'};},emptyOutfitFilters,2),/Network unavailable/);
  const controller=new AbortController();controller.abort();
  await assert.rejects(loadOutfitPages(async()=>({items:[],nextCursor:null}),emptyOutfitFilters,1,controller.signal),/cancelled/);
  await assert.rejects(loadOutfitPages(async()=>({items:[],nextCursor:'same'}),emptyOutfitFilters,3),/did not advance/);
});

test("session-memory list state preserves filters/pages during navigation and clears at sign-out",()=>{
  const store=createDraftStore();const state={filters:{...emptyOutfitFilters,source:'catalog'},pages:3,items:[{id:'look'}]};
  store.set('user-a:outfit-list',state);
  assert.deepEqual(store.get('user-a:outfit-list',null),state);
  assert.equal(store.get('user-b:outfit-list',null),null);
  store.clear();assert.equal(store.get('user-a:outfit-list',null),null);
});
