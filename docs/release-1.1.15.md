# KennysVideo 1.1.15

## 界面精简

- 移除底部“片库”入口、数据源专区页面及自定义 API 列表中的“进入片库”按钮。
- 自定义 API 继续用于聚合搜索、影片详情、剧集选择和播放，不影响原有搜索功能。
- 从旧版升级时，如上次停留在已移除的“片库”页面，会自动返回首页，避免出现空白界面。

## 品牌与配置

- 调整首页 KennysVideo 品牌文字的行高和四周留白，避免渐变文字边缘被裁切。
- 导出的配置文件改名为 `KennysVideo-Settings_时间戳.json`，与软件名称保持一致。
- 配置文件内部格式保持兼容，旧版导出的 `LibreTV-Settings_*.json` 仍可正常导入。

## 安装与更新

- Windows x64 安装包可覆盖升级旧版，并保留设置、历史记录与关闭按钮偏好；另提供免安装版。
- 保留 GitHub 优先、超时或低速时自动切换 Gitee 的更新策略，并在安装前校验 SHA256。
- 国内下载：https://gitee.com/kennysPan/kennys-video/releases/latest
- GitHub：https://github.com/KennysPan/KennysVideo/releases/latest

## 验证

- 已完成界面回归检查：底部导航及设置页不再出现片库入口，Logo 留白正常，设置按钮主题、默认封面和横向滚动功能均通过检查。
- 已对相关 JavaScript 文件执行语法检查。

## 开源来源

基于 [KeyRotate/LibreTV-App](https://github.com/KeyRotate/LibreTV-App) 修改，上游为 [LibreSpark/LibreTV](https://github.com/LibreSpark/LibreTV)。感谢原作者及贡献者。修改版由 KennysPan 维护，保留 Apache License 2.0、版权声明与第三方许可。

完整修改版源码、LICENSE、NOTICE 与构建说明随源码仓库及带版本号的 source.zip 提供。
