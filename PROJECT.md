# CADViewer 项目与部署说明

## 项目基本情况

- GitHub 仓库：[`Orua/CADViewer`](https://github.com/Orua/CADViewer)，公开 Fork；默认分支为 `large-dwg-viewer`。
- 上游仓库：[`mlightcad/cad-viewer`](https://github.com/mlightcad/cad-viewer)。底层 DWG 解析依赖 LibreDWG WebAssembly。
- 本地开发目录：`F:\Project\CADViewer`。此目录是唯一开发源；Goldenluck 下的查看器目录是部署副本，不在两处同时编辑。
- 类型：纯静态、只读 DWG/DXF 浏览器查看器。文件选择器打开的本地 DWG 在浏览器内由 Web Worker 和 WASM 解析，不回传业务服务器。
- 渲染：Worker 分批输出可视图元，主线程用 Canvas 2D / Path2D 先显示轮廓，再渐进显示曲线、尺寸、文字、填充和块引用；避免构建完整的 JavaScript CAD 数据库。
- 支持：打开文件、同源 `?file=` 打开、图纸历史、平移、滚轮缩放、全图、框选放大、图纸列表显隐和底色切换。
- 字体：几何图元全部显示后，读取轻量文字样式表，按需加载 SHX/TTF/WOFF，再重绘文字；不会为了字体阻塞首屏轮廓。
- 限制：不提供原上游的编辑/选择/插件体系；部分代理或自定义实体可能无法显示；字体仓库没有对应字体时会退回系统字体，文字宽度仍可能不同。

## Goldenluck 本地接入、测试与 FTP 部署

Goldenluck 是部署目标，不是本项目源码仓库。

1. 同步前，把将被覆盖的 Goldenluck 文件备份到 `F:\Project\Goldenluck\agent\backups\<时间戳>\Web\cad-viewer\`。
2. 将下列运行文件同步至 `F:\Project\Goldenluck\Web\cad-viewer\`：
   - `index.html`
   - `viewer.js`
   - `viewer-config.js`（由源码中的 `viewer-config.local.js` 复制生成，不直接使用公开版配置）
   - `font-engine.js`
   - `vendor/shx-parser-LICENSE.txt`
   - `parser-worker.js`
   - `online-open.js`
   - `bindings/libredwg-web.js`
   - `wasm/libredwg-web.js`
   - `wasm/libredwg-web.wasm`
   - `web.config`
3. 用 Goldenluck 的本地 IIS 站点先测试。图纸也可通过 `?file=/CAD-DATA/data/<文件名>.dwg` 由查询参数直接打开。
4. 验收必须包含：页面、Worker、WASM 都返回 HTTP 200；`.wasm` 返回 `application/wasm`；并实际加载至少一张 DWG，确认图形、工具栏、平移、缩放正常。
5. Goldenluck 根 `Web.config` 不修改、不上传；WASM MIME 映射由 `Web/cad-viewer/web.config` 提供。
6. 本地测试通过后，上传同一组运行文件到 FTP `/GOLDENLUCK/cad-viewer/`。上传前列出候选文件并获得确认；不得上传业务图纸、`cad-data`、`agent/`、备份、日志或根 `Web.config`。
7. 只有在工作区没有无关改动时，才刷新根 `.deploy-manifest.json`；不得把无关本地改动写进部署基线。

## `cad-data` 字体资料

- 本地字体目录统一为小写 `cad-data/fonts/`。
- `cad-viewer/viewer-config.js` 提供 `dataBaseUrl`。公开仓库在本机开发地址使用 `../cad-data/`，在 GitHub Pages 和其他公开地址使用上游绝对地址 `https://mlightcad.gitlab.io/cad-data/`。
- Goldenluck 部署不是通过主机名判断：每次部署都必须把源码 `viewer-config.local.js` 复制为部署副本的 `viewer-config.js`。这样本机和局域网访问同一部署副本时都只使用服务器本地 DATA，不依赖公网字体服务。
- 公开仓库保留 CDN 默认值；不得把 Goldenluck 部署副本的本地默认值反向覆盖公开配置。
- 设置优先级为：URL 的 `?data=<地址>`、页面预先定义的 `window.CAD_VIEWER_CONFIG.dataBaseUrl`、环境默认值。地址可以指向 `cad-data/` 根目录，也可以直接指向 `fonts/`。
- 固定部署可在加载 `viewer-config.js` 前设置：`window.CAD_VIEWER_CONFIG = { dataBaseUrl: '/CAD-DATA/' }`。临时测试则使用 URL 编码后的 `?data=` 参数。
- 字体目录至少需要 `fonts/fonts.json` 以及清单引用的字体文件；跨域地址必须允许 CORS。
- 所有图元完成后才请求 `<dataBaseUrl>/fonts/fonts.json`，并只下载当前图纸文字样式需要的字体和 `simsun` 回退字体；SHX 以线段绘制，TTF/WOFF 通过 `FontFace` 注册后重绘文字。
- `cad-data/open/` 是公开示例路由，只包含 3 个来自 Google Fonts 官方仓库、随附 OFL 1.1 的小字体、精简清单和来源哈希；可用 `?data=/cad-data/open/` 测试。
- 本机完整 `cad-data/fonts/` 含 100 个文件、约 48.69 MiB，且没有随附许可证；其中包括疑似 Microsoft/AutoCAD 字体。该目录继续忽略，直到每个可再分发文件的来源与许可证被确认。
- 业务 DWG 永远不提交；公开仓库不提交来源或许可证不明确的本地字体文件。
