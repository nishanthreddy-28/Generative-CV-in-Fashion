import assert from 'node:assert/strict';
import {test} from 'node:test';
import {collectionColumns,garmentSummary,priceLabel,jobPresentation,fieldAutofill} from '../src/features/presentation.ts';
test('collection cards remain readable on narrow screens and use two columns when they fit',()=>{
 assert.equal(collectionColumns(320),1);assert.equal(collectionColumns(375),2);assert.equal(collectionColumns(1400),2);
});
test('optional garment details and actual zero prices remain visible without invented values',()=>{
 assert.equal(garmentSummary({brand:'',color:'Black',size:'M'}),'Black · M');
 assert.equal(garmentSummary({}), '');assert.match(priceLabel(0),/0\.00/);
 for(const value of [null,undefined,NaN,-1,'200'])assert.equal(priceLabel(value),null);
});
test('job status distinguishes expiry, cancellation and queued infrastructure without fake output',()=>{
 assert.equal(jobPresentation({status:'failed',failureCode:'INPUT_EXPIRED'}).title,'Photo expired');
 assert.equal(jobPresentation({status:'failed',failureCode:'CANCELLED'}).title,'Cancelled');
 assert.equal(jobPresentation({status:'failed',failureCode:'WORKER_FAILED'}).tone,'error');
 assert.match(jobPresentation({status:'queued',failureCode:null}).detail,/will not produce a result/);
});
test('password and email autofill do not treat sensitive new credentials as current passwords',()=>{
 assert.equal(fieldAutofill('email','email'),'email');assert.equal(fieldAutofill('currentPassword','password'),'current-password');
 assert.equal(fieldAutofill('confirmPassword','password'),'new-password');
 assert.equal(fieldAutofill('password','password','new'),'new-password');
 assert.equal(fieldAutofill('password','password','current'),'current-password');assert.equal(fieldAutofill('name'),'name');assert.equal(fieldAutofill('notes','multiline'),'off');
});
