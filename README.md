# CadViewer

浏览器内本地查看 DWG 的独立静态页面。选择本地文件后，文件只在浏览器内存和 Web Worker 中解析；页面不会将图纸上传到服务器。

## 运行

在此目录启动静态服务器后打开 `http://localhost:666/cad-viewer/`。本项目包含 `start-server.cmd` 与 IIS 的 `web.config` 配置；DWG、DXF、SHX 以二进制静态资源方式提供。

可用同源地址直接打开图纸：

```text
http://localhost:666/cad-viewer/?file=/cad-viewer/example.dwg
```

本地文件历史只保存文件名。出于浏览器安全限制，点击本地历史会重新打开文件选择框，网页不能自动重新读取之前的本机路径。

## 基线与 Fork

- 最早参考的查看器源码：[mlightcad/cad-viewer](https://github.com/mlightcad/cad-viewer)
- 本机原始工程位于 `F:\Project\cad-viewer`，其 `origin` 指向上述仓库。
- 本独立项目是该项目构建产物及其查看器界面的定制版本，不应直接把它当成上游仓库的可干净合并分支。

如果要在 GitHub 从原项目建立自己的 Fork：打开上面的仓库页面，点击 **Fork**，选择你的账号；Fork 后可将它克隆为独立的源码开发仓库。当前仓库则用于发布已经独立化的静态查看器。

## 本次独立版改造

- 使用 `libredwg-web` WASM 在 Web Worker 中解析 DWG，按批次输出图元，避免主线程一次性堆积完整图纸对象。
- Canvas 分阶段显示轮廓、曲线、标注、文字与填充；块引用按批次组合。
- 保留原界面、左侧当前图纸和最近记录、`?file=` 自动打开、载入 GL 标识。
- 文字先按插入点快速显示，再进行 TEXT 对齐点及 MTEXT 九宫格锚点校正；第二步只重绘 Canvas，不会重新解析 DWG。
- 修复 ARC/ELLIPSE 路径串线、Spline 采样、Unicode 转义、图层/ByBlock 颜色继承等问题。

## 开源组件与许可证

- 上游 `mlightcad/cad-viewer` 为 MIT License。
- DWG 解析使用 [mlightcad/libredwg-web](https://github.com/mlightcad/libredwg-web) 及 [LibreDWG](https://github.com/LibreDWG/libredwg)。其中 LibreDWG 为 GPL-3.0-or-later；发布或再分发包含的 WASM 时必须同时遵守其源代码提供与许可证义务。

仓库不包含任何业务 DWG、用户打开记录、`agent/` 下的备份/缓存或编译临时文件。
