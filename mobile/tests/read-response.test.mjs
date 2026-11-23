import assert from "node:assert/strict";
import { test } from "node:test";
import { readPage, readRecord } from "../src/services/api/readResponse.ts";

test("only a valid server list is interpreted as an empty collection", () => {
  const empty = { items: [], nextCursor: null };
  assert.equal(readPage(empty), empty);
  for (const response of [null, {}, { items: null }, { items: [{}] },
    { items: [null] }, { items: [{ id: "" }] }, { items: [], nextCursor: 1 }]) {
    assert.throws(() => readPage(response), /unexpected list/);
  }
});

test("resource reads reject missing or non-object results and preserve server data", () => {
  const record = { id: "from-server", name: "Original name" };
  assert.equal(readRecord(record), record);
  for (const response of [undefined, null, [], "", 0]) {
    assert.throws(() => readRecord(response), /unexpected response/);
  }
});
