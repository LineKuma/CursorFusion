using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CursorFusion.Core.Mouse.Types;

namespace CursorFusion.Core.Mouse.Platforms;

public partial class MacOSPlatform : BasePlatform
{
    public override string Name => "macos";
    private int? _screenW, _screenH;

    public override bool IsAvailable => OperatingSystem.IsMacOS();

    public override (int? Width, int? Height) GetScreenSize()
    {
        if (_screenW.HasValue && _screenH.HasValue) return (_screenW, _screenH);

        var script = "tell application \"Finder\" to get bounds of window of desktop";
        var out1 = TryExec($"osascript -e '{script}' 2>/dev/null");
        if (!string.IsNullOrEmpty(out1))
        {
            var m = Regex.Match(out1, @"(\d+)\s*x\s*(\d+)");
            if (m.Success) { _screenW = int.Parse(m.Groups[1].Value); _screenH = int.Parse(m.Groups[2].Value); return (_screenW, _screenH); }
        }

        if (!_screenW.HasValue)
        {
            var sp = TryExec("system_profiler SPDisplaysDataType 2>/dev/null | grep Resolution");
            if (!string.IsNullOrEmpty(sp))
            {
                var m = Regex.Match(sp, @"(\d+)\s*x\s*(\d+)");
                if (m.Success) { _screenW = int.Parse(m.Groups[1].Value); _screenH = int.Parse(m.Groups[2].Value); return (_screenW, _screenH); }
            }
        }

        return (_screenW, _screenH);
    }

    public override async Task<MouseEvent> GetPosition()
    {
        var (w, h) = GetScreenSize();
        int x = 0, y = 0;
        await Task.Yield();

        var script = @"ObjC.import('CoreGraphics'); var pos = $.CGEventGetLocation($.CGEventCreate(null)); pos.x + ',' + pos.y";
        var out1 = TryExec($"osascript -l JavaScript -e '{script}' 2>/dev/null");
        if (!string.IsNullOrEmpty(out1))
        {
            var parts = out1.Split(',');
            if (parts.Length >= 2) { x = int.TryParse(parts[0].Trim(), out var px) ? px : 0; y = int.TryParse(parts[1].Trim(), out var py) ? py : 0; }
        }
        else
        {
            var fallback = TryExec("osascript -e 'tell application \"System Events\" to get the position of the mouse' 2>/dev/null");
            if (!string.IsNullOrEmpty(fallback))
            {
                var m = Regex.Match(fallback, @"(\d+)\s*,\s*(\d+)");
                if (m.Success) { x = int.Parse(m.Groups[1].Value); y = int.Parse(m.Groups[2].Value); }
            }
        }

        return MouseEvent.Create(x, y, null, CursorTypes.Default, Name, w, h);
    }

    public override async Task<MouseEvent> GetState()
    {
        var buttons = new List<MouseButtonState>();
        await Task.Yield();

        var script = @"ObjC.import('CoreGraphics'); var left = $.CGEventSourceButtonState($.kCGEventSourceStateHIDSystemState, $.kCGMouseButtonLeft); var right = $.CGEventSourceButtonState($.kCGEventSourceStateHIDSystemState, $.kCGMouseButtonRight); var center = $.CGEventSourceButtonState($.kCGEventSourceStateHIDSystemState, $.kCGMouseButtonCenter); 'LEFT:' + left + '|RIGHT:' + right + '|CENTER:' + center";
        var out1 = TryExec($"osascript -l JavaScript -e '{script}' 2>/dev/null");
        if (!string.IsNullOrEmpty(out1))
        {
            var lm = Regex.Match(out1, @"LEFT:(\d+)");
            var rm = Regex.Match(out1, @"RIGHT:(\d+)");
            var cm = Regex.Match(out1, @"CENTER:(\d+)");
            if (lm.Success && lm.Groups[1].Value == "1") buttons.Add(new MouseButtonState { Button = 0, Pressed = true });
            if (rm.Success && rm.Groups[1].Value == "1") buttons.Add(new MouseButtonState { Button = 2, Pressed = true });
            if (cm.Success && cm.Groups[1].Value == "1") buttons.Add(new MouseButtonState { Button = 1, Pressed = true });
        }

        var cursorType = DetectCursorType();
        var (w, h) = GetScreenSize();
        return MouseEvent.Create(0, 0, buttons.Select(b => (b.Button, b.Pressed)), cursorType, Name, w, h);
    }

    private string DetectCursorType()
    {
        var frontApp = TryExec("osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true' 2>/dev/null");
        if (string.IsNullOrEmpty(frontApp)) return CursorTypes.Default;
        var app = frontApp.ToLowerInvariant().Trim();

        if (new[] { "terminal", "iterm", "code", "vim", "nvim", "emacs", "xcode", "textedit", "sublime", "atom", "bbedit", "nova" }.Any(t => app.Contains(t)))
            return CursorTypes.Text;
        if (new[] { "safari", "chrome", "firefox", "edge", "opera", "brave", "chromium" }.Any(b => app.Contains(b)))
            return CursorTypes.Pointer;
        return CursorTypes.Default;
    }
}