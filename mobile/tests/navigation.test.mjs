import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readdirSync} from 'node:fs';
import {guestScreens,publicScreens,personalScreens,adminScreens,accountScreens,routeAccess,activeDestination} from '../src/features/navigation.ts';
test('every actual route has exactly one explicit access classification',()=>{
 const root=new URL('../src/app/',import.meta.url);
 const files=readdirSync(root,{recursive:true}).filter(name=>name.endsWith('.tsx') && !name.endsWith('_layout.tsx')).map(name=>name.slice(0,-4));
 const declared=[...guestScreens,...publicScreens,...personalScreens,...adminScreens,...accountScreens];
 assert.equal(new Set(declared).size,declared.length);
 assert.deepEqual([...declared].sort(),files.sort());
 assert.ok(!files.includes('preview'));
});
test('restoration, guest, normal, admin and deleting sessions have separate route boundaries',()=>{
 assert.deepEqual(routeAccess(false,'admin',false),{guest:false,personal:false,admin:false,account:false});
 assert.deepEqual(routeAccess(true,undefined,false),{guest:true,personal:false,admin:false,account:false});
 assert.deepEqual(routeAccess(true,'user',false),{guest:false,personal:true,admin:false,account:true});
 assert.deepEqual(routeAccess(true,'admin',false),{guest:false,personal:true,admin:true,account:true});
 assert.deepEqual(routeAccess(true,'admin',true),{guest:false,personal:false,admin:false,account:true});
});
test('detail routes retain the correct primary navigation destination',()=>{
 for(const path of ['/wardrobe/add','/wardrobe/garment-id'])assert.equal(activeDestination(path),'/wardrobe');
 assert.equal(activeDestination('/recommendations/saved'),'/outfits');
 assert.equal(activeDestination('/profile/body'),'/settings');
 assert.equal(activeDestination('/login'),undefined);
});

test('password recovery remains reachable for authenticated settings and guest users',()=>{
 assert.ok(publicScreens.includes('forgot-password'));
 assert.ok(!guestScreens.includes('forgot-password'));
});
