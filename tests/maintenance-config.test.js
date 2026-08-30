import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("package metadata and lint scripts use Ryku naming and Stylelint", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.name, "ryku-hunt");
  assert.equal(packageJson.engines.node, ">=20.19.0");
  assert.match(packageJson.scripts.lint, /lint:js/u);
  assert.match(packageJson.scripts.lint, /lint:css/u);
  assert.match(packageJson.scripts["lint:css"], /stylelint/u);
  assert.equal(typeof packageJson.devDependencies.stylelint, "string");
  assert.equal(typeof packageJson.devDependencies["stylelint-config-standard"], "string");
});

test("CI validates tests, lint, and build on Node 20 without deploying", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(workflow, /node-version:\s*20/iu);
  assert.match(workflow, /npm ci/iu);
  assert.match(workflow, /npm test/iu);
  assert.match(workflow, /npm run lint/iu);
  assert.match(workflow, /npm run build/iu);
  assert.doesNotMatch(workflow, /deploy|migrations apply|RUN_SIGNING_SECRET/iu);
});

test("primary design document uses the Ryku Hunt title", async () => {
  const design = await readFile(new URL("../DESIGN.md", import.meta.url), "utf8");

  assert.match(design, /^# Ryku Hunt — Game Design$/mu);
});
