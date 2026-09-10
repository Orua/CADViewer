# CADViewer architecture and self-hosting

## Overview

The unified viewer routes STL to a lightweight mesh parser and routes STEP/STP, IGES/IGS, and BREP/BRP through a local OpenCascade WebAssembly worker. Both the 2D and 3D renderers share the same file entry, recent-file UI, fit, zoom-window, background, and sidebar controls.

CADViewer is a browser-only, read-only DWG/DXF viewer derived from [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer). It focuses on opening large drawings quickly with progressive rendering and reduced main-thread memory pressure.

- Local files are parsed in the browser by a Web Worker and LibreDWG WebAssembly.
- The worker emits lightweight batches instead of building a complete JavaScript CAD database.
- Canvas 2D renders outlines first, then curves, dimensions, text, hatches, and block references.
- Fonts are loaded after geometry and only when the drawing requires them.
- The viewer supports local files, same-origin `?file=` URLs, recent-file history, pan, zoom, fit-to-view, zoom window, and background switching.

## 3D metal surface-finish preview / 三维金属表面效果预览

For supported 3D models, the right-side finish switch applies a WebGL visual treatment to the dominant exported colour group, normally the base component. It offers Light Gold, Nickel, 24K Gold, Gunmetal, four lower-gloss matte variants, Antique Brass and Antique Silver. Antique finishes use the bundled reference texture through seamless object-space triplanar projection, so the aged marks remain on the model while it rotates. Other exported component colours are preserved.

对于支持的三维模型，右侧表面效果切换会向面积最大的已导出颜色组（通常是主要基材）应用 WebGL 视觉效果。可选择浅金、镍、24K 金、枪色、4 种低光泽哑光效果、仿古黄铜和仿古银。仿古效果使用仓库内置参考纹理，并以无缝物体坐标三向投射，因此模型旋转时旧化痕迹会固定在表面；其他已导出的配件颜色保持不变。

This feature is for visual communication only. It does not replace an approved physical sample, a plating/PVD specification, colour tolerances, coating thickness or production acceptance criteria.

For supported long, axis-aligned extruded faces, a guarded display-normal correction uses repeated cross-sections and local curve fitting to reduce reflection ripples. Other faces retain their imported normals; vertices and source CAD files remain unchanged.

对于符合条件的轴向长拉伸面，查看器通过重复截面和局部曲线拟合修正显示法线，减少反光波纹。其他面保留导入法线，不改变顶点或原始 CAD 文件。

The viewer bundles a 1K studio HDR environment, decoded into a WebGL-compatible texture. Roughness controls explicit interpolation between guttered atlas levels, without screen-derivative LOD or texture-LOD extensions. Longitude gutters wrap continuously; texture uploads explicitly reset vertical-flip state. Imported CAD normals are retained rather than re-averaged from tessellation. Antique finishes combine the supplied texture with spatially varied polished reflections. No external rendering service or CAD geometry edits are involved; ground contact shadows and path-traced self-reflections are not implemented.

查看器内置 1K 摄影棚 HDR 环境并解码为 WebGL 兼容纹理。粗糙度控制带边缘保护像素的图集层级插值，不依赖屏幕导数或纹理层级扩展；经度接缝连续，上传纹理时明确还原垂直翻转状态。保留 CAD 导入法线，不再按三角网格重新平均。仿古效果结合参考纹理与局部磨亮反射。不调用外部渲染服务，不改 CAD 几何；目前未实现地面接触阴影或路径追踪自身反射。

此功能仅用于视觉沟通，不能替代批准实体样、电镀或 PVD 规格、颜色公差、镀层厚度或量产验收标准。

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

The public `main` branch contains this Golden Luck progressive viewer and is tagged for each deployed release. Upstream changes should be reviewed and selectively integrated instead of blindly overwriting the public implementation.

## Licensing

This is a mixed-license repository. See [`LICENSE.md`](LICENSE.md) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) before redistributing it.
