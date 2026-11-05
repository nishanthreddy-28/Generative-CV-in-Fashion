import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { validate, payloadFor } from "../src/features/validation.ts";
import { apiRequest, ApiError } from "../src/services/api/client.ts";
const originalFetch = globalThis.fetch;
const originalUrl = process.env.EXPO_PUBLIC_API_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = originalUrl;
});
test("required, email, password, numeric and enum validation reject invalid entries", () => {
  const fields = [
    { key: "name", label: "Name", required: true },
    { key: "email", label: "Email", kind: "email" },
    { key: "password", label: "Password", kind: "password" },
    { key: "height", label: "Height", kind: "number", min: 1, max: 300 },
    { key: "units", label: "Units", options: ["cm", "in"] },
  ];
  const issues = validate(fields, {
    name: "  ",
    email: "invalid",
    password: "short",
    height: "Infinity",
    units: "unknown",
  });
  assert.deepEqual(
    Object.keys(issues).sort(),
    ["name", "email", "password", "height", "units"].sort(),
  );
  assert.deepEqual(
    validate(fields, {
      name: "Name",
      email: "person@example.invalid",
      password: "long-enough-password",
      height: "165",
      units: "cm",
    }),
    {},
  );
});
test("optional number fields do not become zero and text payloads are trimmed", () => {
  assert.deepEqual(
    payloadFor(
      [
        { key: "height", label: "Height", kind: "number" },
        { key: "name", label: "Name" },
      ],
      { height: "", name: "  Entry  " },
    ),
    { height: null, name: "Entry" },
  );
});
test("missing API configuration never falls back to fabricated data", async () => {
  delete process.env.EXPO_PUBLIC_API_URL;
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    throw new Error("Unexpected fetch");
  };
  await assert.rejects(
    apiRequest("/wardrobe"),
    (e) => e instanceof ApiError && e.message.includes("not connected"),
  );
  assert.equal(called, false);
});
test("absolute service paths cannot redirect a bearer token to another host", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  await assert.rejects(
    apiRequest("//other.example.invalid", { token: "unit-test-token" }),
    /Invalid service path/,
  );
});
test("HTTP authentication failures are errors, never successful payloads", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid/";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://service.example.invalid/wardrobe");
    assert.equal(options.headers.Authorization, "Bearer unit-test-token");
    return new Response(null, { status: 401 });
  };
  await assert.rejects(
    apiRequest("/wardrobe", { token: "unit-test-token" }),
    (e) => e instanceof ApiError && e.status === 401,
  );
});
test("successful DELETE with no content is supported", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(
    await apiRequest("/wardrobe/record", { method: "DELETE" }),
    undefined,
  );
});
test("unexpected HTML responses do not become application data", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  globalThis.fetch = async () =>
    new Response("<html>Unavailable</html>", {
      headers: { "content-type": "text/html" },
    });
  await assert.rejects(apiRequest("/wardrobe"), /unexpected response/);
});
test("cancelled and failed network requests expose actionable errors", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  globalThis.fetch = async (_url, options) => {
    if (options.signal.aborted) throw new DOMException("Aborted", "AbortError");
    throw new TypeError("Network failure");
  };
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    apiRequest("/wardrobe", { signal: controller.signal }),
    /cancelled or timed out/,
  );
  await assert.rejects(apiRequest("/wardrobe"), /Unable to connect/);
});
test("multipart requests let the transport set the content boundary", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  const form = new FormData();
  form.append("metadata", "{}");
  globalThis.fetch = async (_url, options) => {
    assert.equal(options.body, form);
    assert.equal(options.headers["Content-Type"], undefined);
    return new Response(null, { status: 204 });
  };
  await apiRequest("/wardrobe", { method: "POST", body: form });
});

test("drafts survive subscribers remounting, stay separated, and clear on account exit", async () => {
  const { createDraftStore } = await import("../src/features/draftStore.ts");
  const store = createDraftStore();
  let changes = 0;
  const unsubscribe = store.subscribe(() => changes++);
  store.set("preview:profile", { name: "Unsaved entry" });
  unsubscribe();
  assert.deepEqual(store.get("preview:profile", {}), { name: "Unsaved entry" });
  assert.deepEqual(store.get("account:profile", {}), {});
  store.clear();
  assert.deepEqual(store.get("preview:profile", {}), {});
  assert.equal(changes, 1);
});
