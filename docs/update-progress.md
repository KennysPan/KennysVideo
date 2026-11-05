# 更新下载进度契约

download_app_update 保留原调用方式，成功响应增加 bytes（已校验并保存的安装包字节数），source 保持 github/gitee。

下载期间原生端向主窗口派发 app-update-progress DOM CustomEvent。detail 为 {stage, source, downloaded, total}，字节数为非负整数，total 未提供时为 null。阶段：connecting → downloading → verifying → ready；GitHub 失败/超时/低速时先发 fallback（source=gitee、downloaded=0、total=null），随后从零连接和下载 Gitee。分块进度最多约每 100ms 通知一次。ready 只在校验、写盘、保存安装路径均完成后发出。

界面按真实已收字节计算百分比，校验完成前最多显示 99%。总大小未知时显示不定进度和已下载量，不猜测百分比。切换源时重置该次下载进度。失败保留未完成状态，可重试。保留“稍后再说”、手动下载和 Esc 退出弹窗的操作，已开始的后台下载不会自动安装；安装仍需用户点击安装按钮。

验证使用现有 Rust 本地 HTTP 服务器发送真实分块/缺失 Content-Length/损坏校验和响应，覆盖回退时进度归零、单个来源字节递增和校验前不得报告完成；浏览器测试用可控 IPC 适配器验证展示与重试。当前机器没有 Postman CLI，未声称执行 Postman simulation 或 collection。
