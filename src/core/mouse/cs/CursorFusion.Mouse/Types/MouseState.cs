using System.Collections.Generic;
using System.Linq;

namespace CursorFusion.Mouse.Types;

/// <summary>
/// 鼠标当前状态 (按键 + 光标类型)
/// </summary>
public class MouseState
{
    /// <summary>光标类型</summary>
    public string CursorType { get; init; }

    /// <summary>按下的按键列表</summary>
    public IReadOnlyList<MouseButtonState> Buttons { get; init; }

    public MouseState(string? cursorType, IEnumerable<MouseButtonState>? buttons)
    {
        CursorType = cursorType ?? CursorTypes.Unknown;
        Buttons = (buttons ?? Enumerable.Empty<MouseButtonState>()).ToList().AsReadOnly();
    }

    /// <summary>是否有任意按键按下</summary>
    public bool IsAnyButtonDown => Buttons.Any(b => b.Pressed);

    /// <summary>左键是否按下</summary>
    public bool IsLeftDown => Buttons.Any(b => b.Button == 0 && b.Pressed);

    /// <summary>中键是否按下</summary>
    public bool IsRightDown => Buttons.Any(b => b.Button == 2 && b.Pressed);

    /// <summary>右键是否按下</summary>
    public bool IsMiddleDown => Buttons.Any(b => b.Button == 1 && b.Pressed);

    public override string ToString() =>
        $"Cursor: {CursorType}, Buttons: [{string.Join(", ", Buttons)}]";
}