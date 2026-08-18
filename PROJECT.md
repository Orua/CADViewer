# CADViewer architecture and self-hosting

## Overview

CADViewer is a browser-only, read-only DWG/DXF viewer derived from [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer). It focuses on opening large drawings quickly with progressive rendering and reduced main-thread memory pressure.

- Local files are parsed in the browser by a Web Worker and LibreDWG WebAssembly.
- The worker emits lightweight batches instead of building a complete JavaScript CAD database.
- Canvas 2D renders outlines first, then curves, dimensions, text, hatches, and block references.
- Fonts are loaded after geometry and only when the drawing requires them.
- The viewer supports local files, same-origin `?file=` URLs, recent-file history, pan, zoom, fit-to-view, zoom window, and background switching.

The project intentionally omits the upstream editing, selection, and plugin systems. Proxy objects, external images, and uncommon custom entities may not render.

## Public and offline font configuration

`cad-viewer/viewer-config.js` is the public configuration. Local development uses the repository's relative `cad-data` directory, while public hosts use the configured public CDN.

For an offline or private-network deployment, copy `cad-viewer/viewer-config.local.js` to `viewer-config.js` in the deployment copy. This keeps font requests on the same server and avoids a public-network dependency.

Configuration priority is:

1. URL query parameter `?data=<encoded URL>`.
2. `window.CAD_VIEWER_CONFIG.dataBaseUrl` defined before `viewer-config.js` loads.
3. The environment default in `viewer-config.js`.

The DATA endpoint must provide `fonts/fonts.json` and the font files referenced by that manifest. Cross-origin endpoints must enable CORS.

## Generic deployment checklist

1. Copy the runtime files under `cad-viewer/` to a static web server.
2. Use the local configuration template for offline/private deployments.
3. Configure the server to return `.wasm` as `application/wasm`.
4. Verify that the page, worker, JavaScript bindings, and WASM return HTTP 200.
5. Open a representative DWG and verify geometry, text, toolbar, pan, and zoom.
6. Do not publish business drawings, browser history, logs, backups, or fonts without redistribution permission.

Deployment credentials, hostnames, internal paths, and organization-specific procedures do not belong in this public repository.

## Repository relationships

- Fork: [Orua/CADViewer](https://github.com/Orua/CADViewer)
- Upstream viewer: [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)
- WebAssembly bindings: [mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web)
- DWG parser: [LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)

The `main` branch tracks the upstream project. The `large-dwg-viewer` branch contains this progressive viewer and is the default branch of the fork. Upstream changes should be reviewed and selectively integrated instead of blindly overwriting this branch.

## Licensing

This is a mixed-license repository. See [`LICENSE.md`](LICENSE.md) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) before redistributing it.
