# Rich HTML slides

Rich decks are HTML documents. Their CSS, fonts, layout, SVG, canvas, and JavaScript
belong to the deck. The app provides discovery, viewing, fullscreen, sharing, and
an optional navigation bridge. MDX components and MDX layout rules are not applied.

## Create or import

```bash
pnpm amaroad init-rich my-rich-deck --title "My presentation"
pnpm amaroad init-rich imported-deck --title "Imported presentation" --from /path/to/deck.html
```

The command refuses an existing directory. Import copies the source HTML exactly
unless an optional integration such as `--three` is requested, and never changes
the original file. Edit the resulting `index.html` with your
coding agent or editor, then reload the viewer.

```text
decks/my-rich-deck/
  deck.config.ts
  index.html
  assets/            # optional; copy imported assets here too
```

The config is a plain default export; an MDX theme is not required:

```ts
export default {
  format: "html",
  title: "My presentation",
  createdAt: "2026-10-07",
  standalone: true,
};
```

Open the Rich slides tab at `/?mode=rich`, or the deck at `/my-rich-deck`.
The deck catalog shows the first page as its cover thumbnail. Controller-based
decks show all reveal steps on that page. Cover thumbnails use preview mode and
load only near the viewport, releasing their HTML document when they leave view.
The desktop viewer uses the same sidebar, centered slide stage, theme toggle,
and resizable notes panel as Simple slides. The sidebar contains page previews,
sharing, HTML download, overview, reveal-step controls, and Presenter Mode.
The fullscreen button shows only the HTML stage. Presenter Mode opens a separate
window and synchronizes both page and reveal-step indices with the viewer.

## Assets and standalone files

Use embedded data URLs, inline CSS/JavaScript, or relative local asset paths such
as `assets/photo.png`, `assets/theme.css`, and `assets/main.js`. Local ES modules
and fonts are served with CORS headers for the sandboxed document. External CDN
scripts, external fonts, external asset requests, and nested iframes are blocked.
External links can open in a new tab. Use local bundles when a deck needs a library.

`standalone: true` means all render dependencies are embedded in `index.html`.
Only these decks show the HTML download button. Downloads contain the original
HTML, without the app's injected bridge. Decks with separate assets can be viewed
and shared, but must be distributed with their asset directory. The import
command derives the initial standalone flag from static asset references; doctor
and an offline browser check should be used before distributing a file.

HTML is served only from `index.html`. Configs, dotfiles, unsupported file types,
paths outside the deck, and symlinks to files outside the deck are not served.
Public tunnel requests are limited to the currently shared deck, as with MDX.

## Three.js

Enable Three.js in an existing HTML deck, or include it when creating one:

```bash
pnpm amaroad add-three my-rich-deck
pnpm amaroad init-rich my-3d-deck --three
```

The command embeds the installed Three.js version (currently 0.186.1),
OrbitControls, GLTFLoader, and WebGL capability checks as browser ES modules in an
inline import map. Modules and the MIT license notice are stored inside the HTML,
so rendering needs no CDN and a self-contained deck can still be downloaded and
opened offline. Existing unrelated import mappings and attributes are preserved;
conflicting custom Three.js mappings are refused rather than overwritten.
Re-running `add-three` updates the generated mappings to the installed version.

Use ordinary module imports in `index.html`:

```html
<script type="module">
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  import WebGL from 'three/addons/capabilities/WebGL.js';

  // Use WebGL.isWebGL2Available() before creating a renderer when a fallback is needed.
  const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('three-canvas'), antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // Add your scene, camera, meshes, lights, and controls here.
</script>
```

Create and size the canvas in the slide. Keep its drawing-buffer size in sync with
its display size using `renderer.setSize(width, height, false)`, update the camera
aspect, and call `camera.updateProjectionMatrix()` after resizing. Use one shared
renderer per HTML document when possible, and stop its animation loop while a 3D
page is inactive. Current WebGLRenderer requires a browser with WebGL2.

Additional WebGL-compatible addons can be embedded by path, including their local
JavaScript dependencies:

```bash
pnpm amaroad add-three my-rich-deck --addons renderers/CSS3DRenderer.js,postprocessing/EffectComposer.js
pnpm amaroad init-rich my-3d-deck --three --addons renderers/CSS3DRenderer.js
```

Paths are relative to `three/addons/`. Addons that need external packages,
WebGPU/TSL entries, workers, or WASM decoders require separate integration; those
capabilities are not enabled by this command. The default GLTFLoader supports
ordinary, uncompressed glTF/GLB. The viewer serves `.gltf`, `.glb`, and `.bin`
files under the deck's asset directory, with the same path/access restrictions as
other assets. Embedded `data:` or `blob:` models are supported too. Separate model
or texture files make a deck non-standalone unless they are embedded as well.

Three.js animation should respond to preview mode immediately and when it changes:

```js
function updateAnimationMode() {
  if (document.body.dataset.amaroadPreview === 'true') {
    renderer.setAnimationLoop(null);
    renderer.render(scene, camera);
  } else {
    renderer.setAnimationLoop(renderFrame);
  }
}
window.addEventListener('amaroad:previewchange', updateAnimationMode);
updateAnimationMode(); // Preview mode may have been set before an async module loaded.
```

On teardown, stop the loop, call `controls.dispose()`, dispose geometries,
materials and textures, then call `renderer.dispose()` (and release the context
with `renderer.forceContextLoss()` when the canvas is permanently removed).
The HTML sandbox stays isolated; this integration does not enable
`allow-same-origin`, `unsafe-eval`, or external network hosts.

## Optional navigation interface

An ordinary HTML document works with its own controls. To enable the app's
previous/next buttons and page status, expose this controller:

```js
window.amaroadDeck = {
  getState() {
    return { slideIndex, stepIndex, slideCount, stepCount };
  },
  getSlides() {
    return [{ title: "Introduction", notes: "Speaker notes" } /* ...one item per page... */];
  },
  next() { /* reveal the next step, then advance the page */ },
  previous() { /* reverse a step, then return to the previous page */ },
  goTo(slideIndex, stepIndex = 0) { /* clamp indices and render the requested state */ },
};
```

Indices are zero-based. `slideCount` is the total number of pages, and `stepCount`
is the number of states on the current page (including its initial state).
For two reveal steps, the valid `stepIndex` values are 0, 1, and 2, with
`stepCount: 3`. Return only finite integer counts and valid indices.

After rendering a state, optionally send `dispatchEvent(new Event("amaroad:statechange"))`
for immediate updates. The bridge also checks for state changes periodically.
The app's Home/End navigation is available when `goTo` is implemented. The HTML
owns its own keyboard handling while focus is inside the iframe.

`getSlides()` is optional. Its titles and notes populate the sidebar and Notes
panel. Without it, a matching set of `.scene` or `[data-slide]` elements supplies
`data-title` and optional `data-notes`; otherwise pages receive numbered labels.
Sidebar previews render separate, lazily loaded HTML instances, so selecting or
rendering a preview never advances the main presentation. CSS and SVG motion is
paused in previews. Custom JavaScript animation can detect
`document.body.dataset.amaroadPreview === "true"` to stop its own animation loop.
The bridge also dispatches `amaroad:previewchange` when preview mode begins.

The app hides `#controls`, `#start-hint`, and `[data-amaroad-controls]` in embedded
documents with a navigation controller; the standalone author file keeps them.
Use the marker on standalone-only controls. Existing documents without a
controller keep their own controls.

The earlier `window.deck` controller is also recognized when `getState()` returns
`{ scene, step, totalScenes, maxStep }` (one-based scene, zero-based step).
If `goTo` is absent but `next` and `previous` exist, the bridge seeks by advancing
or reversing steps, with a limit and a check that each operation changes position.
This enables page previews and presenter synchronization for older HTML decks.

The served HTML receives a bridge that communicates via `postMessage`. It checks
the parent window and its origin; the app checks the exact frame, opaque origin,
session token, and message shape. Author code should use the controller interface
above rather than accessing the app DOM or storage. The child sandbox deliberately
omits `allow-same-origin`.

## Authoring and validation

The template provides a responsive 16:9 stage, reveal steps, reduced-motion CSS,
navigation, and the controller. Other dimensions and layouts are allowed; make
the HTML fit its viewport. Stop or pause animations on inactive pages, and decide
explicitly how animation resets when returning to a page.

```bash
pnpm --silent amaroad doctor my-rich-deck
pnpm --silent amaroad doctor my-rich-deck --skip html  # without a running server
```

HTML doctor checks the config, entry file, referenced local assets, standalone
dependencies, and browser initialization/runtime errors. MDX font floors,
safe-zone padding, card rules, notes, and manifests are not checked for HTML.
Static dependency checks are not a complete JavaScript dependency analysis;
exercise the deck in a browser, including later pages and offline use.

HTML mode supports viewing, sidebar previews, page overview, speaker notes,
presenter synchronization, navigation, fullscreen, sharing, and standalone HTML
download. Static thumbnail image export, PDF/PPTX output, and narration for HTML
decks are not implemented yet. App-integrated page controls require the navigation
controller; ordinary HTML remains viewable with its own controls.

Run the HTML integration tests with `pnpm test:rich`. To reuse a running development
server, use `BASE_URL=http://127.0.0.1:3850 pnpm test:rich`.
