import { test, expect } from "@playwright/test";
import * as fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { parseRichDeckEvent } from "../../src/lib/rich-deck-protocol";
import { richAssetReferences } from "../../src/lib/rich-deck-assets";

const root = process.cwd();
let deck: string, plain: string, outside: string;
const created: string[] = [];
const plainHtml = '<!doctype html><html><body><h1>Plain HTML</h1></body></html>';
const files = (name: string) => `/api/rich-decks/${name}/files`;

test.beforeAll(async () => {
  outside = await fs.mkdtemp(path.join(os.tmpdir(), "amaroad-rich-test-"));
  for (const type of ["controller", "plain"]) {
    const directory = await fs.mkdtemp(path.join(root, "decks", `rich-${type}-test-`));
    created.push(directory);
    const name = path.basename(directory);
    if (type === "plain") plain = name; else deck = name;
    await fs.writeFile(path.join(directory, "deck.config.ts"), `export default ${JSON.stringify({
      format: "html", title: type === "plain" ? "Plain HTML fixture" : "Rich HTML fixture",
      createdAt: "2026-10-07", standalone: type === "plain",
    })};`);
    if (type === "plain") { await fs.writeFile(path.join(directory, "index.html"), plainHtml); continue; }
    await fs.mkdir(path.join(directory, "assets"));
    await fs.writeFile(path.join(directory, "assets/theme.css"), "body { background: rgb(9,9,9); color:white; } h1 { color:rgb(255,131,183); }");
    await fs.writeFile(path.join(directory, "assets/state.js"), "export const initial = {slideIndex:0, stepIndex:0, slideCount:2, stepCount:2};");
    await fs.writeFile(path.join(directory, "assets/main.js"), `
      import {initial} from './state.js';
      let state = {...initial};
      const render = () => { document.getElementById('state').textContent = state.slideIndex + '.' + state.stepIndex; dispatchEvent(new Event('amaroad:statechange')); };
      window.amaroadDeck = {
        getState:()=>state,
        getSlides:()=>[{title:'First slide',notes:'First speaker note'},{title:'Second slide',notes:'Second speaker note'}],
        next:()=>{if(state.stepIndex<1)state.stepIndex++;else if(state.slideIndex<1){state.slideIndex++;state.stepIndex=0;}render();},
        previous:()=>{if(state.stepIndex>0)state.stepIndex--;else if(state.slideIndex>0){state.slideIndex--;state.stepIndex=1;}render();},
        goTo:(slideIndex,stepIndex=0)=>{state={...state,slideIndex:Math.min(1,Math.max(0,slideIndex)),stepIndex:Math.min(1,Math.max(0,stepIndex))};render();}
      };
      try { parent.document.body; document.body.dataset.parentBlocked = 'false'; } catch { document.body.dataset.parentBlocked = 'true'; }
      try { localStorage.getItem('test'); document.body.dataset.storageBlocked = 'false'; } catch { document.body.dataset.storageBlocked = 'true'; }
      document.addEventListener('keydown', event => { if(event.key==='ArrowRight'){event.preventDefault();window.amaroadDeck.next();} });
      render();
    `);
    await fs.writeFile(path.join(directory, "index.html"), '<!doctype html><html><head><link rel="stylesheet" href="assets/theme.css"></head><body><h1>Rich fixture</h1><p id="state"></p><script type="module" src="assets/main.js"></script></body></html>');
    await fs.writeFile(path.join(outside, "private.png"), "outside-file-must-not-be-served");
    await fs.symlink(path.join(outside, "private.png"), path.join(directory, "assets/outside.png"));
  }
});

test.afterAll(async () => {
  for (const directory of created) await fs.rm(directory, { recursive: true, force: true });
  if (outside) await fs.rm(outside, { recursive: true, force: true });
});

test("rich catalog is separate and selecting a deck opens its HTML", async ({ page }) => {
  await page.goto("/?mode=rich");
  await expect(page.getByRole("tab", { name: "リッチスライド" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#rich-slides-panel")).toBeVisible();
  await expect(page.locator("#simple-slides-panel")).toBeHidden();
  await page.getByRole("textbox", { name: "リッチスライドを検索" }).fill(deck);
  const card = page.locator(`#rich-slides-panel a[href="/${deck}"]`);
  const cover = card.frameLocator("[data-rich-preview-frame]");
  await expect(cover.locator("h1")).toHaveText("Rich fixture");
  await expect(cover.locator("#state")).toHaveText("0.1");
  await expect(cover.locator("body")).toHaveAttribute("data-amaroad-preview", "true");
  await card.locator("[data-rich-thumbnail]").click();
  await expect(page.locator('[data-rich-status="ready"]')).toBeVisible();
  await expect(page.locator('[data-rich-position]')).toHaveText("1 / 2 · 1 / 2");
  await page.getByRole("link", { name: "リッチスライド一覧へ" }).click();
  await expect(page.getByRole("tab", { name: "リッチスライド" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "シンプルスライド" }).click();
  await expect(page.locator(`#simple-slides-panel a[href="/${deck}"]`)).toHaveCount(0);
  await expect(page.locator('#simple-slides-panel a[href="/sample-deck"]')).toBeVisible();
});

test("preview seeks to the final step after a deferred controller module loads", async ({ page }) => {
  await page.route(`**/api/rich-decks/${deck}/files/assets/main.js`, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto("/?mode=rich");
  await page.getByRole("textbox", { name: "リッチスライドを検索" }).fill(deck);
  const preview = page.locator(`#rich-slides-panel a[href="/${deck}"]`).frameLocator("[data-rich-preview-frame]");
  await expect(preview.locator("#state")).toHaveText("0.1");
  await expect(preview.locator("body")).toHaveAttribute("data-amaroad-preview", "true");
});

test("module scripts and CSS load inside the opaque sandbox; steps cross page boundaries", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`/${deck}`);
  await expect(page.locator('[data-rich-position]')).toHaveText("1 / 2 · 1 / 2");
  const frame = page.frameLocator("[data-rich-main-frame]");
  await expect(frame.locator("h1")).toHaveCSS("color", "rgb(255, 131, 183)");
  await expect(frame.locator("body")).toHaveAttribute("data-parent-blocked", "true");
  await expect(frame.locator("body")).toHaveAttribute("data-storage-blocked", "true");
  await page.getByRole("button", { name: "次の段階へ", exact: true }).click();
  await expect(frame.locator("#state")).toHaveText("0.1");
  await page.getByRole("button", { name: "次の段階へ", exact: true }).click();
  await expect(page.locator('[data-rich-position]')).toHaveText("2 / 2 · 1 / 2");
  await page.getByRole("button", { name: "前の段階へ", exact: true }).click();
  await expect(frame.locator("#state")).toHaveText("0.1");
  await frame.locator("body").click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator('[data-rich-position]')).toHaveText("2 / 2 · 1 / 2");
  expect(errors).toEqual([]);
});

test("fullscreen contains the HTML stage and Escape restores the toolbar", async ({ page }) => {
  await page.goto(`/${deck}`);
  await expect(page.locator('[data-rich-status="ready"]')).toBeVisible();
  await page.getByRole("button", { name: "全画面", exact: true }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement?.hasAttribute("data-rich-stage"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test("plain HTML initializes without a controller and downloads exactly the author file", async ({ page, request }) => {
  await page.goto(`/${plain}`);
  await expect(page.locator('[data-rich-status="ready"]')).toBeVisible();
  await expect(page.frameLocator("[data-rich-main-frame]").getByRole("heading", { name: "Plain HTML", exact: true })).toBeVisible();
  const htmlFrame = page.frames().find((frame) => frame.url().includes(files(plain)));
  expect(await htmlFrame?.evaluate(() => document.compatMode)).toBe("CSS1Compat");
  await expect(page.getByRole("button", { name: "次の段階へ" })).toHaveCount(0);
  const response = await request.get(`${files(plain)}/index.html?download=1`);
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-disposition"]).toContain("attachment;");
  expect(await response.text()).toBe(plainHtml);
  const unsupported = await request.get(`${files(deck)}/index.html?download=1`);
  expect(unsupported.status()).toBe(400);
});

test("private/config files, other HTML entries, outside symlinks, and remote requests are blocked", async ({ request }) => {
  for (const file of ["deck.config.ts", "assets/outside.png", "assets/nested.html", "assets/%00.png", "assets/%2e%2e/%2e%2e/sample-deck/cover.mdx"]) {
    const response = await request.get(`${files(deck)}/${file}`);
    expect(response.status(), file).toBeGreaterThanOrEqual(400);
    expect(await response.text()).not.toContain("outside-file-must-not-be-served");
  }
  const remote = await request.get(`${files(deck)}/index.html`, { headers: { Host: "unshared.example.test" } });
  expect(remote.status()).toBe(404);
  const remotePage = await request.get(`/${deck}`, { headers: { Host: "unshared.example.test" } });
  expect(remotePage.status()).toBe(404);
  expect(await remotePage.text()).not.toContain("Rich HTML fixture");
  const html = await request.get(`${files(deck)}/index.html`);
  expect(html.headers()["content-security-policy"]).toContain("sandbox allow-scripts");
  expect(html.headers()["content-security-policy"]).not.toContain("allow-same-origin");
  const app = await request.get("/");
  expect(app.headers()["x-frame-options"]).toBe("DENY");
  expect(app.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("unrelated windows and malformed controller state cannot replace the viewer status", async ({ page }) => {
  await page.goto(`/${deck}`);
  await expect(page.locator('[data-rich-position]')).toHaveText("1 / 2 · 1 / 2");
  await page.evaluate(() => window.postMessage({ type: "amaroad:rich:event", token: "forged", state: null, capabilities: { next: false, previous: false, goTo: false }, error: "forged error" }, "*"));
  await expect(page.locator('[data-rich-status] [role="alert"]')).toHaveCount(0);
  await expect(page.locator('[data-rich-position]')).toHaveText("1 / 2 · 1 / 2");
  const valid = { type: "amaroad:rich:event", token: "test", state: { slideIndex: 0, stepIndex: 0, slideCount: 2, stepCount: 2 }, capabilities: { next: true, previous: true, goTo: true } };
  expect(parseRichDeckEvent({ ...valid, token: "wrong" }, "test")).toBeNull();
  expect(parseRichDeckEvent({ ...valid, state: { ...valid.state, slideIndex: 2 } }, "test")).toBeNull();
  expect(parseRichDeckEvent({ ...valid, state: { ...valid.state, stepCount: 0 } }, "test")).toBeNull();
});

test("creation provides standalone navigation and refuses to overwrite an existing deck", async ({ page }) => {
  const name = `rich-scaffold-test-${randomUUID()}`;
  const directory = path.join(root, "decks", name);
  const command = path.join(root, "node_modules/.bin/tsx");
  execFileSync(command, ["scripts/amaroad.mts", "init-rich", name, "--title", "Standalone fixture"], { cwd: root });
  created.push(directory);
  const before = await fs.readFile(path.join(directory, "index.html"), "utf8");
  expect(() => execFileSync(command, ["scripts/amaroad.mts", "init-rich", name], { cwd: root, stdio: "pipe" })).toThrow();
  expect(await fs.readFile(path.join(directory, "index.html"), "utf8")).toBe(before);
  await page.goto(`/${name}`);
  await expect(page.locator('[data-rich-position]')).toHaveText("1 / 3 · 1 / 2");
  await page.getByRole("button", { name: "次の段階へ", exact: true }).click();
  await expect(page.locator('[data-rich-position]')).toHaveText("1 / 3 · 2 / 2");
  await expect(page.getByRole("link", { name: "HTMLを保存" })).toBeVisible();
});

test("import dependency detection recognizes valid HTML/CSS paths and preserves source bytes", async ({ request }) => {
  expect(richAssetReferences('<img src=assets/photo.png><style>@import "assets/style.css";body{background:url("assets/my photo.png")}</style>'))
    .toEqual(["assets/photo.png", "assets/my photo.png", "assets/style.css"]);
  const name = `rich-import-test-${randomUUID()}`;
  const source = path.join(outside, "source.html");
  await fs.writeFile(source, plainHtml);
  execFileSync(path.join(root, "node_modules/.bin/tsx"), ["scripts/amaroad.mts", "init-rich", name, "--from", source], { cwd: root });
  created.push(path.join(root, "decks", name));
  expect(await fs.readFile(source, "utf8")).toBe(plainHtml);
  expect(await fs.readFile(path.join(root, "decks", name, "index.html"), "utf8")).toBe(plainHtml);
  expect(await (await request.get(`${files(name)}/index.html?download=1`)).text()).toBe(plainHtml);
});

test("the existing MDX viewer still renders", async ({ page }) => {
  await page.goto("/sample-deck");
  await expect(page.locator('[data-slide-content] [data-mdx-status="ready"]').first()).toBeVisible();
  await expect(page.locator('[data-rich-stage]')).toHaveCount(0);
});

test("rich and simple viewers share the sidebar, stage margins, and resizable notes shell", async ({ page }) => {
  await page.goto(`/${deck}`);
  await expect(page.locator('[data-rich-status="ready"]')).toBeVisible();
  await expect(page.locator('[data-deck-sidebar]')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Presenter Mode', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Slide 2', exact: true })).toBeVisible();
  const richWidth = (await page.locator('[data-deck-sidebar]').boundingBox())?.width;
  const beforeNotes = (await page.locator('[data-rich-stage]').boundingBox())?.width ?? 0;
  await page.getByRole('button', { name: 'Open notes panel' }).click();
  await expect(page.getByText('First speaker note', { exact: true })).toBeVisible();
  await expect.poll(async () => (await page.locator('[data-rich-stage]').boundingBox())?.width ?? 0).toBeLessThan(beforeNotes);
  await page.getByRole('button', { name: 'Slide 2', exact: true }).click();
  await expect(page.getByText('Second speaker note', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Slide 2', exact: true })).toHaveAttribute('aria-current', 'true');
  await expect(page.locator('[data-rich-position]')).toHaveText('2 / 2 · 1 / 2');
  await page.getByRole('button', { name: 'Close notes panel' }).click();
  await page.goto('/sample-deck');
  await expect(page.locator('[data-viewer-layout]')).toBeVisible();
  expect((await page.locator('[data-deck-sidebar]').boundingBox())?.width).toBe(richWidth);
  await expect(page.getByRole('button', { name: 'Presenter Mode', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open notes panel' }).click();
  await expect(page.getByRole('button', { name: 'Close notes panel' })).toBeVisible();
});

test("sidebar previews do not change the main state; overview links seek to a page", async ({ page }) => {
  await page.goto(`/${deck}`);
  await expect(page.locator('[data-rich-position]')).toHaveText('1 / 2 · 1 / 2');
  await expect(page.locator('[data-rich-preview-frame]')).toHaveCount(2);
  await expect.poll(async () => {
    const frame = page.frames().filter(frame => frame.url().includes(files(deck)))[2];
    return frame?.locator('#state').innerText();
  }).toBe('1.1');
  await expect(page.locator('[data-rich-position]')).toHaveText('1 / 2 · 1 / 2');
  await page.goto(`/${deck}/thumbnails`);
  await page.getByRole('button', { name: 'Slide 2', exact: true }).click();
  await expect(page.locator('[data-rich-position]')).toHaveText('2 / 2 · 1 / 2');
});

test("presenter mode has no app panels and synchronizes pages and reveal steps", async ({ page }) => {
  await page.goto(`/${deck}`);
  await expect(page.locator('[data-rich-status="ready"]')).toBeVisible();
  await page.getByRole('button', { name: '次の段階へ', exact: true }).click();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Presenter Mode', exact: true }).click();
  const presenter = await popupPromise;
  await expect(presenter.locator('[data-rich-position]')).toHaveText('1 / 2 · 2 / 2');
  await expect(presenter.locator('[data-deck-sidebar]')).toHaveCount(0);
  await expect(presenter.getByRole('button', { name: 'Open notes panel' })).toHaveCount(0);
  await page.getByRole('button', { name: '次の段階へ', exact: true }).click();
  await expect(presenter.locator('[data-rich-position]')).toHaveText('2 / 2 · 1 / 2');
  await presenter.frameLocator('[data-rich-main-frame]').locator('body').click();
  await presenter.keyboard.press('ArrowRight');
  await expect(page.locator('[data-rich-position]')).toHaveText('2 / 2 · 2 / 2');
  await presenter.close();
});
