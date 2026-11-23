import {test} from "node:test";
import assert from "node:assert/strict";
import {buildPersonalizationPatch,parseBudget,parseTags} from "../src/features/personalization.ts";
import {feedbackMap,feedbackReasons,validateFeedback} from "../src/features/recommendationFeedback.ts";

test("style and colour tags are trimmed, bounded, and case-insensitively unique",()=>{
  assert.deepEqual(parseTags(" linen, vintage\nnavy "),["linen","vintage","navy"]);
  assert.equal(parseTags("Linen, linen"),null);
  assert.equal(parseTags("".padEnd(41,"x")),null);
  assert.equal(parseTags(Array.from({length:21},(_,i)=>`tag${i}`).join(",")),null);
});

test("budget parser keeps empty distinct from invalid and enforces INR bounds precision",()=>{
  assert.equal(parseBudget(""),null);
  assert.equal(parseBudget("10.25"),10.25);
  assert.equal(parseBudget("10.255"),undefined);
  assert.equal(parseBudget("1000001"),undefined);
  assert.equal(buildPersonalizationPatch({budgetMin:"50",budgetMax:"25"},[]),null);
});

test("preference payload maps fit clearing and selected occasions without inventing values",()=>{
  assert.deepEqual(buildPersonalizationPatch({styleTags:"minimal",colorTags:"navy",preferredFit:"No preference",budgetMin:"",budgetMax:"250"},["Work"]),{
    styleTags:["minimal"],colorTags:["navy"],preferredFit:null,preferredOccasions:["Work"],budgetMin:null,budgetMax:250,
  });
});

test("feedback reasons are sentiment-bound and feedback indexes by recommendation id",()=>{
  assert.deepEqual(feedbackReasons("like"),["matches_style","color_pairing","occasion_match","already_owned","other"]);
  assert.equal(validateFeedback("dislike","not_my_style",""),true);
  assert.equal(validateFeedback("like","wrong_occasion",""),false);
  const record={id:"feedback",recommendationId:"result",sentiment:"like",reasonCode:"matches_style",note:"",createdAt:"2026-11-23T00:00:00Z",updatedAt:"2026-11-23T00:00:00Z"};
  assert.deepEqual(feedbackMap([record]),{result:record});
});
