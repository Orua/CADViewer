# CAD data

本目录分为两部分：

- `open/`：可以公开再分发的最小示例资源，已提交到 GitHub。
- `fonts/`：本机完整字体库，可能包含来源或再分发许可证不明确的 CAD 字体，因此继续由 `.gitignore` 排除。

公开仓库在本机开发地址下默认使用 `../cad-data/`，在公开地址下默认使用上游 CDN；Goldenluck 部署副本则固定使用部署站点自己的 `../cad-data/`。如需只使用公开示例资源，可把 `dataBaseUrl` 设置为 `/cad-data/open/`，或在地址中使用 URL 编码后的 `?data=/cad-data/open/`。
