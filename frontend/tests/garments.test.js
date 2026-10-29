import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState} from '../src/studio/services/domain.js';
import {upsertGarment,queryGarments} from '../src/studio/services/garments.js';
const fixture=()=>({...emptyState(),users:[{id:'u',status:'ACTIVE',role:'USER'},{id:'a',status:'ACTIVE',role:'ADMIN'}]});
const fields={name:'Linen shirt',category:'Tops',color:'White',status:'INACTIVE'};
test('wardrobe edits preserve ownership and reject foreign records',()=>{const s=fixture();const item=upsertGarment(s,'u','wardrobe',fields,null,'asset');assert.equal(item.userId,'u');assert.throws(()=>upsertGarment(s,'a','wardrobe',fields,item.id));});
test('catalog mutations require admin and validate metadata',()=>{const s=fixture();assert.throws(()=>upsertGarment(s,'u','catalog',fields,null,'asset'));assert.throws(()=>upsertGarment(s,'a','catalog',{...fields,color:'invalid'},null,'asset'));assert.equal(upsertGarment(s,'a','catalog',fields,null,'asset').status,'INACTIVE');});
test('filters, sorting, pagination and deletion are consistent',()=>{const rows=Array.from({length:12},(_,i)=>({name:`Shirt ${String(i).padStart(2,'0')}`,category:'Tops',color:i%2?'Blue':'White',createdAt:'2026-10-29'}));assert.equal(queryGarments(rows,{color:'White'}).total,6);assert.equal(queryGarments(rows,{sort:'name',page:2}).items.length,3);assert.equal(queryGarments(rows,{search:'missing',page:9}).current,1);rows[0].deletedAt='now';assert.equal(queryGarments(rows).total,11);});
