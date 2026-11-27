import {test} from "node:test";
import assert from "node:assert/strict";
import {suggestedPiece,validPiece} from "../src/features/pieceReview.ts";
test("a garment prediction becomes an editable broad category, colour and descriptive name",()=>{
 assert.deepEqual(suggestedPiece({slot:"top",category:"Shirt",colors:[{name:"white"},{name:"grey"}]}),
   {category:"Tops",color:"white, grey",name:"White Shirt"});
 assert.equal(validPiece({name:"My favourite shirt",category:"Tops",color:"Cream"}),true);
});
test("unknown categories and blank names cannot be confirmed",()=>{
 assert.throws(()=>suggestedPiece({slot:"unknown",category:"Thing",colors:[]}));
 assert.equal(validPiece({name:" ",category:"Tops"}),false);
 assert.equal(validPiece({name:"Shirt",category:"unknown"}),false);
});
