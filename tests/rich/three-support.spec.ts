import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const command = path.join(root, "node_modules/.bin/tsx");
let directory: string, temporary: string, name: string, source: string;
const run = (...args: string[]) => execFileSync(command, ["scripts/amaroad.mts", ...args], { cwd: root, stdio: "pipe" });

function modelBuffers() {
  const positions = [-.5, -.5, 0, .5, -.5, 0, 0, .5, 0];
  const binary = Buffer.alloc(36);
  positions.forEach((value, index) => binary.writeFloatLE(value, index * 4));
  const json = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: binary.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: "VEC3", min: [-.5, -.5, 0], max: [.5, .5, 0] }],
  };
  const text = Buffer.from(JSON.stringify(json));
  const padded = Buffer.alloc(Math.ceil(text.length / 4) * 4, 0x20);
  text.copy(padded);
  const glb = Buffer.alloc(12 + 8 + padded.length + 8 + binary.length);
  glb.writeUInt32LE(0x46546c67, 0); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8);
  glb.writeUInt32LE(padded.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); padded.copy(glb, 20);
  const offset = 20 + padded.length;
  glb.writeUInt32LE(binary.length, offset); glb.writeUInt32LE(0x004e4942, offset + 4); binary.copy(glb, offset + 8);
  const gltf = { ...json, buffers: [{ byteLength: binary.length, uri: "triangle.bin" }] };
  return { binary, glb, gltf };
}

test.beforeAll(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), "amaroad-three-test-"));
  name = `rich-three-test-${randomUUID()}`;
  directory = path.join(root, "decks", name);
  const model = modelBuffers();
  source = path.join(temporary, "source.html");
  const html = `<!doctype html><html><head><title>Three fixture</title><style>body{margin:0;background:#111;color:#fff}canvas{width:160px;height:160px}pre{font-size:20px}</style></head><body>
    <canvas id="scene"></canvas><pre id="probe"></pre>
    <script>window.amaroadDeck={getState:()=>({slideIndex:0,stepIndex:0,slideCount:1,stepCount:1}),getSlides:()=>[{title:'Three fixture'}],next(){},previous(){},goTo(){}};</script>
    <script type="module">
      import * as THREE from 'three';
      import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
      import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
      import {CSS3DRenderer} from 'three/addons/renderers/CSS3DRenderer.js';
      const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('scene'),preserveDrawingBuffer:true});
      renderer.setPixelRatio(1);renderer.setSize(160,160,false);
      const scene=new THREE.Scene();scene.background=new THREE.Color(0x111111);
      const camera=new THREE.PerspectiveCamera(45,1,.1,100);camera.position.z=3;
      const geometry=new THREE.BoxGeometry(1,1,1),material=new THREE.MeshBasicMaterial({color:0xff3333});
      const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
      const controls=new OrbitControls(camera,renderer.domElement);
      const draw=()=>renderer.render(scene,camera);
      function mode(){if(document.body.dataset.amaroadPreview==='true'){renderer.setAnimationLoop(null);draw();document.body.dataset.previewStopped='true';}else renderer.setAnimationLoop(draw);}
      addEventListener('amaroad:previewchange',mode);mode();
      const model=await new GLTFLoader().loadAsync('data:model/gltf-binary;base64,${model.glb.toString("base64")}');
      draw();
      const gl=renderer.getContext(),pixel=new Uint8Array(4);gl.readPixels(80,80,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);
      document.getElementById('probe').textContent=JSON.stringify({revision:THREE.REVISION,webgl2:gl instanceof WebGL2RenderingContext,pixel:[...pixel],triangles:renderer.info.render.triangles,modelMeshes:model.scene.children.length,controls:typeof OrbitControls,extraAddon:typeof CSS3DRenderer});
      document.getElementById('probe').dataset.ready='true';
      addEventListener('pagehide',()=>{renderer.setAnimationLoop(null);controls.dispose();geometry.dispose();material.dispose();renderer.dispose();renderer.forceContextLoss();});
    </script></body></html>`;
  await fs.writeFile(source, html);
  run("init-rich", name, "--from", source, "--three", "--addons", "renderers/CSS3DRenderer.js");
  await fs.mkdir(path.join(directory, "assets"));
  await fs.writeFile(path.join(directory, "assets/triangle.glb"), model.glb);
  await fs.writeFile(path.join(directory, "assets/triangle.gltf"), JSON.stringify(model.gltf));
  await fs.writeFile(path.join(directory, "assets/triangle.bin"), model.binary);
});

test.afterAll(async () => {
  if (directory) await fs.rm(directory, { recursive: true, force: true });
  if (temporary) await fs.rm(temporary, { recursive: true, force: true });
});

test("embedded Three.js draws WebGL pixels and loads a GLB in the sandbox; previews stop the render loop", async ({ page, request }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/${name}`);
  const frame = page.frameLocator('[data-rich-main-frame]');
  await expect(frame.locator('#probe')).toHaveAttribute('data-ready', 'true');
  const result = JSON.parse(await frame.locator('#probe').innerText());
  expect(result.webgl2).toBe(true);
  expect(result.revision).toBe('187');
  expect(result.pixel[0]).toBeGreaterThan(200);
  expect(result.pixel[1]).toBeLessThan(120);
  expect(result.triangles).toBeGreaterThan(0);
  expect(result.modelMeshes).toBe(1);
  expect(result.controls).toBe('function');
  expect(result.extraAddon).toBe('function');
  await expect(page.frameLocator('[data-rich-preview-frame]').locator('body')).toHaveAttribute('data-preview-stopped', 'true');
  for (const [extension, mime] of [['glb','model/gltf-binary'],['gltf','model/gltf+json'],['bin','application/octet-stream']]) {
    const response=await request.get(`/api/rich-decks/${name}/files/assets/triangle.${extension}`);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()['content-type']).toBe(mime);
  }
  expect(errors).toEqual([]);
});

test("standalone Three.js HTML opens offline, with its original content and bundled MIT notice", async ({ browser, request }) => {
  const response=await request.get(`/api/rich-decks/${name}/files/index.html?download=1`);
  expect(response.ok()).toBeTruthy();
  const html=await response.text();
  expect(html.match(/data-amaroad-three="([^"]+)"/)?.[1]).toBe('0.187.0');
  expect(html).toContain('Copyright © 2010-2026 three.js authors');
  expect(html).not.toContain('data-amaroad-bridge');
  expect(html).toContain("import * as THREE from 'three'");
  const offlineFile=path.join(temporary,'offline.html');
  await fs.writeFile(offlineFile,html);
  const context=await browser.newContext({offline:true});
  try {
    const page=await context.newPage();
    await page.goto(`file://${offlineFile}`);
    await expect(page.locator('#probe')).toHaveAttribute('data-ready','true');
    expect(JSON.parse(await page.locator('#probe').innerText()).webgl2).toBe(true);
  } finally {await context.close();}
  expect(await fs.readFile(source,'utf8')).not.toContain('data-amaroad-three');
});

test("adding Three.js is idempotent, preserves custom import maps, and refuses conflicts", async () => {
  const file=path.join(directory,'index.html');
  const before=await fs.readFile(file,'utf8');
  run('add-three',name,'--addons','renderers/CSS3DRenderer.js');
  expect(await fs.readFile(file,'utf8')).toBe(before);
  const extra=path.join(root,'decks',`rich-three-mapping-test-${randomUUID()}`);
  try {
    await fs.mkdir(extra);
    await fs.writeFile(path.join(extra,'deck.config.ts'),'export default {format:"html",title:"Import map fixture",createdAt:"2026-10-07",standalone:true}');
    const customModule="data:text/javascript,export const x='$&'";
    const original=`<!doctype html><html><head><script id="custom-map" type="importmap">${JSON.stringify({imports:{custom:customModule}})}</script></head><body>Keep this content</body></html>`;
    await fs.writeFile(path.join(extra,'index.html'),original);
    run('add-three',path.basename(extra));
    const updated=await fs.readFile(path.join(extra,'index.html'),'utf8');
    expect(updated).toContain('Keep this content');
    expect(updated).toContain(customModule);
    expect(updated).toContain('id="custom-map"');
    const conflict=original.replace('"custom"','"three"');
    await fs.writeFile(path.join(extra,'index.html'),conflict);
    expect(()=>run('add-three',path.basename(extra))).toThrow();
    expect(await fs.readFile(path.join(extra,'index.html'),'utf8')).toBe(conflict);
  } finally {await fs.rm(extra,{recursive:true,force:true});}
});
