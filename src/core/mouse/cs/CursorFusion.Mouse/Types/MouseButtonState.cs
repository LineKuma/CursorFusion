using System.Collections.Generic;

namespace CursorFusion.Mouse.Types;

/// <summary>
/// 鼠标按键状态
/// </summary>
public class MouseButtonState
{
    /// <summary>按键码 (0=左键, 1=中键, 2=右键)</summary>
    public int Button { get; init; }

    /// <summary>是否按下</summary>
    public bool Pressed { get; init; }

    /// <summary>按键名称</summary>
    public string Name => Button switch
    {
        0 => "left",
        1 => "middle",
        2 => "right",
        _ => $"button{Button}"
    };

    public override string ToString() =>
        $"{Name}: {(Pressed ? "down" : "up")}";

    /// <summary>所有按键名称映射</summary>
    public static readonly Dictionary<int, string> ButtonNames = new()
    {
        { 0, "left" },
        { 1, "middle" },
        { 2, "right" }
    };
}