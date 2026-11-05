# 数据源专区接口约定（待发布）

专区只请求用户当前选定的一个来源，不修改全局 selectedAPIs。来源列表包含自定义与内置来源，遵循内容过滤开关。

复用现有 executeApiRequest → make_http_request 原生 HTTP 通道；浏览器验证可走同一函数的 fetch 分支。请求超时 15 秒，不增加原生权限或独立服务。

## URL 与请求

- 地址支持根地址、带前缀的根地址或完整 /api.php/provide/vod/ 地址；保留已有附加查询参数。
- 分类：GET /api.php/provide/vod/?ac=list&pg=1。
- 影片：GET /api.php/provide/vod/?ac=videolist&pg=页码，可选 t=分类ID、wd=关键词。
- 详情沿用 showDetails 与现有剧集／播放流程。
- 本次约定基于软件现有采集接口格式扩展，未声称兼容所有第三方 API。

## 响应约定

- 成功 code 接受缺省、0、1、200（数值或字符串）。JSON 对象中的 list 必须为数组。
- list 条目使用 vod_id、vod_name，可选 vod_pic、vod_remarks、type_name、vod_year。缺少海报使用共享品牌默认图。
- 分类响应 class 可选，条目使用 type_id、type_name；缺少分类不影响浏览和搜索。
- pagecount、limit、total 兼容数字和数字字符串。没有总页数时以返回条目与 limit 判断下一页；空页终止。
- 所有分类、关键词和分页均仅在选定来源内生效。

## 错误与一致性

断网、超时、HTTP 错误、非 JSON、无效列表等情况显示可重试提示。切换来源或筛选时丢弃旧请求结果，防止响应乱序覆盖当前页面。远端文本以 DOM 文本方式展示；点击条目时核对来源配置仍有效。

## 验证方式

本机未安装 Postman CLI，使用本地 HTTP 模拟服务与 Playwright 运行真实前端请求代码。测试中的 Tauri IPC 适配层通过 fetch 连接该 HTTP 服务，未执行 Rust 原生网络实现；验证分类、翻页、搜索、来源隔离、失败重试、响应乱序及详情到剧集播放跳转。不会将模拟测试称为对用户 API 的线上兼容验证。执行：node tests/sourceCatalog.cjs。
