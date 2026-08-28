# Third-party notices

## mlightcad/cad-viewer

This project is derived from [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer), which is distributed under the MIT License. The retained license text is in [`LICENSES/MIT.txt`](LICENSES/MIT.txt).

## LibreDWG WebAssembly parser

The following bundled runtime files are from or derived from [mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web) and [GNU LibreDWG](https://github.com/LibreDWG/libredwg):

- `cad-viewer/wasm/libredwg-web.js`
- `cad-viewer/wasm/libredwg-web.wasm`
- `cad-viewer/bindings/libredwg-web.js`

These components are distributed under GPL-3.0-or-later. The licence text is in [`LICENSES/GPL-3.0-or-later.txt`](LICENSES/GPL-3.0-or-later.txt).

The bundled build is pinned to GNU LibreDWG `0.14.8556` (`e405fcff2eaff86b8389222b7e99529284e7ea0a`) and mlightcad/libredwg-web `v0.7.9` (`b70b5573a6bf2345e5fb10f2adff7fb74a8123c5`), plus the Golden Luck progressive-viewer modifications. The complete source subset used for the build, build instructions and artifact hashes are retained under [`corresponding-source/libredwg-web-20260805/`](corresponding-source/libredwg-web-20260805/) and documented in [`CORRESPONDING_SOURCE.md`](CORRESPONDING_SOURCE.md).

## OpenCascade model importer

STEP, STP, IGES, IGS, BREP, and BRP files are imported by occt-import-js 0.0.23 and Open CASCADE Technology in a browser Web Worker. The bundled runtime files are:

- cad-viewer/vendor/occt-import-js/occt-import-js.js
- cad-viewer/vendor/occt-import-js/occt-import-js.wasm
- cad-viewer/vendor/occt-import-js/occt-import-js-worker.js

occt-import-js and the bundled Open CASCADE runtime are distributed under LGPL-2.1. Open CASCADE is also covered by its published LGPL exception. The licence texts and exception are retained beside the runtime as `license.occt-import-js.txt`, `license.occt.txt`, and `OCCT_LGPL_EXCEPTION.txt`.

The bundled runtime corresponds to occt-import-js tag `0.0.23` (`c2148e54b456b571238d35cac037d304053d64b2`) and its Open CASCADE submodule commit `d2abb6d844231cb8f29be6894440874a4700e4a5`. Exact source links and runtime hashes are recorded in [`CORRESPONDING_SOURCE.md`](CORRESPONDING_SOURCE.md).

## SHX parser

The bundled SHX parsing code retains its license notice at `cad-viewer/vendor/shx-parser-LICENSE.txt`.

## Bundled JavaScript libraries

`cad-viewer/font-engine.js` includes `@mlightcad/shx-parser`, `iconv-lite`, `buffer`, `ieee754`, and `safe-buffer`. Its generated licence banner and the separate SHX parser MIT notice must remain intact when redistributing the bundle.

## Fonts

The self-hosted public font sample under `cad-data/open/fonts/` contains only Basic, Tenor Sans and VT323. Their SIL Open Font License texts are retained under `cad-data/open/licenses/`; source metadata is recorded in `cad-data/open/README.md` and `cad-data/open/manifest.json`. Other locally installed CAD fonts are intentionally excluded because their redistribution rights have not been established.
