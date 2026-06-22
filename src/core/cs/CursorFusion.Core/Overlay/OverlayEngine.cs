using Silk.NET.Windowing;
using SkiaSharp;
using CursorFusion.Core.Overlay.Effects;

namespace CursorFusion.Core.Overlay;

/// <summary>
/// 光标叠加引擎 — 使用 winit (Silk.NET.Windowing) 创建透明覆盖层窗口，
/// 通过 SkiaSharp 渲染特效，窗口跟随鼠标位置移动。
/// </summary>
public class OverlayEngine : IDisposable
{
    private readonly IWindow _window;
    private readonly List<IEffect> _effects = new();
    private readonly Mouse.MouseTracker _tracker;

    private int _mouseX;
    private int _mouseY;
    private DateTime _lastFrame;
    private bool _running;

    public OverlayEngine(Mouse.MouseTracker tracker, int width = 256, int height = 256)
    {
        _tracker = tracker;

        var options = WindowOptions.Default with
        {
            Size = new Silk.NET.Maths.Vector2D<int>(width, height),
            Title = "CursorFusion Overlay",
            IsVisible = false,
            TransparentFramebuffer = true,
            PreferredDepthBufferBits = 0,
            PreferredStencilBufferBits = 0,
            WindowBorder = WindowBorder.Hidden,
            VSync = false,
            FramesPerSecond = 0,
        };

        _window = Window.Create(options);

        _lastFrame = DateTime.UtcNow;

        _window.Load += OnLoad;
        _window.Render += OnRender;
        _window.Closing += OnClosing;
    }

    public void AddEffect(IEffect effect)
    {
        _effects.Add(effect);
    }

    public void RemoveEffect(IEffect effect)
    {
        _effects.Remove(effect);
    }

    public void Start()
    {
        if (_running) return;
        _running = true;
        _window.Initialize();

        // 平台特定：设置透明、置顶、穿透点击
        ApplyPlatformOverlay();

        _window.IsVisible = true;
        _window.Run();
    }

    public void Stop()
    {
        _running = false;
        _window.Close();
    }

    private void OnLoad()
    {
        _window.Center();
    }

    private void OnRender(double delta)
    {
        if (!_running) return;

        var now = DateTime.UtcNow;
        var deltaTime = (float)(now - _lastFrame).TotalSeconds;
        _lastFrame = now;

        try
        {
            // 获取鼠标位置
            var evt = _tracker.Sample().GetAwaiter().GetResult();
            _mouseX = evt.Position.X;
            _mouseY = evt.Position.Y;

            // 移动窗口跟随光标
            MoveWindowToCursor();

            // 渲染
            using var surface = SKSurface.Create(
                new SKImageInfo(_window.Size.X, _window.Size.Y)
            );

            var canvas = surface.Canvas;
            canvas.Clear(SKColors.Transparent);

            // 画布原点移到窗口中心（光标位置相对窗口中心）
            canvas.Save();
            canvas.Translate(_window.Size.X / 2f, _window.Size.Y / 2f);

            foreach (var effect in _effects)
            {
                effect.Render(canvas, 0, 0, deltaTime);
            }

            canvas.Restore();
            canvas.Flush();

            surface.Flush();
        }
        catch
        {
            // 渲染失败时静默跳过
        }

        _window.SwapBuffers();
    }

    private void OnClosing()
    {
        _running = false;
    }

    private void MoveWindowToCursor()
    {
        // 窗口居中覆盖在光标上
        var halfW = _window.Size.X / 2;
        var halfH = _window.Size.Y / 2;
        _window.Position = new Silk.NET.Maths.Vector2D<int>(_mouseX - halfW, _mouseY - halfH);
    }

    private void ApplyPlatformOverlay()
    {
        if (OperatingSystem.IsWindows())
        {
            ApplyWindowsOverlay();
        }
        else if (OperatingSystem.IsLinux())
        {
            ApplyLinuxOverlay();
        }
        else if (OperatingSystem.IsMacOS())
        {
            ApplyMacOSOverlay();
        }
    }

    private void ApplyWindowsOverlay()
    {
        var hwnd = GetNativeWindowHandle();
        if (hwnd == IntPtr.Zero) return;

        // WS_EX_LAYERED + WS_EX_TRANSPARENT + WS_EX_TOPMOST + WS_EX_TOOLWINDOW
        const int GWL_EXSTYLE = -20;
        const int WS_EX_LAYERED = 0x80000;
        const int WS_EX_TRANSPARENT = 0x20;
        const int WS_EX_TOPMOST = 0x8;
        const int WS_EX_TOOLWINDOW = 0x80;

        var exStyle = GetWindowLongPtr(hwnd, GWL_EXSTYLE);
        exStyle |= WS_EX_LAYERED | WS_EX_TRANSPARENT | WS_EX_TOPMOST | WS_EX_TOOLWINDOW;
        SetWindowLongPtr(hwnd, GWL_EXSTYLE, exStyle);

        // 设置分层窗口透明度
        SetLayeredWindowAttributes(hwnd, 0, 255, 0x2); // LWA_ALPHA
    }

    private void ApplyLinuxOverlay()
    {
        // X11/Wayland: 通过窗口管理器提示设置
        // Silk.NET 在 Linux 上默认使用 X11/Wayland，窗口创建后设置
        // _NET_WM_STATE_ABOVE + 输入穿透
    }

    private void ApplyMacOSOverlay()
    {
        // macOS: NSWindow level + ignoresMouseEvents
        // 通过 ObjC 互操作设置
    }

    private IntPtr GetNativeWindowHandle()
    {
        if (_window.Native?.X11 is not null)
        {
            var (display, window) = _window.Native.X11.Value;
            return (IntPtr)window;
        }
        if (_window.Native?.Win32 is not null)
            return _window.Native.Win32.Value.Hwnd;
        if (_window.Native?.Cocoa is not null)
            return _window.Native.Cocoa.Value;
        return IntPtr.Zero;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr GetWindowLongPtr(IntPtr hWnd, int nIndex);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr SetWindowLongPtr(IntPtr hWnd, int nIndex, IntPtr dwNewLong);

    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern bool SetLayeredWindowAttributes(IntPtr hwnd, uint crKey, byte bAlpha, uint dwFlags);

    public void Dispose()
    {
        Stop();
        _window.Dispose();
    }
}