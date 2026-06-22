using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using CursorFusion.Core.Mouse.Types;

namespace CursorFusion.Core.Mouse.Platforms;

public partial class WaylandPlatform : BasePlatform
{
    public override string Name => "wayland";
    private int? _screenW, _screenH;

    public override bool IsAvailable
    {
        get
        {
            if (!OperatingSystem.IsLinux() && !OperatingSystem.IsFreeBSD()) return false;
            return !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("WAYLAND_DISPLAY"))
                || "wayland".Equals(Environment.GetEnvironmentVariable("XDG_SESSION_TYPE"), StringComparison.OrdinalIgnoreCase);
        }
    }

    public override (int? Width, int? Height) GetScreenSize()
    {
        if (_screenW.HasValue && _screenH.HasValue) return (_screenW, _screenH);

        var out1 = TryExec("wlr-randr 2>/dev/null | head -1");
        if (!string.IsNullOrEmpty(out1))
        {
            var m = Regex.Match(out1, @"(\d+)x(\d+)\s+px");
            if (m.Success) { _screenW = int.Parse(m.Groups[1].Value); _screenH = int.Parse(m.Groups[2].Value); return (_screenW, _screenH); }
        }

        var out2 = TryExec("swaymsg -t get_outputs 2>/dev/null");
        if (!string.IsNullOrEmpty(out2))
        {
            try
            {
                using var doc = JsonDocument.Parse(out2);
                foreach (var o in doc.RootElement.EnumerateArray())
                {
                    if (o.TryGetProperty("active", out var a) && a.GetBoolean() &&
                        o.TryGetProperty("current_mode", out var m) &&
                        m.TryGetProperty("width", out var w) && m.TryGetProperty("height", out var h))
                    {
                        _screenW = w.GetInt32(); _screenH = h.GetInt32(); return (_screenW, _screenH);
                    }
                }
            }
            catch { }
        }

        var out3 = TryExec("hyprctl monitors -j 2>/dev/null");
        if (!string.IsNullOrEmpty(out3))
        {
            try
            {
                using var doc = JsonDocument.Parse(out3);
                if (doc.RootElement.ValueKind == JsonValueKind.Array && doc.RootElement.GetArrayLength() > 0)
                {
                    var first = doc.RootElement[0];
                    if (first.TryGetProperty("width", out var w) && first.TryGetProperty("height", out var h))
                    { _screenW = w.GetInt32(); _screenH = h.GetInt32(); return (_screenW, _screenH); }
                }
            }
            catch { }
        }

        return (_screenW, _screenH);
    }

    public override async Task<MouseEvent> GetPosition()
    {
        var (w, h) = GetScreenSize();
        int x = 0, y = 0;
        bool found = false;
        await Task.Yield();

        var ydo = TryExec("ydotool mousemove --absolute --get-location 2>/dev/null");
        if (!string.IsNullOrEmpty(ydo))
        {
            var m = Regex.Match(ydo, @"(\d+)\s*,\s*(\d+)");
            if (m.Success) { x = int.Parse(m.Groups[1].Value); y = int.Parse(m.Groups[2].Value); found = true; }
        }

        if (!found)
        {
            var sway = TryExec("swaymsg -t get_tree 2>/dev/null");
            if (!string.IsNullOrEmpty(sway))
            {
                try
                {
                    using var doc = JsonDocument.Parse(sway);
                    var seat = FindSeatRecursive(doc.RootElement, "pointer");
                    if (seat.HasValue) { x = seat.Value.x; y = seat.Value.y; found = true; }
                }
                catch { }
            }
        }

        if (!found)
        {
            var hypr = TryExec("hyprctl cursorpos 2>/dev/null");
            if (!string.IsNullOrEmpty(hypr))
            {
                var m = Regex.Match(hypr, @"(\d+)\s*,\s*(\d+)");
                if (m.Success) { x = int.Parse(m.Groups[1].Value); y = int.Parse(m.Groups[2].Value); found = true; }
            }
        }

        if (!found)
        {
            var lib = TryExec("timeout 0.2 libinput debug-events --device /dev/input/event* 2>/dev/null | grep -m1 'POINTER_MOTION_ABSOLUTE'");
            if (!string.IsNullOrEmpty(lib))
            {
                var m = Regex.Match(lib, @"([\d.]+)/([\d.]+)");
                if (m.Success && w.HasValue && h.HasValue)
                { x = (int)Math.Round(float.Parse(m.Groups[1].Value) * w.Value); y = (int)Math.Round(float.Parse(m.Groups[2].Value) * h.Value); found = true; }
            }
        }

        return MouseEvent.Create(x, y, null, CursorTypes.Default, Name, w, h);
    }

    public override async Task<MouseEvent> GetState()
    {
        var buttons = new List<MouseButtonState>();
        await Task.Yield();

        var ydo = TryExec("ydotool click --get-state 2>/dev/null || echo ''");
        // ydotool 不直接支持按键状态查询

        var lib = TryExec("timeout 0.3 libinput debug-events 2>/dev/null | grep -E 'BTN_LEFT|BTN_RIGHT|BTN_MIDDLE'");
        if (!string.IsNullOrEmpty(lib))
        {
            if (lib.Contains("BTN_LEFT") && lib.Contains("pressed")) buttons.Add(new MouseButtonState { Button = 0, Pressed = true });
            if (lib.Contains("BTN_RIGHT") && lib.Contains("pressed")) buttons.Add(new MouseButtonState { Button = 2, Pressed = true });
            if (lib.Contains("BTN_MIDDLE") && lib.Contains("pressed")) buttons.Add(new MouseButtonState { Button = 1, Pressed = true });
        }

        var cursorType = DetectCursorType();
        var (w, h) = GetScreenSize();
        return MouseEvent.Create(0, 0, buttons.Select(b => (b.Button, b.Pressed)), cursorType, Name, w, h);
    }

    private (int x, int y)? FindSeatRecursive(JsonElement node, string type)
    {
        if (node.ValueKind != JsonValueKind.Object) return null;
        if (node.TryGetProperty("type", out var t) && t.GetString() == type)
        {
            int x = 0, y = 0;
            if (node.TryGetProperty("x", out var xe)) x = xe.GetInt32();
            if (node.TryGetProperty("y", out var ye)) y = ye.GetInt32();
            return (x, y);
        }
        if (node.TryGetProperty("focus", out var f) && f.ValueKind == JsonValueKind.Array)
            foreach (var c in f.EnumerateArray()) { var r = FindSeatRecursive(c, type); if (r.HasValue) return r; }
        if (node.TryGetProperty("nodes", out var ns) && ns.ValueKind == JsonValueKind.Array)
            foreach (var c in ns.EnumerateArray()) { var r = FindSeatRecursive(c, type); if (r.HasValue) return r; }
        return null;
    }

    private string DetectCursorType()
    {
        var tree = TryExec("swaymsg -t get_tree 2>/dev/null");
        if (string.IsNullOrEmpty(tree)) return CursorTypes.Default;
        try
        {
            using var doc = JsonDocument.Parse(tree);
            var focused = FindFocusedNode(doc.RootElement);
            if (focused == null) return CursorTypes.Default;

            var appId = ""; var name = "";
            if (focused.Value.TryGetProperty("app_id", out var a)) appId = a.GetString()?.ToLowerInvariant() ?? "";
            if (focused.Value.TryGetProperty("name", out var n)) name = n.GetString()?.ToLowerInvariant() ?? "";

            if (new[] { "terminal", "term", "code", "vim", "nvim", "emacs", "gedit", "kate", "nano" }.Any(t => appId.Contains(t) || name.Contains(t)))
                return CursorTypes.Text;
            if (new[] { "firefox", "chrome", "chromium", "edge", "opera", "brave", "safari", "browser" }.Any(b => appId.Contains(b) || name.Contains(b)))
                return CursorTypes.Pointer;
        }
        catch { }
        return CursorTypes.Default;
    }

    private JsonElement? FindFocusedNode(JsonElement node)
    {
        if (node.ValueKind != JsonValueKind.Object) return null;
        if (node.TryGetProperty("focused", out var f) && f.GetBoolean()) return node;
        if (node.TryGetProperty("nodes", out var ns) && ns.ValueKind == JsonValueKind.Array)
            foreach (var c in ns.EnumerateArray()) { var r = FindFocusedNode(c); if (r.HasValue) return r; }
        if (node.TryGetProperty("floating_nodes", out var fn) && fn.ValueKind == JsonValueKind.Array)
            foreach (var c in fn.EnumerateArray()) { var r = FindFocusedNode(c); if (r.HasValue) return r; }
        return null;
    }
}