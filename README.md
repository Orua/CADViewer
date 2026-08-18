# CADViewer：大型 DWG 渐进式浏览器查看器

CADViewer 是从 [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) 演化出的纯前端只读查看器，目标是在浏览器内更快地打开大型 DWG，并降低 JavaScript 主线程的等待时间和内存压力。

本地文件由 Web Worker 与 LibreDWG WebAssembly 在浏览器内解析，不会上传到业务服务器。通过 `?file=` 打开的图纸只从当前站点读取同源静态文件。

## 主要能力

- 分批解析并渐进显示大型 DWG，不必等待完整 JavaScript CAD 数据库建立。
- 先显示轮廓，再补充曲线、尺寸、文字、填充和块引用。
- 支持 SHX、TTF、OTF、WOFF 字体按需加载；字体不会阻塞首屏图形。
- 支持本地文件、同源 `?file=` 地址、最近打开记录。
- 支持平移、滚轮缩放、全图、框选放大、图纸列表显隐和深浅底色。
- 修复常见 CAD 转义字符、文字对齐、颜色继承和路径错误连线问题。

## 快速使用

将整个 `cad-viewer/` 目录放到静态网站，并确保服务器正确返回 `.wasm`、`.dwg`、`.dxf`、`.shx` 和字体文件。入口为：

```text
/cad-viewer/
```

打开同源图纸：

```text
/cad-viewer/?file=/CAD-DATA/data/example.dwg
```

临时指定字体资料地址：

```text
/cad-viewer/?data=%2FCAD-DATA%2F
```

`file` 和 `data` 参数都应进行 URL 编码。

## 字体 DATA 设置

字体路径由 [`cad-viewer/viewer-config.js`](cad-viewer/viewer-config.js) 的 `dataBaseUrl` 控制。该地址可以指向 `cad-data` 根目录，也可以直接指向 `fonts/` 目录。

默认规则：

- 仓库在本机开发地址访问（包括任意端口）：`../cad-data/`
- GitHub Pages 和其他公开访问地址：`https://mlightcad.gitlab.io/cad-data/`

公开页面使用 `viewer-config.js` 的 CDN 配置。离线或内网部署时，将仓库中的 `viewer-config.local.js` 复制为部署副本的 `viewer-config.js`，使客户端只读取部署服务器自己的 `/cad-data/`，不依赖公网字体服务。

推荐目录结构：

```text
cad-data/
└─ fonts/
   ├─ fonts.json
   ├─ simsun.woff
   ├─ txt.shx
   └─ ...
```

查看器会在所有图元显示完毕后读取 `<dataBaseUrl>/fonts/fonts.json`，根据 DWG 文字样式只下载当前图纸需要的字体，然后重新渲染文字。字体清单没有对应字体或下载失败时，继续使用系统字体，不影响图纸打开。

有三种设置方式，优先级从高到低如下：

1. 查询参数，适合临时测试：

   ```text
   /cad-viewer/?data=https%3A%2F%2Fexample.com%2Fcad-data%2F
   ```

2. 页面加载配置脚本前设置全局配置，适合固定部署：

   ```html
   <script>
     window.CAD_VIEWER_CONFIG = {
       dataBaseUrl: '/CAD-DATA/'
     };
   </script>
   <script src="./viewer-config.js"></script>
   ```

3. 直接修改 `viewer-config.js` 的默认地址。

部署版与公开版必须保持以下区别：公开页面加载 `viewer-config.js`；部署时将 `viewer-config.local.js` 重命名覆盖为目标目录中的 `viewer-config.js`。不要把部署副本的本地地址反向提交覆盖公开配置。

跨域字体地址必须允许浏览器 CORS 访问。为避免相对地址解析错误，建议地址以 `/` 结尾；代码也会自动补齐结尾斜杠。

仓库同时提供一个可公开访问的最小示例路由 [`cad-data/open/`](cad-data/open/README.md)，包含 3 个附带 OFL 许可证的字体和精简字体清单：

```text
/cad-viewer/?data=%2Fcad-data%2Fopen%2F
```

该目录用于演示自托管 DATA，不替代完整 CAD 字体库。

## 渐进解析流程

1. 主线程把 DWG `ArrayBuffer` 转移给 `parser-worker.js`，避免复制整份文件。
2. Worker 中的 LibreDWG WASM 解码 DWG。
3. `convertForViewer` 每 2,000 个图元输出一个批次，只保留显示所需数据和轻量文字样式表。
4. 主线程先绘制 LINE、LWPOLYLINE 等轮廓并适配视口。
5. 随后补充圆弧/曲线、尺寸/引线、文字、填充边界和块引用。
6. 文字先用系统字体快速显示，再校正对齐点、附着点、宽度系数和镜像标志。
7. 所有图元完成后才载入所需 SHX/TTF/WOFF 字体，并最终重绘文字。

## 与原项目的主要差异

| 项目 | 原始 `mlightcad/cad-viewer` | 当前版本 |
| --- | --- | --- |
| 定位 | 完整 CAD Viewer 框架 | 面向大型 DWG 快速预览的独立只读查看器 |
| 数据模型 | 构建较完整 JavaScript CAD 数据库 | 只提取可视图元、图层颜色、块定义和文字样式 |
| 数据传递 | 完成更多场景准备后统一处理 | Worker 分批输出，主线程收到即可消费 |
| 渲染 | Three.js 场景及插件体系 | Canvas 2D + `Path2D` 分阶段合并绘制 |
| 内存策略 | 保留完整场景和更多 CAD 数据 | 主线程仅保存绘图路径及少量文字，完成后释放 DWG 原生结构 |
| 块引用 | 完整场景节点 | 缓存块定义，再分批组合 INSERT/DIMENSION |
| 字体 | 原文字渲染体系负责字体和布局 | 首屏使用系统字体，图元完成后按需下载字体并重绘 |
| 功能范围 | 查看、编辑和扩展能力更完整 | 聚焦打开、快速查看、历史、平移和缩放 |

## 显示正确性修复

- ARC、ELLIPSE、HATCH 曲线先移动到数学起点，避免 Canvas 自动连接不同图元。
- SPLINE 根据 knots、weights 和控制点进行 B-spline 采样。
- 解析 `\U+XXXX`、`%%C`、`%%D`、`%%P` 和常见 MTEXT 控制码。
- 读取真彩色、ACI、ByLayer 与 ByBlock 颜色，并在块引用中继承颜色。
- TEXT 使用对齐点和水平/垂直对齐；MTEXT 使用九宫格附着点校正位置。
- SHX 字体使用线段绘制；TTF/OTF/WOFF 通过浏览器 `FontFace` 注册。

## 关键文件

- `cad-viewer/index.html`：页面、历史列表和查看工具栏。
- `cad-viewer/viewer.js`：渐进消费、块组合、Canvas 渲染、文字重绘和交互。
- `cad-viewer/viewer-config.js`：字体 DATA 地址配置。
- `cad-viewer/viewer-config.local.js`：离线部署配置模板；部署时复制为 `viewer-config.js`，固定使用服务器本地 DATA。
- `cad-viewer/font-engine.js`：浏览器直接加载的字体引擎包。
- `cad-viewer/src/font-engine-entry.js`：字体引擎源码入口。
- `cad-viewer/parser-worker.js`：Worker 生命周期、WASM 调用和批次消息。
- `cad-viewer/bindings/libredwg-web.js`：LibreDWG JavaScript 绑定和 `convertForViewer`。
- `cad-viewer/wasm/`：LibreDWG WASM 加载脚本和二进制。
- `cad-viewer/online-open.js`：同源 QueryString 打开及最近历史。

## 当前限制

- 这是只读预览器，不包含原项目的编辑、实体选择和插件体系。
- 字体仓库缺少图纸字体时会退回系统字体，字形宽度可能与 CAD 软件不同。
- 外部 IMAGE、代理实体和少见自定义实体可能无法显示。
- 为控制内存，不构建完整 JavaScript CAD 数据库；实体属性查询或编辑仍应使用原项目。

## 仓库与分支

- 当前仓库：[Orua/CADViewer](https://github.com/Orua/CADViewer)
- 上游 Viewer：[mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)
- DWG WebAssembly 绑定：[mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web)
- 底层解析器：[LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)

分支职责：

- `main`：保留上游原始分支，用于跟踪上游更新。
- `large-dwg-viewer`：当前大型 DWG 渐进查看器，也是仓库默认分支。

本地 `origin` 指向当前 Fork，`upstream` 指向原项目。不要把 `upstream/main` 直接合并到 `large-dwg-viewer`；应先获取上游提交，再选择性移植需要的修复。

通用的架构、自托管和发布说明见 [`PROJECT.md`](PROJECT.md)。

## 许可证与数据

- 本仓库包含不同许可证覆盖的组件，详情见 [`LICENSE.md`](LICENSE.md) 与 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md)。
- 从 `mlightcad/cad-viewer` 派生的应用代码保留其 MIT License。
- DWG 解析组件来自 `mlightcad/libredwg-web` / LibreDWG，并按 GPL-3.0-or-later 分发。
- SHX 解析器许可证见 `cad-viewer/vendor/shx-parser-LICENSE.txt`。
- 公开仓库不包含业务 DWG、浏览器历史、备份、构建缓存或测试图纸。
- 本地 `cad-data/fonts` 中部分字体来源和再分发许可证不明确，因此不提交到公开仓库；只提交 `cad-data/open` 中许可证明确的最小示例资源。公开环境默认仍使用上游字体地址。
