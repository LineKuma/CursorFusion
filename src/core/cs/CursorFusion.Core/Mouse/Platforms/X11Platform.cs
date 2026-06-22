using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CursorFusion.Core.Mouse.Types;

namespace CursorFusion.Core.Mouse.Platforms;

public partial class X11Platform : BasePlatform
{
    public override string Name => "x11";
    private int? _screenW, _screenH;

    public override bool IsAvailable
    {
        get
        {
            if (!OperatingSystem.IsLinux() && !OperatingSystem.IsFreeBSD()) return false;
            return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DISPLAY"));
        }
    }

    public override (int? Width, int? Height) GetScreenSize()
    {
        if (_screenW.HasValue && _screenH.HasValue) return (_screenW, _screenH);

        var out1 = TryExec("xdpyinfo 2>/dev/null | grep 'dimensions:'");
        if (!string.IsNullOrEmpty(out1))
        {
            var m = Regex.Match(out1, @"(\d+)x(\d+)\s+pixels");
            if (m.Success) { _screenW = int.Parse(m.Groups[1].Value); _screenH = int.Parse(m.Groups[2].Value); return (_screenW, _screenH); }
        }

        var out2 = TryExec("xrandr 2>/dev/null | grep '\\*' | head -1");
        if (!string.IsNullOrEmpty(out2))
        {
            var m = Regex.Match(out2, @"(\d+)\s*x\s*(\d+)");
            if (m.Success) { _screenW = int.Parse(m.Groups[1].Value); _screenH = int.Parse(m.Groups[2].Value); return (_screenW, _screenH); }
        }

        return (_screenW, _screenH);
    }

    public override Task<MouseEvent> GetPosition()
    {
        var raw = Exec("xdotool getmouselocation --shell 2>/dev/null");
        var parsed = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in raw.Split('\n'))
        {
            var eq = line.IndexOf('=');
            if (eq > 0) parsed[line[..eq]] = line[(eq + 1)..];
        }
        var (w, h) = GetScreenSize();
        parsed.TryGetValue("X", out var xs);
        parsed.TryGetValue("Y", out var ys);
        return Task.FromResult(MouseEvent.Create(
            int.TryParse(xs, out var px) ? px : 0,
            int.TryParse(ys, out var py) ? py : 0,
            null, CursorTypes.Default, Name, w, h));
    }

    public override async Task<MouseEvent> GetState()
    {
        var buttons = new List<MouseButtonState>();
        await Task.Yield();

        var pointerId = FindPointerId();
        if (pointerId.HasValue)
        {
            var state = TryExec($"xinput --query-state {pointerId.Value} 2>/dev/null");
            if (!string.IsNullOrEmpty(state))
            {
                foreach (var (name, code) in new Dictionary<string, int> { { "left", 0 }, { "middle", 1 }, { "right", 2 } })
                    buttons.Add(new MouseButtonState { Button = code, Pressed = new Regex($@"button\[{name}\].*?=.*?down", RegexOptions.IgnoreCase).IsMatch(state) });
            }
        }

        var cursorType = DetectCursorType();
        var (w, h) = GetScreenSize();
        return MouseEvent.Create(0, 0, buttons.Select(b => (b.Button, b.Pressed)), cursorType, Name, w, h);
    }

    private int? FindPointerId()
    {
        var out1 = TryExec("xinput --list --short 2>/dev/null");
        if (string.IsNullOrEmpty(out1)) return null;
        var m = Regex.Match(out1, @"pointer.*?id=(\d+)", RegexOptions.IgnoreCase);
        return m.Success ? int.Parse(m.Groups[1].Value) : null;
    }

    private string DetectCursorType()
    {
        var xset = TryExec("xset q 2>/dev/null");
        if (!string.IsNullOrEmpty(xset) && xset.Contains("Cursor off")) return CursorTypes.None;

        var winId = TryExec("xdotool getactivewindow 2>/dev/null");
        if (string.IsNullOrEmpty(winId)) return CursorTypes.Default;

        var cursorName = TryExec($"xprop -id {winId} -notype 32c 'XCURSOR_NAME' 2>/dev/null | cut -d'\"' -f2");
        if (string.IsNullOrEmpty(cursorName)) return CursorTypes.Default;

        var lower = cursorName.ToLowerInvariant();
        if (lower.Contains("text") || lower.Contains("ibeam") || lower.Contains("xterm")) return CursorTypes.Text;
        if (lower.Contains("wait") || lower.Contains("watch") || lower.Contains("clock")) return CursorTypes.Wait;
        if (lower.Contains("hand") || lower.Contains("pointer")) return CursorTypes.Pointer;
        return CursorTypes.Default;
    }
}