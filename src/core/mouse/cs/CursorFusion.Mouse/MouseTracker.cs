using System;
using System.Threading;
using System.Threading.Tasks;
using CursorFusion.Mouse.Platforms;
using CursorFusion.Mouse.Types;

namespace CursorFusion.Mouse;

/// <summary>
/// 鼠标追踪器主类，自动检测平台并提供统一的鼠标事件获取接口
/// </summary>
public class MouseTracker
{
    private BasePlatform _platform;
    private bool _initialized;
    private CancellationTokenSource? _cts;

    public MouseTracker()
    {
        _platform = null!;
        Init();
    }

    /// <summary>当前平台名称</summary>
    public string PlatformName => _platform.Name;

    /// <summary>初始化：自动检测平台</summary>
    public MouseTracker Init()
    {
        if (_initialized) return this;

        // 按优先级尝试各平台
        if (OperatingSystem.IsMacOS())
        {
            _platform = new MacOSPlatform();
        }
        else if (OperatingSystem.IsLinux() || OperatingSystem.IsFreeBSD())
        {
            var platform = DetectLinuxPlatform();
            _platform = platform;
        }
        else
        {
            _platform = new UnknownPlatform();
        }

        _initialized = true;
        return this;
    }

    private static BasePlatform DetectLinuxPlatform()
    {
        var waylandDisplay = Environment.GetEnvironmentVariable("WAYLAND_DISPLAY");
        var sessionType = Environment.GetEnvironmentVariable("XDG_SESSION_TYPE");
        var display = Environment.GetEnvironmentVariable("DISPLAY");

        // 优先 Wayland
        if (!string.IsNullOrEmpty(waylandDisplay) ||
            "wayland".Equals(sessionType, StringComparison.OrdinalIgnoreCase))
        {
            return new WaylandPlatform();
        }

        // 其次 X11
        if (!string.IsNullOrEmpty(display))
        {
            return new X11Platform();
        }

        return new UnknownPlatform();
    }

    /// <summary>获取当前鼠标位置</summary>
    public async Task<MouseEvent> GetPosition()
    {
        EnsureInit();
        return await _platform.GetPosition();
    }

    /// <summary>获取当前鼠标状态</summary>
    public async Task<MouseEvent> GetState()
    {
        EnsureInit();
        return await _platform.GetState();
    }

    /// <summary>采样：同时获取位置和状态</summary>
    public async Task<MouseEvent> Sample()
    {
        EnsureInit();
        return await _platform.Sample();
    }

    /// <summary>
    /// 开始定时追踪，回调接收 MouseEvent 或错误
    /// 返回一个 Action 用于停止追踪
    /// </summary>
    public Action Track(int intervalMs, Action<MouseEvent?, Exception?> callback)
    {
        EnsureInit();
        var cts = new CancellationTokenSource();
        _cts = cts;

        Task.Run(async () =>
        {
            while (!cts.Token.IsCancellationRequested)
            {
                try
                {
                    var evt = await _platform.Sample();
                    callback(evt, null);
                }
                catch (Exception ex)
                {
                    callback(null, ex);
                }

                try
                {
                    await Task.Delay(intervalMs, cts.Token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }, cts.Token);

        return () =>
        {
            _cts?.Cancel();
            _cts?.Dispose();
            _cts = null;
        };
    }

    private void EnsureInit()
    {
        if (!_initialized) Init();
    }
}

/// <summary>
/// 未知平台的回退实现
/// </summary>
internal class UnknownPlatform : BasePlatform
{
    public override string Name => "unknown";
    public override bool IsAvailable => false;

    public override (int? Width, int? Height) GetScreenSize() => (null, null);

    public override Task<MouseEvent> GetPosition() =>
        Task.FromResult(MouseEvent.Create(0, 0, null, CursorTypes.Unknown, Name));

    public override Task<MouseEvent> GetState() =>
        Task.FromResult(MouseEvent.Create(0, 0, null, CursorTypes.Unknown, Name));
}