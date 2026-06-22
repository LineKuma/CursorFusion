using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CursorFusion.Mouse.Types;

namespace CursorFusion.Mouse.Platforms;

/// <summary>
/// macOS 平台鼠标追踪实现
/// 依赖: CoreGraphics (via JXA/osascript), system_profiler
/// </summary>
public partial class MacOSPlatform : BasePlatform
{
    public override string Name => "macos";

    private int? _screenW;
    private int? _screenH;

    public override bool IsAvailable => OperatingSystem.IsMacOS();

    public override (int? Width, int? Height) GetScreenSize()
    {
        if (_screenW.HasValue && _screenH.HasValue)
            return (_screenW, _screenH);

        // 策略 1: osascript Finder bounds
        var script = "tell application \"Finder\" to get bounds of window of desktop";
        var out1 = TryExec($"osascript -e '{script}' 2>/dev/null");
        if (!string.IsNullOrEmpty(out1))
        {
            var match = Regex.Match(out1, @"(\d+)\s*x\s*(\d+)");
            if (match.Success)
            {
                _screenW = int.Parse(match.Groups[1].Value);
                _screenH = int.Parse(match.Groups[2].Value);
                return (_screenW, _screenH);
            }
        }

        // 策略 2: system_profiler
        if (!_screenW.HasValue)
        {
            var sp = TryExec("system_profiler SPDisplaysDataType 2>/dev/null | grep Resolution");
            if (!string.IsNullOrEmpty(sp))
            {
                var match = Regex.Match(sp, @"(\d+)\s*x\s*(\d+)");
                if (match.Success)
                {
                    _screenW = int.Parse(match.Groups[1].Value);
                    _screenH = int.Parse(match.Groups[2].Value);
                    return (_screenW, _screenH);
                }
            }
        }

        return (_screenW, _screenH);
    }

    public override async Task<MouseEvent> GetPosition()
    {
        var (width, height) = GetScreenSize();
        int x = 0, y = 0;

        await Task.Yield();

        // 策略 1: JXA 调用 CoreGraphics
        var script = @"ObjC.import('CoreGraphics'); var pos = $.CGEventGetLocation($.CGEventCreate(null)); pos.x + ',' + pos.y";
        var out1 = TryExec($"osascript -l JavaScript -e '{script}' 2>/dev/null");
        if (!string.IsNullOrEmpty(out1))
        {
            var parts = out1.Split(',');
            if (parts.Length >= 2)
            {
                x = int.TryParse(parts[0].Trim(), out var px) ? px : 0;
                y = int.TryParse(parts[1].Trim(), out var py) ? py : 0;
            }
        }
        else
        {
            // 策略 2: 传统 AppleScript
            var fallback = TryExec(
                "osascript -e 'tell application \"System Events\" to get the position of the mouse' 2>/dev/null"
            );
            if (!string.IsNullOrEmpty(fallback))
            {
                var match = Regex.Match(fallback, @"(\d+)\s*,\s*(\d+)");
                if (match.Success)
                {
                    x = int.Parse(match.Groups[1].Value);
                    y = int.Parse(match.Groups[2].Value);
                }
            }
        }

        return MouseEvent.Create(
            x, y, null, CursorTypes.Default, Name, width, height
        );
    }

    public override async Task<MouseEvent> GetState()
    {
        var buttons = new List<MouseButtonState>();
        var cursorType = CursorTypes.Default;

        await Task.Yield();

        // 按键检测：JXA 调用 CGEventSourceButtonState
        var buttonStates = GetButtonStates();
        buttons.AddRange(buttonStates.Select(b => new MouseButtonState
        {
            Button = b.button,
            Pressed = b.pressed
        }));

        // 光标类型
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

    private List<(int button, bool pressed)> GetButtonStates()
    {
        var result = new List<(int, bool)>();

        var script = @"
ObjC.import('CoreGraphics');
var left = $.CGEventSourceButtonState($.kCGEventSourceStateHIDSystemState, $.kCGMouseButtonLeft);
var right = $.CGEventSourceButtonState($.kCGEventSourceStateHIDSystemState, $.kCGMouseButtonRight);
var center = $.CGEventSourceButtonState($.kCGEventSourceStateHIDSystemState, $.kCGMouseButtonCenter);
'LEFT:' + left + '|RIGHT:' + right + '|CENTER:' + center";

        var out1 = TryExec($"osascript -l JavaScript -e '{script}' 2>/dev/null");
        if (!string.IsNullOrEmpty(out1))
        {
            var leftMatch = Regex.Match(out1, @"LEFT:(\d+)");
            var rightMatch = Regex.Match(out1, @"RIGHT:(\d+)");
            var centerMatch = Regex.Match(out1, @"CENTER:(\d+)");

            if (leftMatch.Success && leftMatch.Groups[1].Value == "1")
                result.Add((0, true));
            if (rightMatch.Success && rightMatch.Groups[1].Value == "1")
                result.Add((2, true));
            if (centerMatch.Success && centerMatch.Groups[1].Value == "1")
                result.Add((1, true));
        }

        return result;
    }

    private string DetectCursorType()
    {
        var frontApp = TryExec(
            "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true' 2>/dev/null"
        );

        if (string.IsNullOrEmpty(frontApp))
            return CursorTypes.Default;

        var app = frontApp.ToLowerInvariant().Trim();

        var textApps = new[]
        {
            "terminal", "iterm", "code", "vim", "nvim", "emacs", "xcode",
            "textedit", "sublime", "atom", "bbedit", "nova"
        };

        var browserApps = new[]
        {
            "safari", "chrome", "firefox", "edge", "opera", "brave", "chromium"
        };

        if (textApps.Any(t => app.Contains(t)))
            return CursorTypes.Text;
        if (browserApps.Any(b => app.Contains(b)))
            return CursorTypes.Pointer;

        return CursorTypes.Default;
    }
}