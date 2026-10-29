import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, createSession, saveOutfit, deletePhoto, requireAdmin } from '../src/studio/services/domain.js';
function fixture() {
  const s = emptyState();
  s.users = [{id:'u',status:'ACTIVE',role:'USER'},{id:'v',status:'ACTIVE',role:'USER'}];
  s.photos = [{id:'p',userId:'u',assetId:'photo'},{id:'q',userId:'v',assetId:'private'}];
  s.wardrobe = [{id:'w',userId:'u',category:'Tops',name:'Shirt',assetId:'shirt'},{id:'x',userId:'v',category:'Tops'}];
  s.catalog = [{id:'c',status:'ACTIVE',category:'Dresses',name:'Dress'},{id:'inactive',status:'INACTIVE',category:'Tops'}];return s;
}
test('exactly one available garment source is required',()=>{const s=fixture();for(const input of [{},{wardrobeItemId:'w',catalogItemId:'c'},{catalogItemId:'inactive'}])assert.throws(()=>createSession(s,'u',{photoId:'p',...input}));});
test('another user’s photo and garment are rejected',()=>{const s=fixture();assert.throws(()=>createSession(s,'u',{photoId:'q',wardrobeItemId:'w'}));assert.throws(()=>createSession(s,'u',{photoId:'p',wardrobeItemId:'x'}));});
test('both source types create honest unavailable sessions without results',()=>{for(const source of [{wardrobeItemId:'w'},{catalogItemId:'c'}]){const session=createSession(fixture(),'u',{photoId:'p',...source});assert.equal(session.status,'AWAITING_INTEGRATION');assert.equal(session.resultAssetId,null);}});
test('unavailable and foreign sessions cannot be saved',()=>{const s=fixture();s.sessions.push(createSession(s,'u',{photoId:'p',wardrobeItemId:'w'}));assert.throws(()=>saveOutfit(s,'u',s.sessions[0].id));assert.throws(()=>saveOutfit(s,'v',s.sessions[0].id));});
test('completed real-result saves are idempotent',()=>{const s=fixture();s.sessions.push({id:'done',userId:'u',status:'COMPLETED',resultAssetId:'result'});saveOutfit(s,'u','done');saveOutfit(s,'u','done');assert.equal(s.saved.length,1);});
test('photo deletion removes linked sessions and favorites but preserves other users',()=>{const s=fixture();s.sessions=[{id:'a',userId:'u',photoId:'p',resultAssetId:'r'},{id:'b',userId:'v',photoId:'q'}];s.saved=[{sessionId:'a'},{sessionId:'b'}];assert.deepEqual(deletePhoto(s,'u','p'),['photo','r']);assert.deepEqual(s.sessions.map(x=>x.id),['b']);assert.equal(s.saved.length,1);assert.throws(()=>deletePhoto(s,'u','q'));});
test('suspended users and ordinary users cannot perform protected operations',()=>{const s=fixture();assert.throws(()=>requireAdmin(s,'u'));s.users[0].status='SUSPENDED';assert.throws(()=>createSession(s,'u',{photoId:'p',wardrobeItemId:'w'}));});
