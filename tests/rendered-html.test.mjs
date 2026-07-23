import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const project = new URL("../", import.meta.url);
const source = path => readFile(new URL(path, project), "utf8");

test("build output and Zuraas access gate are present", async () => {
  await access(new URL("dist/server/index.js", project));
  const [gate, layout] = await Promise.all([source("app/components/AccessGate.tsx"), source("app/layout.tsx")]);
  assert.match(gate, /Насны баталгаажуулалт/);
  assert.match(layout, /const title = "Зураас"/);
  assert.doesNotMatch(`${gate}\n${layout}`, /Your site is taking shape|Building your site/i);
});

test("primary navigation and library filters stay functional", async () => {
  const [home, catalog, library] = await Promise.all([source("app/page.tsx"), source("app/catalog/page.tsx"), source("app/components/CollectionPage.tsx")]);
  assert.match(home, /href=\{`\/title\/\$\{item\.id\}`\}/);
  assert.match(catalog, /href=\{`\/title\/\$\{item\.id\}`\}/);
  assert.match(library, /type LibraryFilter="all"\|"unread"\|"completed"/);
  assert.match(library, /setFilter\("unread"\)/);
  assert.match(library, /setFilter\("completed"\)/);
  assert.doesNotMatch(`${home}\n${catalog}\n${library}`, /react-loading-skeleton/i);
});
