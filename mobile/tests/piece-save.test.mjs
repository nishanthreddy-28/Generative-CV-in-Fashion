import {test} from "node:test";
import assert from "node:assert/strict";
import {completePieceSave,PieceSaveFailure} from "../src/features/pieceSave.ts";
const values={name:"Blue jeans",category:"Bottoms",color:"blue"};
const preparation={category:"Bottoms",receipt:"reviewed-cutout"};
test("a cutout conflict retains the created ID and retry finishes without a second create",async()=>{
 let savedId=null,fail=true;const calls=[];
 const request=async(path,options)=>{calls.push([path,options.method]);
  if(path==='/wardrobe')return {id:'piece-id'};
  if(path.endsWith('/prepared')&&fail)throw Object.assign(new Error('Preparation expired'),{status:409});
  return {};
 };
 const args={request,values,preparation,createForm:()=>new FormData(),onCreated:id=>{savedId=id;}};
 await assert.rejects(completePieceSave({...args,savedId}),error=>error instanceof PieceSaveFailure&&error.stage==='cutout'&&error.savedId==='piece-id'&&error.reason.status===409);
 assert.equal(savedId,'piece-id');fail=false;
 await completePieceSave({...args,savedId,createForm:()=>{throw new Error('Must not re-upload');}});
 assert.deepEqual(calls,[['/wardrobe','POST'],['/ml/garments/piece-id/prepared','POST'],['/wardrobe/piece-id','PATCH'],['/ml/garments/piece-id/prepared','POST']]);
});
test("a true duplicate is a create conflict and never attaches to an unknown piece",async()=>{
 let creates=0;
 await assert.rejects(completePieceSave({request:async()=>{creates++;throw Object.assign(new Error('Duplicate'),{status:409});},values,preparation,savedId:null,createForm:()=>new FormData(),onCreated:()=>assert.fail()}),error=>error.stage==='create'&&error.savedId===null);
 assert.equal(creates,1);
});
test("missing or category-mismatched cutouts cannot create a wardrobe record",async()=>{
 for(const candidate of [null,{...preparation,category:'Tops'}])await assert.rejects(completePieceSave({request:()=>assert.fail(),values,preparation:candidate,savedId:null,createForm:()=>assert.fail(),onCreated:()=>assert.fail()}),error=>error.stage==='review');
});
