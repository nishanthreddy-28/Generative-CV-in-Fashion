import assert from "node:assert/strict";
import {test} from "node:test";
import {createSessionReadCache} from "../src/features/sessionCacheStore.ts";

test("two screens share an in-flight photo and reopening reuses its result",async()=>{
 const cache=createSessionReadCache();
 let reads=0;
 const read=async()=>{reads++;return "photo";};
 const first=cache.load("image:photo",read);
 assert.equal(cache.load("image:photo",read),first);
 assert.equal(await first,"photo");
 assert.equal(await cache.load("image:photo",read),"photo");
 assert.equal(reads,1);
});

test("wardrobe changes discard old cursor pages and keep unrelated photos",async()=>{
 const cache=createSessionReadCache();
 let release;
 let signal;
 const old=cache.load("wardrobe:1:query:cursor",active=>{
  signal=active;
  return new Promise(resolve=>{release=resolve;});
 });
 await cache.load("image:other-piece",async()=>"saved photo");
 cache.discardOldWardrobePages(2);
 assert.ok(signal.aborted);
 release("stale page");
 await old;
 assert.equal(cache.get("wardrobe:1:query:cursor"),undefined);
 assert.equal(cache.get("image:other-piece"),"saved photo");
});

test("closing an account session prevents late private reads entering its cache",async()=>{
 const cache=createSessionReadCache();
 let release;
 const pending=cache.load("image:photo",()=>new Promise(resolve=>{release=resolve;}));
 cache.clear();
 release("private photo");
 await pending;
 assert.equal(cache.get("image:photo"),undefined);
});
