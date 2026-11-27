import {Buffer} from "node:buffer";
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

// Exercise the installed SDK serializer, not a rewritten multipart encoder.
// The only host substitution is Blob.arrayBuffer(), which Node supports.
const source=readFileSync(new URL('../node_modules/expo/src/winter/fetch/convertFormData.ts',import.meta.url),'utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
 .replace(/import \{ blobToArrayBufferAsync \} from ['"]\.\.\/\.\.\/utils\/blobUtils['"];?/, 'const blobToArrayBufferAsync = blob => blob.arrayBuffer();');
const {convertFormDataAsync}=await import('data:text/javascript;base64,'+Buffer.from(javascript).toString('base64'));
const form=entries=>({*entries(){yield* entries;}});

test('SDK 58 rejects the legacy React Native URI photo before HTTP upload',async()=>{
 await assert.rejects(convertFormDataAsync(form([['person',{uri:'file:///cache/gallery.jpg',name:'gallery.jpg',type:'image/jpeg'}]])),/Unsupported FormDataPart/);
});

test('SDK 58 File byte upload retains exact image bytes and required try-on fields',async()=>{
 const bytes=Uint8Array.of(255,216,0,128,255,217);
 // Same bytes/name/type interface implemented by Expo File, without native IO.
 const file={name:'gallery.jpg',type:'image/jpeg',bytes:async()=>bytes};
 const {body,boundary}=await convertFormDataAsync(form([['person',file],['garmentId','00000000-0000-0000-0000-000000000001'],['source','wardrobe'],['photoConsent','true']]),'test-boundary');
 assert.equal(boundary,'test-boundary');
 const raw=Buffer.from(body);
 assert.ok(raw.includes(Buffer.from(bytes)));
 for(const field of ['person','garmentId','source','photoConsent'])assert.ok(raw.includes(Buffer.from(`name="${field}"`)));
 assert.ok(raw.includes(Buffer.from('filename="gallery.jpg"')));
 assert.ok(raw.includes(Buffer.from('Content-Type: image/jpeg'.toLowerCase())));
 assert.ok(raw.includes(Buffer.from('\r\ntrue\r\n')));
 assert.ok(!raw.includes(Buffer.from('file:///')));
});
