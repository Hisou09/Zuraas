import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.TEST_BASE_URL || "http://127.0.0.1:3000";

async function waitForServer(timeout = 45_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl, { redirect: "manual" });
      if (response.status > 0) return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  throw new Error(`Local site is not running at ${baseUrl}. Start it with "pnpm dev" before this test.`);
}

test.before(async () => {
  await waitForServer(8_000);
});

test("browser entry renders the access gate without a runtime error", async () => {
  const response = await fetch(baseUrl);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /access-gate/);
  assert.match(html, /gate-primary/);
  assert.doesNotMatch(html, /Runtime Error|Internal Server Error/);
});

test("protected catalog API rejects anonymous browser requests cleanly", async () => {
  const response = await fetch(`${baseUrl}/api/catalog`);
  assert.equal(response.status, 401);
  assert.match(response.headers.get("content-type") || "", /application\/json/);
});

test("Google sign-in endpoint returns a redirect instead of a server error", async () => {
  const response = await fetch(`${baseUrl}/api/auth/google`, { redirect: "manual" });
  assert.ok([302, 303, 307, 308].includes(response.status), `unexpected status ${response.status}`);
  assert.ok(response.headers.get("location"));
});

test("browser assets are available", async () => {
  const response = await fetch(`${baseUrl}/logo-transparent.png`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /image\//);
});
