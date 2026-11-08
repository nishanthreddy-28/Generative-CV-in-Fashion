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

test("body editor serializes real field names, measurements and explicit clearing", async () => {
  const { bodyFields } = await import("../src/features/schema.ts");
  const fields = { units: "cm", height: "175.1234", chest: "", waist: "80", hips: "", inseam: "",
    bodyShape: " Description ", skinTone: " Tone ", undertone: "Neutral", fit: "Relaxed" };
  assert.deepEqual(validate(bodyFields, fields), {});
  assert.deepEqual(payloadFor(bodyFields, fields), {
    units: "cm", height: 175.1234, chest: null, waist: 80, hips: null, inseam: null,
    bodyShape: "Description", skinTone: "Tone", undertone: "Neutral", fit: "Relaxed",
  });
  assert.ok(validate(bodyFields, { ...fields, units: "" }).units);
});

test("wardrobe metadata validates the actual category enum and preserves explicit clearing", async () => {
  const { garmentFields } = await import("../src/features/schema.ts");
  const values = { name: "  Shirt ", category: "Tops", color: "Blue", brand: "", size: "M", material: "Cotton", notes: "" };
  assert.deepEqual(validate(garmentFields, values), {});
  assert.ok(validate(garmentFields, { ...values, category: "Fake" }).category);
  assert.ok(validate(garmentFields, { ...values, name: " " }).name);
  assert.deepEqual(payloadFor(garmentFields, values), { ...values, name: "Shirt" });
});

test("wardrobe collection and detail retain real API records and cursor responses", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  const record = { id: "record", name: "Shirt", category: "Tops", imageUrl: "/wardrobe/record/image" };
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, "Bearer current-token");
    assert.equal(url, "https://service.example.invalid/wardrobe?search=Shirt&category=Tops&sort=name&limit=24");
    return Response.json({ items: [record], nextCursor: "opaque-cursor" });
  };
  const page = await apiRequest("/wardrobe?search=Shirt&category=Tops&sort=name&limit=24", { token: "current-token" });
  assert.deepEqual(page, { items: [record], nextCursor: "opaque-cursor" });
});

test("wardrobe partial metadata PATCH and no-content deletion use current identity", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  const form = new FormData();
  form.append("metadata", JSON.stringify({ notes: "Changed" }));
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push(options.method);
    assert.equal(url, "https://service.example.invalid/wardrobe/record");
    assert.equal(options.headers.Authorization, "Bearer current-token");
    if (options.method === "PATCH") {
      assert.equal(options.body, form);
      assert.equal(options.headers["Content-Type"], undefined);
      assert.deepEqual(JSON.parse(form.get("metadata")), { notes: "Changed" });
    }
    return new Response(null, { status: 204 });
  };
  assert.equal(await apiRequest("/wardrobe/record", { method: "PATCH", body: form, token: "current-token" }), undefined);
  assert.equal(await apiRequest("/wardrobe/record", { method: "DELETE", token: "current-token" }), undefined);
  assert.deepEqual(seen, ["PATCH", "DELETE"]);
});

test("private wardrobe images are fetched with bearer auth and validated as image bytes", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://service.example.invalid/wardrobe/record/image");
    assert.equal(options.headers.Authorization, "Bearer current-token");
    return new Response(new Uint8Array([255,216,255]), { headers: { "Content-Type": "image/jpeg" } });
  };
  const blob = await apiRequest("/wardrobe/record/image", { responseType: "image", token: "current-token" });
  assert.ok(blob instanceof Blob);
  assert.equal(blob.size, 3);
  globalThis.fetch = async () => Response.json({ wrong: "content" });
  await assert.rejects(apiRequest("/wardrobe/record/image", { responseType: "image", token: "current-token" }), /unexpected image/);
});
