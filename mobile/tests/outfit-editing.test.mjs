import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { itemError, itemKey, itemReferences, itemRoute, toggleItem } from "../src/features/outfitItems.ts";
import { apiRequest, ApiError } from "../src/services/api/client.ts";
const originalFetch=globalThis.fetch;
const originalUrl=process.env.EXPO_PUBLIC_API_URL;
afterEach(() => {
  globalThis.fetch=originalFetch;
  if(originalUrl===undefined)delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL=originalUrl;
});
const wardrobe={id:"membership-a",source:"wardrobe",garmentId:"same-id"};
const catalog={id:"membership-b",source:"catalog",garmentId:"same-id"};

test("mixed outfit selection distinguishes sources across pages and removes only selected source", () => {
  assert.notEqual(itemKey(wardrobe),itemKey(catalog));
  const first=toggleItem([],wardrobe);const second=toggleItem(first,catalog);
  assert.deepEqual(first,[wardrobe]);assert.deepEqual(second,[wardrobe,catalog]);
  assert.deepEqual(toggleItem(second,wardrobe),[catalog]);
  assert.equal(itemRoute(wardrobe),"/wardrobe/same-id");
  assert.equal(itemRoute(catalog),"/catalog/same-id");
});

test("outfit item validation rejects empty, single, duplicate and oversized selections", () => {
  assert.ok(itemError([]));assert.ok(itemError([wardrobe]));
  assert.ok(itemError([wardrobe,wardrobe]));
  assert.equal(itemError([wardrobe,catalog]),"");
  assert.ok(itemError(Array.from({length:101},(_,n)=>({...wardrobe,garmentId:String(n)}))));
});

test("saving typed items strips membership IDs without changing local draft or source", () => {
  const draft=[wardrobe,catalog];const snapshot=JSON.stringify(draft);
  assert.deepEqual(itemReferences(draft),[{source:"wardrobe",garmentId:"same-id"},{source:"catalog",garmentId:"same-id"}]);
  assert.equal(JSON.stringify(draft),snapshot);
});

test("metadata PATCH does not send items and atomic PUT preserves source distinctions", async () => {
  process.env.EXPO_PUBLIC_API_URL="https://service.example.invalid";
  const calls=[];
  globalThis.fetch=async(url,options)=>{
    assert.equal(options.headers.Authorization,"Bearer latest-token");
    calls.push([url,options.method,JSON.parse(options.body)]);
    return options.method==="PATCH" ? new Response(null,{status:204}) : Response.json({id:"outfit",items:[wardrobe,catalog]});
  };
  await apiRequest("/outfits/outfit",{method:"PATCH",token:"latest-token",body:{name:"Changed"}});
  const result=await apiRequest("/outfits/outfit/items",{method:"PUT",token:"latest-token",body:{items:itemReferences([wardrobe,catalog])}});
  assert.deepEqual(calls[0][2],{name:"Changed"});
  assert.equal(calls[1][1],"PUT");assert.equal(calls[1][2].items[1].source,"catalog");
  assert.deepEqual(result.items,[wardrobe,catalog]);
});

test("item endpoint POST and DELETE target membership IDs and surface server minimum errors", async () => {
  process.env.EXPO_PUBLIC_API_URL="https://service.example.invalid";
  globalThis.fetch=async(url,options)=>{
    if(options.method==="POST") {
      assert.equal(url,"https://service.example.invalid/outfits/outfit/items");
      assert.deepEqual(JSON.parse(options.body),{source:"catalog",garmentId:"same-id"});
      return Response.json({items:[wardrobe,catalog]},{status:201});
    }
    assert.ok(url.endsWith("/items/membership-a"));
    return Response.json({detail:"Select 2 to 100 items"},{status:422});
  };
  await apiRequest("/outfits/outfit/items",{method:"POST",token:"current",body:itemReferences([catalog])[0]});
  await assert.rejects(apiRequest("/outfits/outfit/items/"+wardrobe.id,{method:"DELETE",token:"current"}),e=>e instanceof ApiError && e.status===422);
});

test("failed replacement leaves the selected draft intact and returns actionable errors", async () => {
  process.env.EXPO_PUBLIC_API_URL="https://service.example.invalid";
  const draft=[wardrobe,catalog];const original=JSON.stringify(draft);
  for(const status of [401,403,404,422,503]) {
    globalThis.fetch=async()=>Response.json({detail:"Unable to save selection"},{status});
    await assert.rejects(apiRequest("/outfits/outfit/items",{method:"PUT",token:"current",body:{items:itemReferences(draft)}}),
      e=>e instanceof ApiError && e.status===status);
    assert.equal(JSON.stringify(draft),original);
  }
});
