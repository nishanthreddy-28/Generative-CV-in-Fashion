// Build-time release checks: never bake a loopback API into an installable build.
module.exports = ({ config }) => {
  if (process.env.EAS_BUILD_PROFILE) {
    const names = ["EXPO_PUBLIC_API_URL", "EXPO_PUBLIC_SUPABASE_URL"];
    for (const name of names) {
      let url;
      try { url = new URL(process.env[name] || ""); } catch { throw new Error(`${name} must be configured for this build.`); }
      if (url.protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.username || url.password || url.search || url.hash) {
        throw new Error(`${name} must use a credential-free HTTPS deployment URL.`);
      }
    }
    if (!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_")) {
      throw new Error("An environment-specific Supabase publishable key is required.");
    }
  }
  return config;
};
