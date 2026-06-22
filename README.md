# CursorFusion

跨平台鼠标光标特效叠加工具。纯 C# 实现，winit 渲染层，Avalonia 管理界面。

## 架构

```
┌─────────────────────────────────────┐
│  CursorFusion.Core (C# .NET 8.0)    │
│  ├── Mouse/    鼠标追踪 (X11/Wayland/macOS/Windows)
│  ├── Overlay/  光标叠加渲染 (winit + SkiaSharp)
│  ├── Config/   配置管理
│  ├── Logger/   日志
│  ├── Version/  语义化版本
│  └── FileUtils/ 文件工具
├─────────────────────────────────────┤
│  CursorFusion.App (Avalonia)         │
│  └── 设置/状态管理界面 (暗色主题)      │
├─────────────────────────────────────┤
│  Deno 扩展引擎 (src/deno/)            │
│  └── 用户自定义扩展 (JSON-RPC)        │
└─────────────────────────────────────┘
```

## 平台支持

| 平台 | 鼠标追踪 | 叠加渲染 | 管理界面 |
|------|:--:|:--:|:--:|
| Linux (X11) | xdotool | winit + Vulkan/OpenGL | Avalonia |
| Linux (Wayland) | ydotool/swaymsg/hyprctl | winit + Vulkan/OpenGL | Avalonia |
| macOS | CoreGraphics | winit + Metal | Avalonia |
| Windows | Win32 API | winit + DirectX | Avalonia |

## 开发

### 前置要求

- .NET 8.0 SDK
- Deno (扩展开发)

### 构建

```bash
# 核心库 + 测试
dotnet build src/core/cs/CursorFusion.Core/CursorFusion.Core.csproj
dotnet test src/core/cs/CursorFusion.Core.Tests/CursorFusion.Core.Tests.csproj

# 桌面应用
dotnet run --project src/core/cs/CursorFusion.App/CursorFusion.App.csproj
```

### 发布

```bash
# 单文件自包含发布
dotnet publish src/core/cs/CursorFusion.App/CursorFusion.App.csproj \
  --configuration Release \
  --runtime <RID> \
  --self-contained true \
  --output dist/
```

## 项目结构

```
src/
├── core/cs/
│   ├── CursorFusion.Core/       核心逻辑库
│   ├── CursorFusion.Core.Tests/ xUnit 测试 (68 个)
│   └── CursorFusion.App/        Avalonia 桌面应用
└── deno/                        Deno 扩展运行时
    ├── mod.ts                   主入口
    ├── loader.ts                扩展加载器
    ├── runtime.ts               JSON-RPC 通信
    └── extensions/              用户扩展目录
```

## 隐私

所有鼠标数据纯本地处理，不上传任何信息。光标叠加效果使用透明覆盖层窗口渲染，不修改系统光标文件。

部分平台需要授予权限：
- **macOS**: 辅助功能权限（系统设置 → 隐私与安全性）
- **Wayland**: 需要 input 组成员或 root 权限

## 许可

AGPL-3.0