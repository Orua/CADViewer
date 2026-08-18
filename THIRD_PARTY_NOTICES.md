# Third-party notices

## mlightcad/cad-viewer

This project is derived from [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer), which is distributed under the MIT License. The retained license text is in [`LICENSES/MIT.txt`](LICENSES/MIT.txt).

## LibreDWG WebAssembly parser

The following bundled runtime files are from or derived from [mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web) and [GNU LibreDWG](https://github.com/LibreDWG/libredwg):

- `cad-viewer/wasm/libredwg-web.js`
- `cad-viewer/wasm/libredwg-web.wasm`
- `cad-viewer/bindings/libredwg-web.js`

These components are distributed under GPL-3.0-or-later. The license text is in [`LICENSES/GPL-3.0-or-later.txt`](LICENSES/GPL-3.0-or-later.txt). Source code and JavaScript/WebAssembly build instructions are available from the linked upstream repositories, including the [JavaScript bindings documentation](https://github.com/mlightcad/libredwg-web/tree/master/bindings/javascript).

The exact upstream commit used to build the currently bundled WASM binary was not recorded in this fork. For reproducible redistribution, rebuild these artifacts from a pinned upstream commit and record that commit with the release.

## SHX parser

The bundled SHX parsing code retains its license notice at `cad-viewer/vendor/shx-parser-LICENSE.txt`.

## Bundled JavaScript libraries

`cad-viewer/viewer-runtime.iife.js` and `cad-viewer/font-engine.js` include third-party JavaScript libraries such as Three.js, `@mlightcad/shx-parser`, `iconv-lite`, `ieee754`, and `safe-buffer`. Their copyright and license banners are retained inside the generated bundles. The bundles must not be redistributed with those notices removed.

## Fonts

The small public font sample under `cad-data/open/fonts/` contains only files accompanied by their individual SIL Open Font License notices and source metadata. Other locally installed CAD fonts are intentionally excluded because their redistribution rights have not been established.
