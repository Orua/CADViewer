# CadViewer：大型 DWG 渐进式浏览器查看器

这是一个从 [mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer) 演化出来的只读 DWG 查看器，重点解决大型图纸在浏览器中首次显示慢、JavaScript 内存占用高和主线程长时间无响应的问题。

图纸由浏览器中的 Web Worker 与 WebAssembly 本地解析。通过文件选择器打开的 DWG 不会上传到业务服务器；若使用 `?file=`，页面只会读取当前站点允许访问的同源静态文件。

## 与原项目的主要技术差异

| 项目 | 原始 `mlightcad/cad-viewer` | 当前版本 |
| --- | --- | --- |
| 定位 | 完整 CAD Viewer 框架，包含较完整的数据模型、渲染和扩展能力 | 面向大型 DWG 快速预览的独立只读查看器 |
| 解析结果 | 将 DWG 转换为较完整的 JavaScript CAD 数据库 | `convertForViewer` 只提取可视图元，跳过编辑表、字典、布局等非首屏数据 |
| 数据传递 | 解析完成后再交给查看器组织场景 | Web Worker 每 2,000 个图元发送一个批次，主线程收到即可消费 |
| 首次显示 | 需要等待更多数据结构和场景准备完成 | 轮廓线到达后立即适配视口并显示首屏 |
| 渲染方式 | 原项目的 Three.js/场景对象体系 | Canvas 2D + `Path2D`，按颜色和阶段合并路径，减少对象数量 |
| 内存策略 | 保留更完整的 CAD 数据，适合后续编辑和查询 | Worker 持有 DWG 原生结构，主线程只保存绘图路径和少量文字；完成后调用 `dwg_free` |
| 块引用 | 完整场景节点方式处理 | 先缓存块定义，再按每批 250 个 INSERT/DIMENSION 渐进组合 |
| 文字 | 原渲染器统一完成字体、布局和锚点处理 | 先按插入点快速显示，再依据 TEXT 对齐点和 MTEXT 九宫格锚点二次校正 |
| 功能范围 | 查看、编辑及插件扩展能力更完整 | 聚焦平移、缩放、全图、打开文件、历史记录和同源 URL 打开 |

## 渐进解析与显示流程

1. 主线程把 `ArrayBuffer` 转移给 `parser-worker.js`，避免复制整份 DWG。
2. Worker 中的 `libredwg-web.wasm` 解码 DWG。
3. `convertForViewer` 逐批输出模型空间、块定义和必要的图层颜色信息。
4. 主线程先绘制 LINE、LWPOLYLINE 等轮廓图元，让大图尽快可见。
5. 随后依次补充圆弧/曲线、尺寸/引线、文字、填充边界和块引用。
6. 文字先快速显示，再执行一次纯 Canvas 重绘，校正 `halign`、`valign`、`endPoint`、`attachmentPoint`、宽度系数和镜像标志；不会重新运行 WASM。

## 针对显示正确性的修复

- ARC、ELLIPSE 及 HATCH 曲线先移动到数学起点，避免不同图元被 Canvas 自动连成穿图白线。
- SPLINE 按 knots、weights 和控制点进行 B-spline 采样，不再直接连接控制点。
- 解析 `\U+XXXX`、`%%C`、`%%D`、`%%P` 和常见 MTEXT 控制码。
- 读取真彩色、ACI、ByLayer 与 ByBlock 颜色，并在块引用中继续继承颜色。
- TEXT 使用对齐点及水平/垂直对齐；MTEXT 使用九宫格附着点和多行高度校正位置。

## 界面与打开方式

- 保留原查看器的界面结构，并使用独立 Canvas 渲染核心。
- 左侧列表显示“当前：文件名”和最近打开记录。
- 本地历史只保存文件名；浏览器不会保存可再次读取的本机完整路径，因此点击本地历史时会重新弹出文件选择器。
- 支持 `?file=/path/to/drawing.dwg` 读取当前站点的同源图纸。
- 载入时先显示 GL 标识，首批轮廓出现后进入渐进显示。

部署时只需提供静态文件服务，并正确返回 `.wasm`、`.dwg`、`.dxf` 和 `.shx`。查看器入口为 `/cad-viewer/`。

## 关键文件

- `cad-viewer/viewer.js`：渐进消费、块组合、Canvas 渲染、文字二次校正和交互。
- `cad-viewer/parser-worker.js`：Worker 生命周期、WASM 调用和批次消息。
- `cad-viewer/bindings/libredwg-web.js`：LibreDWG JavaScript 绑定及 `convertForViewer`。
- `cad-viewer/wasm/`：浏览器运行所需的 WASM 加载脚本和二进制。
- `cad-viewer/online-open.js`：同源 QueryString 打开、当前图纸和最近历史。

## 当前限制

- 这是只读预览器，不保留原项目的编辑、选择和插件能力。
- Canvas 使用系统字体代替图纸缺失的 SHX/TTF 时，字形宽度仍可能与 CAD 软件存在差异。
- 外部 IMAGE、部分代理实体和少见自定义实体可能无法显示。
- 为控制内存，不会构建完整 JavaScript CAD 数据库；需要实体属性查询或编辑时应使用原项目。

## 上游、Fork 与同步设置

最早的源码仓库：

- Viewer：[mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)
- DWG WebAssembly 绑定：[mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web)
- 底层解析器：[LibreDWG/libredwg](https://github.com/LibreDWG/libredwg)

当前仓库是在 GitHub 上新建后推送的，因此 GitHub 将它识别为独立仓库，不会显示 “forked from mlightcad/cad-viewer”。给本地仓库添加 `upstream` 只能用于拉取和比较上游，不能改变 GitHub 的 Fork 关系：

```bash
git remote add upstream https://github.com/mlightcad/cad-viewer.git
git fetch upstream
```

由于当前仓库已经从 TypeScript/Three.js 工程重构成独立静态查看器，不建议直接合并 `upstream/main`；更适合通过 `git fetch upstream` 后对照具体提交，选择性移植修复。

如果必须在 GitHub 页面显示正式 Fork 关系，需要从原仓库页面点击 **Fork** 创建仓库。GitHub 没有把现有独立仓库一键改成 Fork 的设置；通常需要换一个仓库名保留当前版本，再创建正式 Fork，或者联系 GitHub Support 调整仓库网络关系。

## 开源组件与许可证

- `mlightcad/cad-viewer` 使用 MIT License。
- DWG 解析使用 `mlightcad/libredwg-web` 和 GPL-3.0-or-later 的 LibreDWG。
- 公开或再分发包含的 LibreDWG WASM 时，需要继续满足相应许可证及源代码提供义务。

公开仓库不包含业务 DWG、用户打开记录、备份、构建缓存或测试图纸。
