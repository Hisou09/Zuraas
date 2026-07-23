/**
 * Node.js shim for `cloudflare:workers`.
 *
 * When building for Node.js / Docker (NODE_DEPLOY=true), Vite's resolve.alias
 * maps `cloudflare:workers` to this file instead of the real Cloudflare module.
 *
 * All application code uses `env` only as a key→value bag of strings (it casts
 * it to `Record<string, string | undefined>` or a typed shape). Node.js
 * `process.env` is exactly that bag, so it is a drop-in replacement.
 *
 * Other named exports from the real `cloudflare:workers` module (e.g. `DurableObject`,
 * `WorkerEntrypoint`, etc.) are not used by this codebase, so they are not shimmed.
 */

export const env: Record<string, string | undefined> = process.env as Record<string, string | undefined>;
