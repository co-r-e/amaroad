# Third-Party Notices

Last updated: 2026-03-02

This file provides third-party license notices for dependencies used by Amaroad.

- Project license: [MIT](./LICENSE)
- Package manager: npm
- Lockfile basis: `package-lock.json`

## Scope

This notice is based on packages listed in `package-lock.json`.
Some packages are platform-specific optional binaries (for example, `@img/*`) and may not be installed on every environment.

## License Summary (from lockfile)

<!-- BEGIN_AUTOGEN:LICENSE_SUMMARY -->
- Cross-platform package entries: 629
- Platform-specific binary families: 8
- Generated from: `node_modules/.pnpm` (via `pnpm install`)
- Counts exclude platform-optional binaries, which are grouped by family in the Notice-Relevant table below.

| License expression | Package count |
| --- | ---: |
| MIT | 529 |
| ISC | 31 |
| Apache-2.0 | 30 |
| BSD-3-Clause | 17 |
| BSD-2-Clause | 9 |
| (MIT AND Zlib) | 2 |
| MPL-2.0 | 2 |
| (MIT OR GPL-3.0-or-later) | 1 |
| (MPL-2.0 OR Apache-2.0) | 1 |
| 0BSD | 1 |
| BlueOak-1.0.0 | 1 |
| CC-BY-4.0 | 1 |
| CC0-1.0 | 1 |
| MIT AND ISC | 1 |
| MIT OR SEE LICENSE IN FEEL-FREE.md | 1 |
| Python-2.0 | 1 |
<!-- END_AUTOGEN:LICENSE_SUMMARY -->

## Dual-License Selection

Where a dependency offers multiple license options, Amaroad uses the following options for redistribution compliance:

- `jszip@3.10.1`: `(MIT OR GPL-3.0-or-later)` -> **MIT option selected**
- `dompurify@3.3.1`: `(MPL-2.0 OR Apache-2.0)` -> **Apache-2.0 option selected**

## Notice-Relevant Dependencies

The following dependencies have notice/copyleft considerations and should be reviewed when distributing binaries or bundled artifacts.

<!-- BEGIN_AUTOGEN:NOTICE_RELEVANT -->
| Package (family) | Version(s) in lockfile | License |
| --- | --- | --- |
| `caniuse-lite` | `1.0.30001788` | `CC-BY-4.0` |
| `axe-core` | `4.11.3` | `MPL-2.0` |
| `lightningcss` | `1.32.0` | `MPL-2.0` |
| `sharp` | `0.34.5` | `Apache-2.0` |
| `@esbuild/*` platform binaries | `0.27.7` | `MIT` |
| `@img/sharp-*` platform binaries | `0.34.5` | `Apache-2.0` |
| `@img/sharp-libvips-*` platform binaries | `1.2.4` | `LGPL-3.0-or-later` |
| `@next/swc-*` platform binaries | `16.2.3` | `MIT` |
| `@tailwindcss/oxide-*` platform binaries | `4.2.2` | `MIT` |
| `@unrs/resolver-binding-*` platform binaries | `1.11.1` | `MIT` |
| `fsevents` platform binaries | `2.3.2, 2.3.3` | `MIT` |
| `lightningcss-*` platform binaries | `1.32.0` | `MPL-2.0` |
<!-- END_AUTOGEN:NOTICE_RELEVANT -->

## Upstream License and Source References

Primary upstream locations for the packages above:

- caniuse-lite: https://github.com/browserslist/caniuse-lite
- axe-core: https://github.com/dequelabs/axe-core
- lightningcss: https://github.com/parcel-bundler/lightningcss
- sharp / libvips binaries: https://github.com/lovell/sharp and https://github.com/libvips/libvips
- jszip: https://github.com/Stuk/jszip
- DOMPurify: https://github.com/cure53/DOMPurify

When distributing artifacts, include applicable upstream license texts from installed modules (typically `node_modules/<pkg>/LICENSE*`).

## Regeneration

Update and check notices with:

```bash
pnpm notices:update
pnpm notices:check
```

## Disclaimer

This notice is provided for operational transparency and is not legal advice.
For legal interpretation of license obligations, consult qualified counsel.
