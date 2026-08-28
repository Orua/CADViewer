# CADViewer — Unified DWG/DXF/STL/STEP Viewer for the Browser

The same open button, drag-and-drop target, recent-file list, and navigation toolbar open DWG, DXF, STL, STEP/STP, IGES/IGS, and BREP/BRP. Three-dimensional formats are tessellated locally with OpenCascade WebAssembly and rendered with WebGL; selected files are not uploaded.

CADViewer is an open-source, browser-based DWG viewer designed for large engineering drawings that are slow or fail to load in conventional web CAD viewers. It parses DWG/DXF files inside the browser with a Web Worker and LibreDWG WebAssembly, streams lightweight entity batches to the main thread, and progressively renders them with Canvas 2D and `Path2D`.

If you are looking for a **large DWG viewer**, **online DWG viewer**, **browser CAD viewer**, or a practical way to preview oversized AutoCAD drawings without building a complete JavaScript CAD database, this repository focuses on that problem.

CADViewer is a read-only viewer. It prioritizes fast opening, progressive display, lower main-thread memory pressure, and self-hosted deployment over editing and plugin features.

[中文说明](#cadviewer大型-dwgdxf-浏览器查看器)

## Why this project exists

Large DWG files are difficult to open in a browser when an application must first decode the entire drawing, create a large JavaScript object graph, build a complete scene, load every font, and only then paint the first frame. That approach can cause long blank-screen waits, high memory consumption, an unresponsive main thread, or an out-of-memory failure.

CADViewer uses a progressive pipeline instead:

1. The DWG `ArrayBuffer` is transferred to a Web Worker without copying the full file.
2. LibreDWG WebAssembly decodes the drawing away from the main UI thread.
3. The worker emits lightweight batches of visible entities instead of returning a complete CAD database.
4. The viewer displays outlines first, followed by curves, dimensions, text, hatches, and block references.
5. Drawing fonts are loaded only after geometry is available and only when the current drawing needs them.
6. Pan and zoom remain locked until the drawing is complete, preventing an incomplete camera state from disrupting progressive rendering.

This architecture is intended to make very large drawings useful sooner while keeping the page responsive.

## Features

- One file entry and shared toolbar for DWG, DXF, STL, STEP/STP, IGES/IGS, and BREP/BRP.
- Local WebGL rendering for three-dimensional mesh and engineering-solid formats.
- Progressive DWG/DXF parsing and rendering for large engineering drawings.
- Browser-only processing with a Web Worker and LibreDWG WebAssembly.
- Canvas 2D and `Path2D` rendering without a complete Three.js CAD scene.
- Outline-first display, followed by curves, annotations, text, hatches, and block references.
- Local file opening and same-origin `?file=` URLs.
- Recent-drawing history stored by the browser.
- Pan, wheel zoom, fit-to-view, zoom window, drawing-list visibility, and light/dark backgrounds.
- Fast cached previews while panning or zooming, followed by a precise vector redraw.
- Refinement-render timing shown after an interaction completes.
- Interaction lock while the drawing is loading. An attempted drag or wheel zoom shows a wait cursor and a short-lived loading hint.
- Deferred SHX, TTF, OTF, and WOFF font loading.
- SHX stroke rendering and browser `FontFace` support for outline fonts.
- Chinese CAD escape-sequence handling, text alignment fixes, ByLayer/ByBlock color inheritance, and curve-path corrections.
- Simplified Chinese and English UI configured through JavaScript.
- Static hosting: no application server or database is required.

## Quick start

Serve the repository through HTTP. Do not open `index.html` directly with a `file://` URL because Web Workers, WebAssembly, modules, and font requests require a web origin.

For example:

```powershell
python -m http.server 53281
```

Then open:

```text
http://localhost:53281/cad-viewer/
```

Use the **Open drawing/model** button to select a local DWG, DXF, STL, STEP/STP, IGES/IGS, or BREP/BRP file. Local files are parsed in the browser and are not uploaded by this viewer.

To open a drawing already hosted on the same origin:

```text
/cad-viewer/?file=/drawings/example.dwg
```

The `file` value should be URL-encoded when it contains spaces or special characters. For security, the viewer accepts same-origin drawing URLs.

## Configuration

Runtime settings are defined in [`cad-viewer/viewer-config.js`](cad-viewer/viewer-config.js):

```js
window.CAD_VIEWER_CONFIG = {
  language: 'en',
  dataBaseUrl: '../cad-data/open/',
};
```

You can define `window.CAD_VIEWER_CONFIG` before loading `viewer-config.js` to override deployment defaults:

```html
<script>
  window.CAD_VIEWER_CONFIG = {
    language: 'en',
    dataBaseUrl: '/cad-data/'
  };
</script>
<script src="./viewer-config.js"></script>
```

### UI language

Set `language` to one of the following values:

```js
language: 'en'     // English
language: 'zh-CN'  // Simplified Chinese
```

Language is controlled by deployment configuration. The viewer intentionally does not expose a runtime language picker.

### Font DATA location

`dataBaseUrl` may point to either a `cad-data` root or directly to a `fonts/` directory. The viewer resolves the font manifest as `<dataBaseUrl>/fonts/fonts.json` when a DATA root is used.

The public configuration uses these defaults:

- Local development and public deployments use the bundled, licence-cleared `../cad-data/open/` sample by default.

For offline or private-network deployment, copy [`cad-viewer/viewer-config.local.js`](cad-viewer/viewer-config.local.js) to the deployed `viewer-config.js`. This keeps DATA and font requests on the same server.

The `dataBaseUrl` priority is:

1. URL query parameter `?data=<encoded URL>`
2. A preconfigured `window.CAD_VIEWER_CONFIG.dataBaseUrl`
3. The default in `viewer-config.js`

Temporary DATA override example:

```text
/cad-viewer/?data=%2Fcad-data%2Fopen%2F
```

Cross-origin DATA servers must allow CORS requests.

## CAD DATA and font manifest

A self-hosted DATA directory normally looks like this:

```text
cad-data/
└─ fonts/
   ├─ fonts.json
   ├─ txt.shx
   ├─ simsun.woff
   └─ ...
```

`fonts.json` maps CAD font/style names to files that the browser may load. CADViewer reads the drawing's text styles, requests only the required fonts plus configured fallbacks, and continues with system fonts if a font is unavailable.

The repository includes [`cad-data/open/`](cad-data/open/README.md) as the default self-hosted DATA set. It contains only licence-cleared fonts and a minimal manifest; it is suitable for public deployment but is not a complete CAD font collection.

Do not publish proprietary or unlicensed CAD fonts. Font files must be reviewed individually for redistribution rights.

## Progressive rendering pipeline

```text
DWG/DXF file
    │
    ▼
Web Worker + LibreDWG WebAssembly
    │ lightweight entity batches
    ▼
Outline paths ──► curves ──► annotations ──► text ──► hatches/blocks
    │
    ▼
On-demand fonts and final text redraw
    │
    ▼
Pan/zoom interaction released
```

Important implementation details:

- The worker transfers visible data in batches instead of exposing the complete native drawing structure.
- Model-space geometry and reusable block definitions are processed separately.
- Block references and dimensions are materialized incrementally.
- Text appears first with a fast system-font layout, then receives precise alignment and optional drawing-font rendering.
- During pan or zoom, a cached bitmap provides immediate feedback; after interaction stops, the viewer redraws vector paths and reports the refinement time.

## Large-drawing memory strategy

CADViewer reduces browser memory pressure by avoiding several expensive structures that a full CAD application may need:

- No complete editable JavaScript CAD database on the main thread.
- No full Three.js object hierarchy for every visible entity.
- Transferred `ArrayBuffer` ownership instead of copying the DWG into the worker.
- Compact drawing paths and lightweight text records retained for rendering.
- Deferred font downloads and no up-front loading of an entire font library.
- Progressive block-reference assembly to avoid one long blocking operation.

Actual capacity still depends on the drawing, browser, device memory, entity complexity, nested blocks, hatches, and fonts. This project improves large-file behavior but cannot guarantee that every DWG will fit into every browser.

## Browser and server requirements

The browser must support:

- Web Workers
- WebAssembly
- ES modules and dynamic `import()`
- Canvas 2D and `Path2D`
- `DOMMatrix`
- `FontFace` for downloadable outline fonts

The static server must:

- Return the viewer, worker, JavaScript bindings, and WASM files with HTTP 200.
- Serve `.wasm` as `application/wasm`.
- Allow access to the configured DATA/font location.
- Support same-origin access to drawings opened through `?file=`.

An IIS [`web.config`](web.config) is included. Other web servers should configure the equivalent MIME mappings.

## Deployment

Copy the runtime files under `cad-viewer/` to a static web server. At minimum, preserve the relative paths for:

- `index.html`
- `viewer.js`
- `model-viewer.js`
- `viewer-config.js`
- `online-open.js`
- `parser-worker.js`
- `font-engine.js`
- `bindings/`
- `vendor/`
- `wasm/`

For an offline deployment, use `viewer-config.local.js` as the deployed `viewer-config.js`. Keep private DATA, business drawings, logs, credentials, and unlicensed fonts outside the public repository.

See [`PROJECT.md`](PROJECT.md) for architecture and generic self-hosting notes.

## Differences from the upstream viewer

This repository is derived from [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer), but the public `main` branch is a focused standalone Golden Luck viewer.

| Area | Upstream viewer | This large-DWG viewer |
| --- | --- | --- |
| Goal | Full CAD viewer framework | Fast, read-only preview of large drawings |
| Main data model | Rich JavaScript CAD database and scene preparation | Lightweight visible entities and text styles |
| Rendering | Three.js scene and plugin architecture | Progressive Canvas 2D / `Path2D` rendering |
| First display | More scene preparation before use | Outline-first progressive display |
| Fonts | Upstream text-rendering pipeline | Deferred, drawing-specific font loading |
| Scope | Editing, selection, extension systems | Opening, viewing, history, pan, and zoom |

The public `main` branch contains the Golden Luck progressive viewer and is tagged for each deployed release.

## Known limitations

- Read-only: no CAD editing, entity-property panel, selection workflow, or plugin system.
- External raster images, proxy objects, and uncommon custom entities may not render.
- Missing CAD fonts fall back to system fonts, so text width and appearance may differ from desktop CAD software.
- Complex hatches, deeply nested blocks, or malformed drawings may still consume substantial time or memory.
- The viewer does not replace a desktop CAD application when exact plotting, editing, or full object fidelity is required.

## Privacy and security

- Files selected with the local file picker are parsed entirely in the browser by this application.
- `?file=` downloads a same-origin static drawing and processes it in the browser.
- The viewer does not require an application backend, account, or drawing-upload API.
- A hosting site may still have normal web-server access logs; review your own deployment environment.

## Repository and licenses

- Fork: [Orua/CADViewer](https://github.com/Orua/CADViewer)
- Upstream viewer: [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)
- WebAssembly bindings: [mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web)
- DWG parser: [LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)

This repository contains components under different licenses. Read [`LICENSE.md`](LICENSE.md) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) before redistribution. The LibreDWG WebAssembly components are distributed under GPL-3.0-or-later; application and third-party components retain their respective licenses.

---

# CADViewer：统一 DWG/DXF/STL/STEP 浏览器查看器

同一个打开按钮、拖放区域、最近文件列表和查看工具栏可以打开 DWG、DXF、STL、STEP/STP、IGES/IGS、BREP/BRP。三维格式由浏览器本机的 OpenCascade WebAssembly 三角化，并使用 WebGL 显示，文件不会上传。

CADViewer 是一个开源、纯浏览器运行的 DWG 查看器，针对普通网页 CAD 查看器打开大型工程图纸缓慢、长时间白屏、主线程卡死或内存不足的问题进行优化。它使用 Web Worker 和 LibreDWG WebAssembly 在浏览器中解析 DWG/DXF，将轻量图元批次持续发送给主线程，再通过 Canvas 2D 与 `Path2D` 渐进绘制。

如果你正在寻找“大型 DWG 查看器”“在线 DWG 查看器”“浏览器 CAD 查看器”，或者需要预览因数据量太大而无法在普通网页查看器中载入的 AutoCAD 图纸，这个仓库主要解决的就是这类问题。

CADViewer 是只读查看器。它优先解决快速打开、渐进显示、降低主线程内存压力和私有化静态部署，不提供完整 CAD 编辑器的编辑与插件功能。

[English documentation](#cadviewer--fast-large-dwgdxf-viewer-for-the-browser)

## 为什么要做这个项目

很多网页 CAD 查看器需要先完整解码图纸、建立大型 JavaScript 对象数据库、创建完整场景、载入所有字体，最后才显示第一帧。对于大型 DWG，这种流程容易造成长时间白屏、内存占用过高、主线程无响应，甚至浏览器内存溢出。

CADViewer 改用渐进流程：

1. DWG `ArrayBuffer` 直接转移给 Web Worker，不复制整份文件。
2. LibreDWG WebAssembly 在主界面线程之外解码图纸。
3. Worker 分批输出轻量可视图元，而不是返回完整 CAD 数据库。
4. 先显示轮廓，再逐步补充曲线、尺寸、文字、填充和块引用。
5. 几何图元可见后才按当前图纸需要载入字体。
6. 全部载入完成前锁定平移与缩放，避免未完整视图被交互打断。

这种架构让大型图纸可以更早看到内容，并尽量保持页面响应。

## 主要特点

- DWG、DXF、STL、STEP/STP、IGES/IGS、BREP/BRP 共用一个文件入口和一套工具栏。
- 三维网格与工程实体格式在本机浏览器中完成 WebGL 显示。
- 面向大型工程图纸的 DWG/DXF 渐进解析与显示。
- 使用 Web Worker 和 LibreDWG WebAssembly，解析过程在浏览器内完成。
- 使用 Canvas 2D 与 `Path2D`，不为每个图元建立完整 Three.js 场景节点。
- 先显示轮廓，随后显示曲线、尺寸标注、文字、填充和块引用。
- 支持打开本地文件和同源 `?file=` 图纸地址。
- 浏览器保存最近打开的图纸记录。
- 支持平移、滚轮缩放、全图、框选放大、图纸列表显隐和深浅背景。
- 平移或缩放时先移动缓存预览图，停止后进行精确矢量重绘。
- 精绘完成后显示本次精绘渲染耗时。
- 图纸载入期间锁定图元交互；用户尝试拖动或缩放时显示等待光标和短暂淡出的载入提示。
- SHX、TTF、OTF、WOFF 字体按需延后加载，不阻塞首屏轮廓。
- 支持 SHX 线段字形和浏览器 `FontFace` 轮廓字体。
- 修复常见 CAD 转义字符、文字对齐、ByLayer/ByBlock 颜色继承与曲线路径错误连接问题。
- 界面支持简体中文和英文，通过 JavaScript 配置选择语言。
- 纯静态部署，不需要应用服务器和数据库。

## 快速开始

请通过 HTTP 提供仓库文件，不要直接使用 `file://` 打开 `index.html`，因为 Web Worker、WebAssembly、ES Module 和字体请求都需要网页来源。

例如：

```powershell
python -m http.server 53281
```

然后打开：

```text
http://localhost:53281/cad-viewer/
```

点击“打开图纸/模型”选择本地 DWG、DXF、STL、STEP/STP、IGES/IGS 或 BREP/BRP 文件。本地文件由浏览器内的查看器解析，不会通过本项目上传到服务器。

打开当前站点已经托管的图纸：

```text
/cad-viewer/?file=/drawings/example.dwg
```

如果 `file` 中包含空格或特殊字符，应进行 URL 编码。出于安全考虑，查看器只接受同源图纸地址。

## 配置

运行配置位于 [`cad-viewer/viewer-config.js`](cad-viewer/viewer-config.js)：

```js
window.CAD_VIEWER_CONFIG = {
  language: 'zh-CN',
  dataBaseUrl: '../cad-data/open/',
};
```

也可以在加载 `viewer-config.js` 之前预先设置全局配置：

```html
<script>
  window.CAD_VIEWER_CONFIG = {
    language: 'zh-CN',
    dataBaseUrl: '/cad-data/'
  };
</script>
<script src="./viewer-config.js"></script>
```

### 界面语言

`language` 支持以下值：

```js
language: 'en'     // 英文
language: 'zh-CN'  // 简体中文
```

语言由部署配置控制，查看器界面不提供运行时语言选择器。

### 字体 DATA 地址

`dataBaseUrl` 可以指向 `cad-data` 根目录，也可以直接指向 `fonts/` 目录。指向 DATA 根目录时，查看器会读取 `<dataBaseUrl>/fonts/fonts.json`。

公开配置的默认规则：

- 本机和公开站点默认使用仓库自带的 `../cad-data/open/` 许可证已核准字体样本。

离线或内网部署时，请将 [`cad-viewer/viewer-config.local.js`](cad-viewer/viewer-config.local.js) 复制为部署目录中的 `viewer-config.js`，使 DATA 与字体请求保持在当前服务器。

`dataBaseUrl` 的优先级：

1. URL 查询参数 `?data=<编码后的地址>`
2. 页面预先设置的 `window.CAD_VIEWER_CONFIG.dataBaseUrl`
3. `viewer-config.js` 中的默认值

临时指定 DATA 地址：

```text
/cad-viewer/?data=%2Fcad-data%2Fopen%2F
```

跨域 DATA 服务器必须允许 CORS 请求。

## CAD DATA 与字体清单

自托管 DATA 目录通常如下：

```text
cad-data/
└─ fonts/
   ├─ fonts.json
   ├─ txt.shx
   ├─ simsun.woff
   └─ ...
```

`fonts.json` 将 CAD 字体或样式名称映射到浏览器可以请求的文件。CADViewer 会读取图纸文字样式，只下载当前图纸需要的字体与回退字体；找不到字体时继续使用系统字体，不影响几何图元打开。

仓库提供 [`cad-data/open/`](cad-data/open/README.md) 作为默认自托管 DATA，其中只包含许可证明确的字体和精简清单。它适合公开部署，但不是完整 CAD 字体库。

不要公开发布专有或许可证不明确的 CAD 字体。每个字体文件都应单独确认再分发权限。

## 渐进渲染流程

```text
DWG/DXF 文件
    │
    ▼
Web Worker + LibreDWG WebAssembly
    │ 轻量图元批次
    ▼
轮廓路径 ──► 曲线 ──► 尺寸标注 ──► 文字 ──► 填充/块引用
    │
    ▼
按需加载字体并最终重绘文字
    │
    ▼
释放平移/缩放交互
```

关键实现：

- Worker 分批传递显示需要的数据，不向主线程暴露完整原生图纸结构。
- 模型空间图元和可复用块定义分开处理。
- 块引用与 DIMENSION 分批组合，避免一次长时间阻塞。
- 文字先使用系统字体快速出现，再校正对齐位置并按需使用图纸字体重绘。
- 平移或缩放时使用缓存位图即时反馈；交互停止后重新绘制矢量路径并显示精绘耗时。

## 大图内存策略

CADViewer 避免建立完整 CAD 应用通常需要的部分高成本结构，从而降低浏览器内存压力：

- 主线程不保留完整可编辑 JavaScript CAD 数据库。
- 不为每个可视图元建立完整 Three.js 对象层级。
- 将 `ArrayBuffer` 所有权转移给 Worker，而不是复制 DWG 文件。
- 主线程只保留绘图路径和轻量文字记录。
- 延后加载字体，不会预先下载完整字体库。
- 分批组合块引用，避免单次长任务阻塞页面。

实际可打开的图纸大小仍取决于图纸内容、浏览器、设备内存、图元复杂度、嵌套块、填充和字体。本项目可以改善大文件表现，但无法保证任意 DWG 都能在任意设备浏览器中打开。

## 浏览器与服务器要求

浏览器需要支持：

- Web Worker
- WebAssembly
- ES Module 与动态 `import()`
- Canvas 2D 与 `Path2D`
- `DOMMatrix`
- 用于轮廓字体的 `FontFace`

静态服务器必须：

- 页面、Worker、JavaScript 绑定和 WASM 文件返回 HTTP 200。
- 将 `.wasm` 作为 `application/wasm` 返回。
- 允许访问配置的 DATA/字体地址。
- 允许 `?file=` 读取同源图纸。

仓库提供 IIS [`web.config`](web.config)。其他服务器需要配置等价的 MIME 映射。

## 部署

将 `cad-viewer/` 下的运行文件复制到静态服务器，并保持下列文件的相对路径：

- `index.html`
- `viewer.js`
- `model-viewer.js`
- `viewer-config.js`
- `online-open.js`
- `parser-worker.js`
- `font-engine.js`
- `bindings/`
- `vendor/`
- `wasm/`

离线部署时，使用 `viewer-config.local.js` 作为部署版 `viewer-config.js`。不要把私有 DATA、业务图纸、日志、凭据或未授权字体提交到公开仓库。

架构与通用自托管说明见 [`PROJECT.md`](PROJECT.md)。

## 与上游项目的区别

本仓库派生自 [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)，公开 `main` 分支是 Golden Luck 的独立渐进式查看器。

| 项目 | 上游查看器 | 当前大型 DWG 查看器 |
| --- | --- | --- |
| 目标 | 完整 CAD Viewer 框架 | 大型图纸快速只读预览 |
| 主数据模型 | 丰富的 JavaScript CAD 数据库与场景准备 | 轻量可视图元和文字样式 |
| 渲染 | Three.js 场景与插件架构 | Canvas 2D / `Path2D` 渐进绘制 |
| 首次显示 | 完成更多场景准备后使用 | 先显示轮廓，再逐步补全 |
| 字体 | 上游文字渲染流程 | 图元完成后按图纸需要加载字体 |
| 功能范围 | 编辑、选择和扩展体系 | 打开、查看、历史、平移和缩放 |

公开 `main` 分支包含 Golden Luck 当前实现，并为每次网站部署建立对应标签。

## 当前限制

- 只读，不提供 CAD 编辑、图元属性面板、选择流程或插件系统。
- 外部图片、代理实体和少见自定义实体可能无法显示。
- 缺少 CAD 字体时会退回系统字体，文字宽度与外观可能不同于桌面 CAD 软件。
- 复杂填充、深层嵌套块或损坏图纸仍可能占用大量时间和内存。
- 需要精确打印、编辑或完整对象一致性时，不能替代桌面 CAD 软件。

## 隐私与安全

- 通过本地文件选择器打开的图纸由本应用完全在浏览器内解析。
- `?file=` 从当前站点下载同源静态图纸，并在浏览器中处理。
- 查看器不需要应用后端、账号或图纸上传 API。
- 部署网站仍可能产生普通 Web 服务器访问日志，请根据自己的环境评估。

## 仓库与许可证

- Fork：[Orua/CADViewer](https://github.com/Orua/CADViewer)
- 上游 Viewer：[mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)
- WebAssembly 绑定：[mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web)
- DWG 解析器：[LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)

本仓库包含多种许可证覆盖的组件。再分发前请阅读 [`LICENSE.md`](LICENSE.md) 与 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。LibreDWG WebAssembly 组件按 GPL-3.0-or-later 分发，应用代码与其他第三方组件保留各自许可证。
