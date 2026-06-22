using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CursorFusion.Mouse.Types;

namespace CursorFusion.Mouse.Platforms;

/// <summary>
/// Linux Wayland 平台鼠标追踪实现
/// 依赖: ydotool, wlr-randr, swaymsg, hyprctl, libinput
/// </summary>
public partial class WaylandPlatform : BasePlatform
{
    public override string Name => "wayland";

    private int? _screenW;
    private int? _screenH;

    public override bool IsAvailable
    {
        get
        {
            if (!OperatingSystem.IsLinux() && !OperatingSystem.IsFreeBSD())
                return false;

            return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY"))
                || "wayland".Equals(
                    Environment.GetEnvironmentVariable("XDG_SESSION_TYPE"),
                    StringComparison.OrdinalIgnoreCase);
        }
    }

    public override (int? Width, int? Height) GetScreenSize()
    {
        if (_screenW.HasValue && _screenH.HasValue)
            return (_screenW, _screenH);

        // 策略 1: wlr-randr
        var out1 = TryExec("wlr-randr 2>/dev/null | head -1");
        if (!string.IsNullOrEmpty(out1))
        {
            var match = Regex.Match(out1, @"(\d+)x(\d+)\s+px");
            if (match.Success)
            {
                _screenW = int.Parse(match.Groups[1].Value);
                _screenH = int.Parse(match.Groups[2].Value);
                return (_screenW, _screenH);
            }
        }

        // 策略 2: swaymsg
        var out2 = TryExec("swaymsg -t get_outputs 2>/dev/null");
        if (!string.IsNullOrEmpty(out2))
        {
            try
            {
                using var doc = JsonDocument.Parse(out2);
                var root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.Array)
                {
                    foreach (var output in root.EnumerateArray())
                    {
                        if (output.TryGetProperty("active", out var active) && active.GetBoolean())
                        {
                            if (output.TryGetProperty("current_mode", out var mode))
                            {
                                if (mode.TryGetProperty("width", out var w) &&
                                    mode.TryGetProperty("height", out var h))
                                {
                                    _screenW = w.GetInt32();
                                    _screenH = h.GetInt32();
                                    return (_screenW, _screenH);
                                }
                            }
                        }
                    }
                }
            }
            catch { /* ignore parse errors */ }
        }

        // 策略 3: hyprctl
        var out3 = TryExec("hyprctl monitors -j 2>/dev/null");
        if (!string.IsNullOrEmpty(out3))
        {
            try
            {
                using var doc = JsonDocument.Parse(out3);
                var root = doc.RootElement;
                if (root.ValueKind == JsonValueKind.Array && root.GetArrayLength() > 0)
                {
                    var first = root[0];
                    if (first.TryGetProperty("width", out var w) &&
                        first.TryGetProperty("height", out var h))
                    {
                        _screenW = w.GetInt32();
                        _screenH = h.GetInt32();
                        return (_screenW, _screenH);
                    }
                }
            }
            catch { /* ignore parse errors */ }
        }

        return (_screenW, _screenH);
    }

    public override async Task<MouseEvent> GetPosition()
    {
        var (width, height) = GetScreenSize();
        int x = 0, y = 0;
        bool found = false;

        await Task.Yield();

        // 策略 1: ydotool
        var ydo = TryExec("ydotool mousemove --absolute --get-location 2>/dev/null");
        if (!string.IsNullOrEmpty(ydo))
        {
            var match = Regex.Match(ydo, @"(\d+)\s*,\s*(\d+)");
            if (match.Success)
            {
                x = int.Parse(match.Groups[1].Value);
                y = int.Parse(match.Groups[2].Value);
                found = true;
            }
        }

        // 策略 2: swaymsg
        if (!found)
        {
            var sway = TryExec("swaymsg -t get_tree 2>/dev/null");
            if (!string.IsNullOrEmpty(sway))
            {
                try
                {
                    using var doc = JsonDocument.Parse(sway);
                    var seat = FindSeatRecursive(doc.RootElement, "pointer");
                    if (seat.HasValue)
                    {
                        x = seat.Value.x;
                        y = seat.Value.y;
                        found = true;
                    }
                }
                catch { /* ignore */ }
            }
        }

        // 策略 3: hyprctl
        if (!found)
        {
            var hypr = TryExec("hyprctl cursorpos 2>/dev/null");
            if (!string.IsNullOrEmpty(hypr))
            {
                var match = Regex.Match(hypr, @"(\d+)\s*,\s*(\d+)");
                if (match.Success)
                {
                    x = int.Parse(match.Groups[1].Value);
                    y = int.Parse(match.Groups[2].Value);
                    found = true;
                }
            }
        }

        // 策略 4: libinput
        if (!found)
        {
            var libinput = TryExec(
                "timeout 0.2 libinput debug-events --device /dev/input/event* 2>/dev/null | grep -m1 'POINTER_MOTION_ABSOLUTE'"
            );
            if (!string.IsNullOrEmpty(libinput))
            {
                var match = Regex.Match(libinput, @"([\d.]+)/([\d.]+)");
                if (match.Success && width.HasValue && height.HasValue)
                {
                    x = (int)Math.Round(float.Parse(match.Groups[1].Value) * width.Value);
                    y = (int)Math.Round(float.Parse(match.Groups[2].Value) * height.Value);
                    found = true;
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

        // 按键检测：ydotool
        var ydo = TryExec("ydotool click --get-state 2>/dev/null || echo ''");
        if (!string.IsNullOrEmpty(ydo))
        {
            // ydotool 不直接支持按键状态查询，通过 libinput 回退
        }

        // 按键检测：libinput
        var libinput = TryExec(
            "timeout 0.3 libinput debug-events 2>/dev/null | grep -E 'BTN_LEFT|BTN_RIGHT|BTN_MIDDLE'"
        );
        if (!string.IsNullOrEmpty(libinput))
        {
            if (libinput.Contains("BTN_LEFT") && libinput.Contains("pressed"))
                buttons.Add(new MouseButtonState { Button = 0, Pressed = true });
            if (libinput.Contains("BTN_RIGHT") && libinput.Contains("pressed"))
                buttons.Add(new MouseButtonState { Button = 2, Pressed = true });
            if (libinput.Contains("BTN_MIDDLE") && libinput.Contains("pressed"))
                buttons.Add(new MouseButtonState { Button = 1, Pressed = true });
        }

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

    private (int x, int y)? FindSeatRecursive(JsonElement node, string type)
    {
        if (node.ValueKind != JsonValueKind.Object)
            return null;

        if (node.TryGetProperty("type", out var t) &&
            t.GetString() == type)
        {
            int x = 0, y = 0;
            if (node.TryGetProperty("x", out var xEl)) x = xEl.GetInt32();
            if (node.TryGetProperty("y", out var yEl)) y = yEl.GetInt32();
            return (x, y);
        }

        if (node.TryGetProperty("focus", out var focus) &&
            focus.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in focus.EnumerateArray())
            {
                var result = FindSeatRecursive(child, type);
                if (result.HasValue) return result;
            }
        }

        if (node.TryGetProperty("nodes", out var nodes) &&
            nodes.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in nodes.EnumerateArray())
            {
                var result = FindSeatRecursive(child, type);
                if (result.HasValue) return result;
            }
        }

        return null;
    }

    private string DetectCursorType()
    {
        var tree = GetSwayTree();
        if (tree == null) return CursorTypes.Default;

        try
        {
            using var doc = JsonDocument.Parse(tree);
            var focused = FindFocusedNode(doc.RootElement);
            if (focused == null) return CursorTypes.Default;

            var appId = "";
            var name = "";

            if (focused.Value.TryGetProperty("app_id", out var aid))
                appId = aid.GetString()?.ToLowerInvariant() ?? "";
            if (focused.Value.TryGetProperty("name", out var nm))
                name = nm.GetString()?.ToLowerInvariant() ?? "";

            // 文本编辑器 / 终端
            var textApps = new[] { "terminal", "term", "code", "vim", "nvim", "emacs", "gedit", "kate", "nano" };
            if (textApps.Any(t => appId.Contains(t) || name.Contains(t)))
                return CursorTypes.Text;

            // 浏览器
            var browserApps = new[] { "firefox", "chrome", "chromium", "edge", "opera", "brave", "safari", "browser" };
            if (browserApps.Any(b => appId.Contains(b) || name.Contains(b)))
                return CursorTypes.Pointer;
        }
        catch { /* ignore */ }

        return CursorTypes.Default;
    }

    private string? GetSwayTree()
    {
        return TryExec("swaymsg -t get_tree 2>/dev/null");
    }

    private JsonElement? FindFocusedNode(JsonElement node)
    {
        if (node.ValueKind != JsonValueKind.Object)
            return null;

        if (node.TryGetProperty("focused", out var f) && f.GetBoolean())
            return node;

        if (node.TryGetProperty("nodes", out var nodes) &&
            nodes.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in nodes.EnumerateArray())
            {
                var result = FindFocusedNode(child);
                if (result.HasValue) return result;
            }
        }

        if (node.TryGetProperty("floating_nodes", out var floating) &&
            floating.ValueKind == JsonValueKind.Array)
        {
            foreach (var child in floating.EnumerateArray())
            {
                var result = FindFocusedNode(child);
                if (result.HasValue) return result;
            }
        }

        return null;
    }
}