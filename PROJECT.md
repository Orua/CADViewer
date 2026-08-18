# CADViewer 项目与部署说明

## 项目基本情况

- GitHub 仓库：[`Orua/CADViewer`](https://github.com/Orua/CADViewer)，公开 Fork；默认分支为 `large-dwg-viewer`。
- 上游仓库：[`mlightcad/cad-viewer`](https://github.com/mlightcad/cad-viewer)。底层 DWG 解析依赖 LibreDWG WebAssembly。
- 本地开发目录：`F:\Project\CADViewer`。此目录是唯一开发源；Goldenluck 下的查看器目录是部署副本，不在两处同时编辑。
- 类型：纯静态、只读 DWG/DXF 浏览器查看器。文件选择器打开的本地 DWG 在浏览器内由 Web Worker 和 WASM 解析，不回传业务服务器。
- 渲染：Worker 分批输出可视图元，主线程用 Canvas 2D / Path2D 先显示轮廓，再渐进显示曲线、尺寸、文字、填充和块引用；避免构建完整的 JavaScript CAD 数据库。
- 支持：打开文件、同源 `?file=` 打开、图纸历史、平移、滚轮缩放、全图、框选放大、图纸列表显隐和底色切换。
- 限制：不提供原上游的编辑/选择/插件体系；部分代理或自定义实体可能无法显示；系统字体替代缺失 CAD 字体时，文字宽度可能不同。

## Goldenluck 本地接入、测试与 FTP 部署

Goldenluck 是部署目标，不是本项目源码仓库。

1. 同步前，把将被覆盖的 Goldenluck 文件备份到 `F:\Project\Goldenluck\agent\backups\<时间戳>\Web\cad-viewer\`。
2. 将下列运行文件同步至 `F:\Project\Goldenluck\Web\cad-viewer\`：
   - `index.html`
   - `viewer.js`
   - `parser-worker.js`
   - `online-open.js`
   - `bindings/libredwg-web.js`
   - `wasm/libredwg-web.js`
   - `wasm/libredwg-web.wasm`
   - `web.config`
3. 用本地 IIS 先测试：`http://localhost/cad-viewer/`。同源样例可用 `http://localhost/cad-viewer/?file=/CAD-DATA/data/<文件名>.dwg`。
4. 验收必须包含：页面、Worker、WASM 都返回 HTTP 200；`.wasm` 返回 `application/wasm`；并实际加载至少一张 DWG，确认图形、工具栏、平移、缩放正常。
5. Goldenluck 根 `Web.config` 不修改、不上传；WASM MIME 映射由 `Web/cad-viewer/web.config` 提供。
6. 本地测试通过后，上传同一组运行文件到 FTP `/GOLDENLUCK/cad-viewer/`。上传前列出候选文件并获得确认；不得上传业务图纸、`cad-data`、`agent/`、备份、日志或根 `Web.config`。
7. 只有在工作区没有无关改动时，才刷新根 `.deploy-manifest.json`；不得把无关本地改动写进部署基线。

## `cad-data` 字体资料

- 本地字体目录统一为小写 `cad-data/fonts/`。
- 当前快速 Canvas 查看器并不请求、下载或解析这个目录；文字由浏览器系统字体绘制。因此该目录缺失不会阻止打开 DWG，但会影响个别图纸的字形和文字宽度一致性。
- 该目录含 100 个文件、约 48.69 MiB，且没有随附许可证；其中包括疑似 Microsoft/AutoCAD 字体。公开仓库保持忽略，直到每个可再分发文件的来源与许可证被确认。
- 若未来实现精确字体渲染，只引入可公开再分发的字体，连同来源和许可证说明提交；业务 DWG 永远不提交。
