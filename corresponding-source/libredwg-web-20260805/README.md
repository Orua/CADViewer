# LibreDWG Web corresponding source

This directory contains the source corresponding to the LibreDWG WebAssembly and JavaScript files distributed by Golden Luck CADViewer.

## Contents

- `src/`, `include/`, `programs/`: GNU LibreDWG source from tag `0.14.8556` (`e405fcff2eaff86b8389222b7e99529284e7ea0a`)
- `embind/`: C++/Embind interface used by `mlightcad/libredwg-web`
- `javascript/`: JavaScript/TypeScript package based on `mlightcad/libredwg-web` tag `v0.7.9` (`b70b5573a6bf2345e5fb10f2adff7fb74a8123c5`), including Golden Luck modifications
- `COPYING`: GNU GPL version 3 licence text
- `AUTHORS`: upstream author information
- `build-wasm.ps1`: reproducible Windows/Emscripten build entry point

## Native/WebAssembly build

Install and activate Emscripten `6.0.5`, then run from PowerShell:

```powershell
.\build-wasm.ps1 -OutputDirectory C:\path\to\output
```

The script compiles the selected read-only LibreDWG parser sources with write, DXF and JSON support disabled, then links the Embind module with memory growth enabled, a 1 GiB initial heap, a 4 GiB maximum heap and mimalloc.

## JavaScript package build

After the WebAssembly build, copy `libredwg-web.js` and `libredwg-web.wasm` into `javascript/wasm/`, then run:

```powershell
Set-Location .\javascript
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

The generated package is written to `javascript/dist/`.

## Licence

This corresponding source is provided under GPL-3.0-or-later, subject to the notices and licence files retained in this directory and the repository root.
