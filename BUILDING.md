# 构建指南

本应用使用 [Tauri](https://tauri.app/) 框架。以下是编译、运行和打包应用的常用命令：

## 1. 环境准备

确保你已经安装了 [Node.js](https://nodejs.org/) 和 Rust。然后根据 Tauri 官方文档为你的操作系统配置好 Tauri 开发环境：
- [Tauri 前置依赖安装指南](https://tauri.app/v1/guides/getting-started/prerequisites)

安装项目依赖：
```bash
npm install
```

## 2. 开发模式运行

在开发模式下编译和启动应用：
```bash
npm run dev
# 或者
npx tauri dev
```
此命令会启动应用，并支持热重载。

## 3. 打包桌面应用

### macOS
```bash
npx tauri build --target universal-apple-darwin
```
或者简写为：
```bash
npx tauri build
```
(在 macOS 环境下，默认会构建 .app 和 .dmg 文件)

生成的应用包通常位于 Tauri 构建输出目录下的 `release/bundle/macos/` 子目录中。

### Windows

当前 Windows 版本为 KennysVideo 1.1.14。安装器保留旧版 `libretv` 的注册表安装标识及 `com.libretv.app` 应用标识：检测到旧版或同版本时在原目录覆盖安装，保留用户数据并迁移旧快捷方式；检测到更高版本时退出，防止降级。此检测针对通过安装包安装的版本，不能检测散放在其他文件夹中的便携版。

1.1.7 起优先 GitHub，3 秒超时自动切换 Gitee，并支持程序内下载安装包、慢速换源和校验后由用户点击安装。发布流程见 `docs/updates.md`，运行 `python tests/prepareRelease.py` 生成带校验摘要的发布文件；`python tests/packageSource.py` 生成源码包。

`src-tauri/installer-template.nsi` 基于 Tauri CLI 2.5.0 官方 NSIS 模板，包含上述更新策略。后续升级 Tauri CLI 时，应同步检查该模板。

播放器回归检查（先安装 `playwright`，使用本机 Edge）：`node tests/playerFullscreen.cjs`。

Windows 构建会自动合并 `src-tauri/tauri.windows.conf.json`：启动时显示居中的 1000×680 普通窗口，可以拖动边框调整大小，系统标题栏提供最小化、最大化/还原和关闭按钮。可修改该文件中的 `width`、`height` 调整初始尺寸。

```bash
npx tauri build --target x86_64-pc-windows-msvc
```
或者简写为：
```bash
npx tauri build
```
(在 Windows 环境下，默认会构建 .exe 安装包和 .msi 文件)

生成的应用包通常位于 Tauri 构建输出目录下的 `release/bundle/msi/` 和 `release/bundle/nsis/` 子目录中。

#### 在 macOS 上为 Windows (GNU 目标) 构建

如果你需要在 macOS 环境下交叉编译生成 Windows (GNU 目标) 的应用程序，可以按照以下步骤操作。这种方式通常比尝试构建 MSVC 目标更容易配置。

1.  **前提条件**:
    *   确保已安装 [Node.js](https://nodejs.org/) (推荐 LTS 版本) 和 npm。
    *   确保已安装 [Rust 和 `rustup`](https://www.rust-lang.org/tools/install)。
    *   确保已安装 [Homebrew](https://brew.sh/)。

2.  **安装 Rust GNU Windows 目标**:
    打开终端，运行以下命令来添加 `x86_64-pc-windows-gnu` 编译目标：
    ```bash
    rustup target add x86_64-pc-windows-gnu
    ```

3.  **安装 MinGW-w64 工具链**:
    MinGW-w64 提供了在 macOS 上为 Windows GNU 目标编译 C/C++ 代码所需的工具。通过 Homebrew 安装：
    ```bash
    brew install mingw-w64
    ```

4.  **安装 NSIS (用于创建 .exe 安装程序)**:
    NSIS 用于创建 `.exe` 格式的 Windows 安装程序。通过 Homebrew 安装：
    ```bash
    brew install nsis
    ```

5.  **配置 Cargo 链接器**:
    在项目根目录下创建（如果不存在）或修改 `.cargo/config.toml` 文件，并确保其包含以下内容，以指定正确的链接器和归档器：
    ```toml
    [target.x86_64-pc-windows-gnu]
    linker = "x86_64-w64-mingw32-gcc"
    ar = "x86_64-w64-mingw32-ar"
    ```

6.  **构建和打包应用**:
    完成以上配置后，运行以下命令来构建和打包应用：
    ```bash
    npm run tauri build -- --target x86_64-pc-windows-gnu
    ```
    如果之前已经成功编译过 `app.exe`，只想重新打包，可以使用：
    ```bash
    npm run tauri bundle -- --target x86_64-pc-windows-gnu
    ```

7.  **产物位置**:
    构建成功后，你可以在 Tauri 构建输出目录下的 `x86_64-pc-windows-gnu/release/` 及其 `bundle/nsis/` 子目录中找到相应的程序和安装包。

**注意**: 交叉编译有时会遇到特定环境的问题，如果上述步骤遇到困难，请参考 Tauri 和相关工具的官方文档，或考虑在原生的 Windows 环境中进行构建。

## 4. 打包移动应用

### Android
确保已根据 Tauri 文档配置好 Android 开发环境 (Android SDK, NDK)。
```bash
npx tauri android init  # 如果是首次为 Android 初始化项目
npx tauri android dev   # 在连接的设备或模拟器上以开发模式运行
npx tauri android build # 打包 Android 应用 (APK 和 AAB)
```
生成的应用包位于 Tauri Android 项目的生成目录中 (通常在 `src-tauri/gen/android/` 下的相关构建输出路径，例如 `app/build/outputs/apk/` 目录内)。

#### 最小化 Android 应用尺寸
Tauri 的 Android 构建过程默认会进行优化以减小应用尺寸，例如使用 R8进行代码缩减和混淆。
为进一步减小尺寸，可以考虑：
- **资源优化**: 确保图片等资源已压缩。
- **ABI拆分**: 如果不需要支持所有CPU架构的单个通用APK，可以在 `src-tauri/tauri.conf.json` 中配置 `tauri > bundle > android > abi` 来为特定架构构建APK，从而减小每个APK的大小。例如，只构建 `arm64-v8a` 和 `x86_64`。
- **ProGuard/R8 配置**: 更高级的优化可以通过自定义 `src-tauri/gen/android/app/build.gradle` 中的 ProGuard/R8 规则来实现，但这需要对 Android 构建系统有深入了解。

#### 签名 Android 应用
在将应用发布到应用商店之前，需要对其进行签名。以下是使用 `apksigner` 工具进行签名的示例命令。请确保已安装 Android SDK Build Tools。

**示例签名命令:**
```bash
# 替换以下路径和密码为你的实际值
# APKSIGNER_PATH: apksigner 工具的路径, 例如 $ANDROID_HOME/build-tools/VERSION/apksigner
# KEYSTORE_PATH: 你的签名密钥库文件路径, 例如 /path/to/your/release-key.jks
# KEY_ALIAS: 密钥别名, 例如 your_key_alias
# STORE_PASSWORD: 密钥库密码
# KEY_PASSWORD: 密钥密码
# UNSIGNED_APK_PATH: 未签名的APK文件路径, 例如在 Tauri Android 项目生成目录下的 app/build/outputs/apk/.../app-universal-release-unsigned.apk
# SIGNED_APK_PATH: 签名后的APK输出路径, 例如 /path/to/your/signed-app.apk

$APKSIGNER_PATH sign \\
  --verbose \\
  --ks $KEYSTORE_PATH \\
  --ks-key-alias $KEY_ALIAS \\
  --ks-pass pass:$STORE_PASSWORD \\
  --key-pass pass:$KEY_PASSWORD \\
  --out $SIGNED_APK_PATH \\
  $UNSIGNED_APK_PATH
```
**注意**: 强烈建议将密钥库文件和密码等敏感信息存储在安全的地方，并不要直接硬编码到脚本或版本控制中。可以考虑使用环境变量或安全的密钥管理工具。

### iOS
确保已根据 Tauri 文档配置好 iOS 开发环境 (Xcode, CocoaPods)。
```bash
npx tauri ios init     # 如果是首次为 iOS 初始化项目
npx tauri ios dev      # 在连接的设备或模拟器上以开发模式运行
npx tauri ios build    # 打包 iOS 应用 (.app)
```
生成的应用包通常通过 Xcode 进行归档和分发。

**注意:**
- 移动端打包可能需要额外的配置和特定平台的工具链。请务必参考最新的 [Tauri 移动端文档](https://tauri.app/v1/guides/distribution/mobile/)。
- 上述命令应在项目根目录下执行。
