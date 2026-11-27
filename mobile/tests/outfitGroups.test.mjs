import test from 'node:test';
import assert from 'node:assert/strict';
import {groupSavedOutfits,hasSavedLook} from '../src/features/outfitGroups.ts';
const piece=(source,id)=>({source,garmentId:id});
const outfit=(id,items)=>({id,name:id,description:'',occasion:'',items,garmentIds:items.filter(item=>item.source==='wardrobe').map(item=>item.garmentId)});
test('duplicate looks group independently of item order without merging different sources',()=>{
 const a=outfit('a',[piece('wardrobe','1'),piece('wardrobe','2')]);
 const b=outfit('b',[piece('wardrobe','2'),piece('wardrobe','1')]);
 const c=outfit('c',[piece('catalog','1'),piece('wardrobe','2')]);
 const groups=groupSavedOutfits([a,b,c]);
 assert.equal(groups.length,2);assert.equal(groups[0].copies.length,2);
 assert.equal(a.items[0].garmentId,'1');
});
test('duplicate saving checks older pages too',async()=>{
 const calls=[];const target=[piece('wardrobe','1'),piece('wardrobe','2')];
 const exists=await hasSavedLook(async path=>{calls.push(path);return calls.length===1?{items:[],nextCursor:'older-page'}:{items:[outfit('existing',target)],nextCursor:null};},target);
 assert.equal(exists,true);assert.match(calls[1],/cursor=older-page/);
});
test('duplicate scan stops on broken pagination',async()=>{
 await assert.rejects(hasSavedLook(async()=>({items:[],nextCursor:'same'}),[piece('wardrobe','1')]),/Could not check/);
});
