import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium, devices } from "playwright";

const port = 4193;
const baseUrl = `http://127.0.0.1:${port}`;
const output = new URL("../test-results/", import.meta.url);

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) return;
    } catch {
      // The static server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Static server did not start");
}

async function mockOfflineApi(page) {
  await page.route("**/api/**", (route) => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE", message: "Offline test" } }),
  }));
}

await mkdir(output, { recursive: true });
const server = spawn("python3", ["-m", "http.server", String(port), "--directory", "dist"], { stdio: "ignore" });
let browser;

try {
  await waitForServer();
  browser = await chromium.launch({ headless: true });

  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  const page = await desktop.newPage();
  await page.addInitScript(() => {
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    globalThis.__gameplayImageSources = [];
    CanvasRenderingContext2D.prototype.drawImage = function recordGameplayImage(image, ...arguments_) {
      globalThis.__gameplayImageSources.push(image.currentSrc || image.src || "");
      return drawImage.call(this, image, ...arguments_);
    };
  });
  await mockOfflineApi(page);
  await page.goto(baseUrl);
  await page.getByRole("heading", { name: /Eyes up/i }).waitFor();
  await page.waitForFunction(() => {
    const image = document.querySelector('img[src="assets/ryku/ryku-game.png"]');
    return image?.complete && image.naturalWidth > 0;
  });
  await page.screenshot({ path: new URL("dashboard-ryku.png", output).pathname, fullPage: true });
  await page.getByLabel("HUNTER USERNAME").fill("NeonDrake7");
  await page.getByRole("button", { name: /GAME A SOLO FLIGHT/i }).click();
  await page.getByRole("heading", { name: "Solo Flight" }).waitFor();
  await page.screenshot({ path: new URL("mode-ryku.png", output).pathname, fullPage: true });
  await page.getByRole("button", { name: /ENTER THE GAME/i }).click();
  const canvas = page.getByRole("application", { name: /Ryku hunting arena/i });
  await canvas.waitFor();
  await page.waitForFunction(() => Number.parseFloat(document.querySelector("#wave-timer")?.style.width) < 80);
  await page.waitForFunction(() => globalThis.__gameplayImageSources.some((source) => source.endsWith("/assets/ryku/ryku-game.png")));
  await page.waitForFunction(() => globalThis.__gameplayImageSources
    .some((source) => source.endsWith("/assets/backgrounds/ryku-jungle.png")));
  await page.screenshot({ path: new URL("game-jungle-background.png", output).pathname, fullPage: true });
  const box = await canvas.boundingBox();
  assert.ok(box && box.width > 600 && box.height > 350);
  await canvas.click({ position: { x: 5, y: box.height - 5 } });
  await canvas.click({ position: { x: 5, y: box.height - 5 } });
  await canvas.click({ position: { x: 5, y: box.height - 5 } });
  await page.getByText("02/10").waitFor({ timeout: 3_000 });
  await page.getByRole("button", { name: "Pause game" }).click();
  await page.getByText("TRANSMISSION PAUSED").waitFor();
  await page.screenshot({ path: new URL("desktop-game.png", output).pathname, fullPage: true });
  await desktop.close();

  const mobile = await browser.newContext({ ...devices["iPhone 13"], reducedMotion: "reduce" });
  const mobilePage = await mobile.newPage();
  await mockOfflineApi(mobilePage);
  await mobilePage.goto(baseUrl);
  await mobilePage.getByLabel("HUNTER USERNAME").fill("MossWyrm123");
  await mobilePage.getByRole("button", { name: /GAME B DUAL SIGNAL/i }).click();
  await mobilePage.getByRole("heading", { name: "Dual Signal" }).waitFor();
  await mobilePage.getByRole("button", { name: /ENTER THE GAME/i }).click();
  await mobilePage.getByRole("application", { name: /Ryku hunting arena/i }).waitFor();
  const hasHorizontalOverflow = await mobilePage.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(hasHorizontalOverflow, false);
  await mobilePage.screenshot({ path: new URL("mobile-game.png", output).pathname, fullPage: true });
  await mobile.close();

  console.log("Browser smoke passed: desktop Game A and mobile Game B.");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
