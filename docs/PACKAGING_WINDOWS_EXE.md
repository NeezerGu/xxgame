# Windows 可执行文件打包与运行指南

## 环境准备
- 先运行 `npm install` 安装依赖。

## 开发模式
- 使用 `npm run dev` 启动 Vite 开发服务器，在浏览器或 Electron 调试环境中访问。

## 生成 Windows 安装包与便携版
- 运行 `npm run dist:win`：会先构建前端，再调用 electron-builder 生成 NSIS 安装包和 portable 单文件 exe（不生成 latest.yml / blockmap）。
- 生成物会放在项目根目录的 `release/` 目录下。
- 运行 `npm run dist:win:portable`：仅构建 portable 单文件 exe（同样不会生成 latest.yml / blockmap）。

## 给朋友分发与运行
- 推荐直接发送 portable 单文件给朋友：`MysticWorkshopPrototype-<version>-Portable.exe`，无需安装，解压后双击即可运行。
- 需要安装体验时，可使用安装包：`MysticWorkshopPrototype-Setup-<version>.exe`，按向导安装后启动。

## 产物文件名示例
- NSIS 安装包：`MysticWorkshopPrototype-Setup-0.1.0.exe`
- Portable 单文件：`MysticWorkshopPrototype-0.1.0-Portable.exe`

## 常见问题
- SmartScreen 或杀毒软件可能弹出警告：本地签名缺失属正常，可选择“仍要运行”或将文件加入信任。
- 打包体积较大：Electron 依赖完整运行时，几十到上百 MB 属正常范围。
