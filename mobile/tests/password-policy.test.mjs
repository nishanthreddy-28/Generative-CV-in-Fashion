import assert from "node:assert/strict";
import { test } from "node:test";
import { passwordChecks, passwordIssue } from "../src/services/auth/passwordPolicy.ts";

test("registration policy requires every character class and minimum length", () => {
  for (const password of ["Ab1!", "abcdef1!", "ABCDEF1!", "Abcdefg!", "Abcdefg1"]) {
    assert.ok(passwordIssue(password));
  }
  assert.equal(passwordIssue("Cedar!79Moon"), undefined);
});

test("registration policy rejects predictable values and identity fragments", () => {
  for (const password of ["Password1!", "Welcome8!", "Qwerty9!", "Abc123456!", "Xaaaa7!Z"]) {
    assert.ok(passwordIssue(password));
  }
  assert.ok(passwordIssue("Nishanth7!Moon", "nishanth.reddy@example.com"));
  assert.ok(passwordIssue("Lina7!Cedar", "", "Lina"));
  assert.equal(passwordIssue("Cedar!79Moon", "lina@example.com"), undefined);
});

test("feedback contains rule labels only and never the supplied password", () => {
  const checks = passwordChecks("Cedar!79Moon");
  assert.equal(checks.length, 7);
  assert.ok(checks.every(check => check.passed));
  assert.ok(!JSON.stringify(checks).includes("Cedar!79Moon"));
});
