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
    /request was cancelled/,
  );
  await assert.rejects(apiRequest("/wardrobe"), /Unable to connect/);
});
test("account access retries once and accepts only the recovered JSON response", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  for (const first of [new Response(null, {status: 503}), new Response("<html>Starting</html>", {
    headers: {"content-type": "text/html"},
  })]) {
    let requests = 0;
    globalThis.fetch = async (_url, options) => {
      assert.equal(options.method, "GET");
      assert.equal(options.headers.Authorization, "Bearer current-token");
      return ++requests === 1 ? first : Response.json({userId:"owner", isCatalogAdmin:false});
    };
    assert.deepEqual(await apiRequest("/admin/catalog/access", {token:"current-token"}), {userId:"owner", isCatalogAdmin:false});
    assert.equal(requests, 2);
  }
});
test("account access can outlast the first 20-second deadline and stops at 70 seconds", async (t) => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  t.mock.timers.enable({apis:["setTimeout"]});
  let requests = 0;
  let startedRecovery;
  const recovery = new Promise(resolve => { startedRecovery = resolve; });
  globalThis.fetch = async (_url, {signal}) => new Promise((_, reject) => {
    signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), {once:true});
    if (++requests === 2) startedRecovery();
  });
  const request = apiRequest("/admin/catalog/access");
  const rejected = assert.rejects(request, error => error.kind === "timeout");
  t.mock.timers.tick(20_000);
  await recovery;
  t.mock.timers.tick(49_999);
  assert.equal(requests, 2);
  t.mock.timers.tick(1);
  await rejected;
  assert.equal(requests, 2);
});
test("writes and authentication denials are never retried", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  for (const [path, method, status] of [["/wardrobe", "POST", 503], ["/wardrobe/item", "PATCH", 504],
    ["/account", "DELETE", 503], ["/outfits/id/items", "PUT", 502], ["/admin/catalog/access", "GET", 401],
    ["/admin/catalog/access", "GET", 403], ["/wardrobe", "GET", 503]]) {
    let requests = 0;
    globalThis.fetch = async () => { requests++; return new Response(null, {status}); };
    await assert.rejects(apiRequest(path, {method}), error => error.status === status);
    assert.equal(requests, 1);
  }
});
test("caller cancellation stops account access recovery", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  const controller = new AbortController();
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    controller.abort();
    return new Response(null, {status:503});
  };
  await assert.rejects(apiRequest("/admin/catalog/access", {signal:controller.signal}), error => error.kind === "cancelled");
  assert.equal(requests, 1);
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


test("catalog price validation preserves blank as null and rejects invalid currency precision", () => {
  const fields = [{key:"price",label:"Price (INR)",kind:"number",min:0,max:1000000,decimals:2}];
  for (const price of ["-1","1000001","1.001","Infinity","no"])
    assert.ok(validate(fields,{price}).price);
  for (const price of ["","0","12.50","1000000"])
    assert.deepEqual(validate(fields,{price}),{});
  assert.deepEqual(payloadFor(fields,{price:""}),{price:null});
  assert.deepEqual(payloadFor(fields,{price:"12.50"}),{price:12.5});
});

test("admin catalog create/edit/deactivate use multipart and latest authenticated requests", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  const methods=[];
  globalThis.fetch=async (url,options) => {
    methods.push(options.method);
    assert.equal(options.headers.Authorization,"Bearer admin-current");
    assert.ok(url.startsWith("https://service.example.invalid/admin/catalog"));
    if(options.method==="POST" || options.method==="PATCH") {
      assert.ok(options.body instanceof FormData);
      assert.equal(options.headers["Content-Type"],undefined);
      const metadata=JSON.parse(options.body.get("metadata"));
      assert.equal(metadata.price,12.5);
      assert.equal(metadata.active,undefined);
      assert.equal(metadata.role,undefined);
    }
    return options.method==="POST" ? Response.json({id:"piece",active:true},{status:201}) : new Response(null,{status:204});
  };
  const form=new FormData();form.append("metadata",JSON.stringify({name:"Piece",category:"Tops",price:12.5}));
  form.append("image",new Blob([new Uint8Array([255,216,255])],{type:"image/jpeg"}),"piece.jpg");
  assert.equal((await apiRequest("/admin/catalog",{method:"POST",body:form,token:"admin-current"})).id,"piece");
  await apiRequest("/admin/catalog/piece",{method:"PATCH",body:form,token:"admin-current"});
  await apiRequest("/admin/catalog/piece",{method:"DELETE",token:"admin-current"});
  assert.deepEqual(methods,["POST","PATCH","DELETE"]);
});

test("admin catalog failures surface errors rather than fabricated success", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  for(const status of [401,403,404,422,503]) {
    globalThis.fetch=async () => Response.json({detail:"Access unavailable"},{status});
    await assert.rejects(apiRequest("/admin/catalog/piece",{method:"DELETE",token:"current"}),
      (error) => error instanceof ApiError && error.status===status);
  }
});

test("catalog and admin images require authenticated byte retrieval", async () => {
  process.env.EXPO_PUBLIC_API_URL = "https://service.example.invalid";
  for(const path of ["/catalog/piece/image","/admin/catalog/piece/image"]) {
    globalThis.fetch=async (url,options) => {
      assert.ok(url.endsWith(path));
      assert.equal(options.headers.Authorization,"Bearer latest");
      return new Response(new Uint8Array([255,216,255]),{headers:{"Content-Type":"image/jpeg"}});
    };
    assert.ok(await apiRequest(path,{responseType:"image",token:"latest"}) instanceof Blob);
  }
});
