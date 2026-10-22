# Amaroad Rich Sample Deck

Open `http://127.0.0.1:3850/sample-rich-deck`, or select the deck in the Rich slides tab.
This bundled sample is a standalone HTML document with Three.js, Figtree, and a
generated GLB model embedded. Its Japanese font stack falls back to system fonts.

The 12 pages demonstrate:

1. A real-time Three.js cover sculpture
2. Free typography and composition
3. Reveal steps and reverse navigation
4. Three.js geometry, metal materials, and studio lighting
5. An animated `InstancedMesh` with 180 instances
6. A 3D bar chart with explicitly illustrative data
7. An SVG relationship diagram
8. A draggable/zoomable `OrbitControls` scene
9. A generated GLB loaded through `GLTFLoader`, with an exploded view
10. Layered HTML/CSS composition
11. An interactive material roughness slider
12. A Three.js ending sculpture

All pages have speaker notes. The same `window.amaroadDeck` controller powers
standalone navigation, sidebar page selection, reveal steps, and presenter sync.
`getDiagnostics()` exposes active demo, draw calls, triangle counts, model mesh
count, preview state, and animation-loop state for verification.

The document lazily creates one WebGLRenderer and reuses it across all 3D pages.
It stops its loop on 2D pages, in previews, when hidden, and when reduced motion
is requested. Preview rendering uses a fixed pose and lower pixel ratio.
OrbitControls are enabled only on the interactive page. Geometries, materials,
controls, environment targets, and the renderer are disposed on teardown.

Text uses four finite native Web Animations API effects: character stamps,
horizontal mask reveals, character flips, and character-by-character typing.
Each page selects its heading effect, and body copy animates only when its reveal
step becomes visible. Leaving a page or reversing a step cancels its motions.
Previews, reduced motion, and hidden documents show complete static text.
`getMotionDiagnostics()` reports the effect types and active text animations.

To update the embedded Three.js modules:

```bash
pnpm amaroad add-three sample-rich-deck --addons environments/RoomEnvironment.js
```

Validate with `pnpm --silent amaroad doctor sample-rich-deck`. The HTML can also
be saved from the viewer and opened directly with no server or network connection.
Three.js's MIT notice and Figtree's SIL Open Font License are included in the HTML.
