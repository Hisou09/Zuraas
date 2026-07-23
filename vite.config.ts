import vinext from "vinext";
import { defineConfig } from "vite";
import { existsSync, readFileSync } from "node:fs";

function readLocalBindings() {
  const bindings: Record<string, string> = {};

  for (const filename of [".dev.vars", ".env.local", ".env"]) {
    if (!existsSync(filename)) continue;

    for (const rawLine of readFileSync(filename, "utf8").split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator < 1) continue;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // The first, most local file wins. This mirrors the database scripts.
      bindings[key] ??= value;
    }
  }

  return bindings;
}

export default defineConfig(async () => {
  // NODE_DEPLOY=true → build for Node.js production (Docker / Coolify VPS).
  // The Cloudflare plugin targets Workerd runtime and emits `cloudflare:`
  // protocol imports that Node.js cannot load. Skip it for Node.js deploys.
  const isNodeDeploy = process.env.NODE_DEPLOY === "true";

  if (isNodeDeploy) {
    return { plugins: [vinext()] };
  }

  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  const localVariables = readLocalBindings();
  const localBindingConfig = {
    main: "./worker/index.ts",
    compatibility_flags: ["nodejs_compat"],
    vars: localVariables,
    r2_buckets: [
      {
        binding: "MEDIA",
        bucket_name: localVariables.R2_BUCKET_NAME?.trim() || "zuraas-media",
      },
    ],
  };

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
