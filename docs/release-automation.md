# GitHub 自动打包与发布

工作流：`.github/workflows/release.yml`。应用版本不因本次 CI 修正而改变。

## 签名与安全

仓库 Secrets 使用 `ANDROID_SIGNING_KEY_JKS_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。密钥不进入 Git、源码 ZIP、构建产物或日志；只在 GitHub 临时 runner 中恢复，任务结束清除。

沿用已安装用户的现有调试证书，SHA256 为 `965971a372fcbbef3a7e2d540cb58664dc671e771ea016f8cb439e683b215d3a`。这保障现有安装的签名兼容，不代表新获得正式商业签名或 Google Play 发布资格。不要重新生成或替换此密钥，除非明确规划应用签名迁移。

Mac 使用 ad-hoc 签名，不是 Apple 开发者签名或公证。Windows 没有受信任的代码签名，仍可能出现系统安全提示。

## 验证，不替换现有发行包

在 GitHub Actions 选择 Release Build & Upload → Run workflow，默认分支 `main`，`source_ref` 选择包含完整源码的 `release-automation`，`publish` 保持 false。也可使用：

```powershell
gh workflow run release.yml --repo KennysPan/KennysVideo --ref main -f source_ref=release-automation -f publish=false
```

验证完成后查看 `complete-release-版本号` Artifact，包括 Windows 安装版/便携版、同签名 Android APK、完整源码、更新清单、SHA256 及 Mac/Linux 产物。APK 包名、版本、ARM64/x86_64 架构和证书指纹均必须通过校验。未做真机完整播放验收，不将构建成功等同于全部功能验收。

## 发布新版本

从完整应用源码分支更新 package、Cargo、Tauri、前端版本和双端更新说明，推送新的 `vX.Y.Z` 标签至 GitHub。默认分支目前保留项目介绍，因此不要直接在介绍分支创建应用标签。

所有平台构建通过后，汇总生成源码 ZIP、更新清单和 SHA256，再先创建 Draft，上传完整附件，最后公开为最新版本。任何构建失败都会阻止发布；已有 Release 不会被覆盖。重试旧版本时使用 publish=false，不删除既有发行版来规避保护。

Gitee 源码仍需同步推送；本流程不含 Gitee 附件自动上传，也不会删除旧版附件释放空间。Gitee 大附件保存异常与 GitHub Actions 构建是两项独立问题。
