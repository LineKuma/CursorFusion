using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CursorFusion.Mouse.Types;

namespace CursorFusion.Mouse.Platforms;

/// <summary>
/// Linux X11 平台鼠标追踪实现
/// 依赖: xdotool, xdpyinfo, xinput, xset, xprop
/// </summary>
public partial class X11Platform : BasePlatform
{
    public override string Name => "x11";

    private int? _screenW;
    private int? _screenH;

    public override bool IsAvailable
    {
        get
        {
            if (!OperatingSystem.IsLinux() && !OperatingSystem.IsFreeBSD())
                return false;

            var display = Environment.GetEnvironmentVariable("DISPLAY");
            return !string.IsNullOrEmpty(display);
        }
    }

    public override (int? Width, int? Height) GetScreenSize()
    {
        if (_screenW.HasValue && _screenH.HasValue)
            return (_screenW, _screenH);

        // 策略 1: xdpyinfo
        var out1 = TryExec("xdpyinfo 2>/dev/null | grep 'dimensions:'");
        if (!string.IsNullOrEmpty(out1))
        {
            var match = Regex.Match(out1, @"(\d+)x(\d+)\s+pixels");
            if (match.Success)
            {
                _screenW = int.Parse(match.Groups[1].Value);
                _screenH = int.Parse(match.Groups[2].Value);
                return (_screenW, _screenH);
            }
        }

        // 策略 2: xrandr
        var out2 = TryExec("xrandr 2>/dev/null | grep '\\*' | head -1");
        if (!string.IsNullOrEmpty(out2))
        {
            var match = Regex.Match(out2, @"(\d+)\s*x\s*(\d+)");
            if (match.Success)
            {
                _screenW = int.Parse(match.Groups[1].Value);
                _screenH = int.Parse(match.Groups[2].Value);
                return (_screenW, _screenH);
            }
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
            if (eq > 0)
                parsed[line[..eq]] = line[(eq + 1)..];
        }

        var (width, height) = GetScreenSize();

        parsed.TryGetValue("X", out var xStr);
        parsed.TryGetValue("Y", out var yStr);

        var evt = MouseEvent.Create(
            int.TryParse(xStr, out var px) ? px : 0,
            int.TryParse(yStr, out var py) ? py : 0,
            null,
            CursorTypes.Default,
            Name,
            width,
            height
        );

        return Task.FromResult(evt);
    }

    public override async Task<MouseEvent> GetState()
    {
        var buttons = new List<MouseButtonState>();
        var cursorType = CursorTypes.Default;

        await Task.Yield();

        // 按键检测
        var pointerId = FindPointerId();
        if (pointerId.HasValue)
        {
            var state = TryExec($"xinput --query-state {pointerId.Value} 2>/dev/null");
            if (!string.IsNullOrEmpty(state))
            {
                var buttonMap = new Dictionary<string, int>
                {
                    { "left", 0 }, { "middle", 1 }, { "right", 2 }
                };

                foreach (var (name, code) in buttonMap)
                {
                    var regex = new Regex($@"button\[{name}\].*?=.*?down", RegexOptions.IgnoreCase);
                    buttons.Add(new MouseButtonState
                    {
                        Button = code,
                        Pressed = regex.IsMatch(state)
                    });
                }
            }
        }

        // 光标类型检测
        cursorType = DetectCursorType();

        var (width, height) = GetScreenSize();

        return MouseEvent.Create(
            0, 0,
            buttons.Select(b => (b.Button, b.Pressed)),
            cursorType,
            Name,
            width,
            height
        );
    }

    private int? FindPointerId()
    {
        var out1 = TryExec("xinput --list --short 2>/dev/null");
        if (string.IsNullOrEmpty(out1)) return null;

        var match = Regex.Match(out1, @"pointer.*?id=(\d+)", RegexOptions.IgnoreCase);
        return match.Success ? int.Parse(match.Groups[1].Value) : null;
    }

    private string DetectCursorType()
    {
        // 检查光标是否隐藏
        var xset = TryExec("xset q 2>/dev/null");
        if (!string.IsNullOrEmpty(xset) && xset.Contains("Cursor off"))
            return CursorTypes.None;

        // 尝试获取当前窗口的光标名
        var winId = TryExec("xdotool getactivewindow 2>/dev/null");
        if (string.IsNullOrEmpty(winId)) return CursorTypes.Default;

        var cursorName = TryExec(
            $"xprop -id {winId} -notype 32c 'XCURSOR_NAME' 2>/dev/null | cut -d'\"' -f2"
        );

        if (string.IsNullOrEmpty(cursorName))
            return CursorTypes.Default;

        var lower = cursorName.ToLowerInvariant();

        if (lower.Contains("text") || lower.Contains("ibeam") || lower.Contains("xterm"))
            return CursorTypes.Text;
        if (lower.Contains("wait") || lower.Contains("watch") || lower.Contains("clock"))
            return CursorTypes.Wait;
        if (lower.Contains("hand") || lower.Contains("pointer"))
            return CursorTypes.Pointer;

        return CursorTypes.Default;
    }
}

public static partial class X11PlatformExtensions
{
    [GeneratedRegex(@"(\d+)x(\d+)\s+pixels")]
    private static partial Regex DimensionsRegex();

    [GeneratedRegex(@"(\d+)\s*x\s*(\d+)")]
    private static partial Regex XrandrRegex();
}