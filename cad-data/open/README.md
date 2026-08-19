# Open CAD data sample

这是一个可以公开托管的最小 CAD DATA 路由，入口为 `/cad-data/open/`。

目录内容：

- `fonts/fonts.json`：查看器字体清单。
- `fonts/*.ttf`：3 个来自 Google Fonts 官方仓库的开源字体。
- `licenses/`：每个字体随附的 SIL Open Font License 1.1 原文。
- `manifest.json`：来源、SHA-256 和许可证对应关系。

查看器测试地址示例：

```text
/cad-viewer/?data=%2Fcad-data%2Fopen%2F
```

这只是路由和加载机制示例，不是完整 CAD 字体库，也不包含 AutoCAD、Microsoft 或本机商业字体。
