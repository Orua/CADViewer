# CADViewer architecture and self-hosting

## Overview

CADViewer is a browser-only, read-only DWG/DXF viewer derived from [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer). It focuses on opening large drawings quickly with progressive rendering and reduced main-thread memory pressure.

- Local files are parsed in the browser by a Web Worker and LibreDWG WebAssembly.
- The worker emits lightweight batches instead of building a complete JavaScript CAD database.
- Canvas 2D renders outlines first, then curves, dimensions, text, hatches, and block references.
- Fonts are loaded after geometry and only when the drawing requires them.
- The viewer supports local files, same-origin `?file=` URLs, recent-file history, pan, zoom, fit-to-view, zoom window, and background switching.

## Interaction lock and UI language / 交互锁定与界面语言

While the drawing is loading, the viewer does not bind pan, wheel-zoom, or zoom-window actions. A drag or wheel attempt only shows a wait cursor and a transient “Loading... please wait” hint near the pointer; it cannot change the camera. The actions are bound after all geometry, block references, and text/font work finish. A completed fast interaction reports its refinement-render duration in the status bar.

The standalone viewer has a small built-in Chinese/English message catalog. Set `language` to `'zh-CN'` or `'en'` in `cad-viewer/viewer-config.js`; use the same setting in `viewer-config.local.js` for an offline or private deployment. The language is deliberately deployment-configured rather than selected through the UI.

图纸载入期间，查看器不会绑定平移、滚轮缩放或框选放大动作。用户尝试拖动或缩放时，只会看到等待光标以及指针附近短暂淡出的“载入中...请稍后”提示，视图不会改变。所有图元、块引用与文字/字体处理完成后才绑定这些动作；快速交互结束后，状态栏显示本次精绘耗时。

独立查看器内置中英文文案。请在 `cad-viewer/viewer-config.js` 中将 `language` 设置为 `'zh-CN'` 或 `'en'`；离线或私有部署时，在 `viewer-config.local.js` 使用相同设置。语言由部署配置控制，界面不提供切换器。

The project intentionally omits the upstream editing, selection, and plugin systems. Proxy objects, external images, and uncommon custom entities may not render.

## Public and offline font configuration

`cad-viewer/viewer-config.js` is the public configuration. Local development uses the repository's relative `cad-data` directory, while public hosts use the configured public CDN. Its `language` field selects `'zh-CN'` or `'en'` for the UI.

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
