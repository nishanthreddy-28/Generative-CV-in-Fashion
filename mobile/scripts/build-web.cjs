const { spawnSync } = require("node:child_process");
const { isIP } = require("node:net");
const { resolve } = require("node:path");

const env = { ...process.env, EXPO_NO_DOTENV: "1" };
const mode = env.DRAPE_WEB_MODE || "connected";
const apiName = "EXPO_PUBLIC_API_URL";
const authName = "EXPO_PUBLIC_SUPABASE_URL";
const keyName = "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY";
const googleName = "EXPO_PUBLIC_GOOGLE_AUTH_ENABLED";

function validateOrigin(name) {
  const value = env[name]?.trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(name + " must be set to an HTTPS service origin.");
  }
  const host = url.hostname.replace(/\.$/, "");
  if (url.protocol !== "https:" || url.username || url.password ||
      value.includes("?") || value.includes("#") || url.pathname !== "/" ||
      !host.includes(".") || isIP(host) || /\.(localhost|local|internal|test|invalid|example)$/.test(host)) {
    throw new Error(name + " must be a credential-free HTTPS origin on a deployed DNS hostname.");
  }
  env[name] = url.origin;
}

try {
  if (mode === "review") {
    for (const name of [apiName, authName, keyName, googleName]) delete env[name];
  } else if (mode === "connected") {
    validateOrigin(apiName);
    validateOrigin(authName);
    const key = env[keyName]?.trim();
    if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key || "")) {
      throw new Error(keyName + " must be a Supabase publishable key.");
    }
    env[keyName] = key;
    if (env[googleName] && !["true", "false"].includes(env[googleName])) {
      throw new Error(googleName + " must be true or false.");
    }
  } else {
    throw new Error("DRAPE_WEB_MODE must be review or connected.");
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

env.EXPO_PUBLIC_REVIEW_ONLY = mode === "review" ? "true" : "false";
console.log("Exporting Drape & Drop web in " + mode + " mode.");
const expo = require.resolve("expo/bin/cli");
const result = spawnSync(process.execPath, [expo, "export", "--platform", "web"], {
  cwd: resolve(__dirname, ".."),
  env,
  stdio: "inherit",
});
if (result.error) console.error("Could not start the Expo web export.");
process.exitCode = result.status ?? 1;
