using System;
using System.Threading;
using System.Threading.Tasks;
using CursorFusion.Core.Mouse.Platforms;
using CursorFusion.Core.Mouse.Types;

namespace CursorFusion.Core.Mouse;

public class MouseTracker
{
    private BasePlatform _platform;
    private bool _initialized;
    private CancellationTokenSource? _cts;

    public MouseTracker() { _platform = null!; Init(); }

    public string PlatformName => _platform.Name;

    public MouseTracker Init()
    {
        if (_initialized) return this;

        if (OperatingSystem.IsMacOS())
            _platform = new MacOSPlatform();
        else if (OperatingSystem.IsLinux() || OperatingSystem.IsFreeBSD())
            _platform = DetectLinuxPlatform();
        else
            _platform = new UnknownPlatform();

        _initialized = true;
        return this;
    }

    private static BasePlatform DetectLinuxPlatform()
    {
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY")) ||
            "wayland".Equals(Environment.GetEnvironmentVariable("XDG_SESSION_TYPE"), StringComparison.OrdinalIgnoreCase))
            return new WaylandPlatform();
        if (!string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DISPLAY")))
            return new X11Platform();
        return new UnknownPlatform();
    }

    public async Task<MouseEvent> GetPosition() { EnsureInit(); return await _platform.GetPosition(); }
    public async Task<MouseEvent> GetState() { EnsureInit(); return await _platform.GetState(); }
    public async Task<MouseEvent> Sample() { EnsureInit(); return await _platform.Sample(); }

    public Action Track(int intervalMs, Action<MouseEvent?, Exception?> callback)
    {
        EnsureInit();
        var cts = new CancellationTokenSource();
        _cts = cts;

        Task.Run(async () =>
        {
            while (!cts.Token.IsCancellationRequested)
            {
                try { var evt = await _platform.Sample(); callback(evt, null); }
                catch (Exception ex) { callback(null, ex); }
                try { await Task.Delay(intervalMs, cts.Token); }
                catch (OperationCanceledException) { break; }
            }
        }, cts.Token);

        return () => { _cts?.Cancel(); _cts?.Dispose(); _cts = null; };
    }

    private void EnsureInit() { if (!_initialized) Init(); }
}

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