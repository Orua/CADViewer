# Corresponding source and build information

This repository distributes WebAssembly and JavaScript derived from GNU LibreDWG and `mlightcad/libredwg-web`. The matching source used for the distributed build is included at:

`corresponding-source/libredwg-web-20260805/`

## Source versions

- GNU LibreDWG: tag `0.14.8556`, commit `e405fcff2eaff86b8389222b7e99529284e7ea0a`
- `mlightcad/libredwg-web`: tag `v0.7.9`, base commit `b70b5573a6bf2345e5fb10f2adff7fb74a8123c5`
- Golden Luck modifications: progressive conversion and large-file browser handling, marked in the modified TypeScript source
- Build toolchain: Emscripten `6.0.5`

## Distributed file checksums

SHA-256 checksums for the files distributed in `cad-viewer/wasm/`:

| File | SHA-256 |
| --- | --- |
| `libredwg-web.wasm` | `6FFD78D6CE4D356E31530365D6017B16F2B007400A4A6B7E08F1F8BDA601714B` |
| `libredwg-web.js` | `3954BBEFFC83712FF722B4C0BA0A850D758478C9B7BE0ACF6705E25B60E7293A` |
| `libredwg-web` JavaScript binding bundle | `E23103E334AAE2D9AFB93470B8EBB1A4B79886DE429C2195E06E1112D0F1944F` |

The JavaScript binding bundle is distributed as `cad-viewer/bindings/libredwg-web.js`.

## Rebuilding

See `corresponding-source/libredwg-web-20260805/README.md`. Its `build-wasm.ps1` script rebuilds the native LibreDWG/Embind layer with the documented Emscripten settings. The JavaScript package is rebuilt with the checked-in lockfile.

## Other native component

The 3D importer is `occt-import-js` `0.0.23` at commit `c2148e54b456b571238d35cac037d304053d64b2`, incorporating Open CASCADE Technology at commit `d2abb6d844231cb8f29be6894440874a4700e4a5`. Its published source is available from the upstream repository and its retained licence and exception notices are under `cad-viewer/vendor/occt-import-js/`.

| Distributed file | SHA-256 |
| --- | --- |
| `occt-import-js.js` | `3FB44CE11D00611F9B3F3C5775D520EBAB48930C1F08279B7B1316F05F0D3379` |
| `occt-import-js.wasm` | `33391FC9D94EA5C869A6718488BF0A9A464222BAC9BDC764DFE1690CEF281952` |
| `occt-import-js-worker.js` | `82A522FF94E1476E073B070B46B0AF6EE0BCBF99723328CF867FB69C4B95D5CF` |
| `font-engine.js` | `52A19A5BB5AE4B3CC833DB911FB331617E25082000AE320B447A03E49A384A98` |

This document is an engineering record of the distributed source and notices; it is not legal advice.
