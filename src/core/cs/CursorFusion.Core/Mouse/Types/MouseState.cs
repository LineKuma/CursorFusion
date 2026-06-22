using System.Collections.Generic;
using System.Linq;

namespace CursorFusion.Core.Mouse.Types;

public class MouseState
{
    public string CursorType { get; init; }
    public IReadOnlyList<MouseButtonState> Buttons { get; init; }

    public MouseState(string? cursorType, IEnumerable<MouseButtonState>? buttons)
    {
        CursorType = cursorType ?? CursorTypes.Unknown;
        Buttons = (buttons ?? Enumerable.Empty<MouseButtonState>()).ToList().AsReadOnly();
    }

    public bool IsAnyButtonDown => Buttons.Any(b => b.Pressed);
    public bool IsLeftDown => Buttons.Any(b => b.Button == 0 && b.Pressed);
    public bool IsRightDown => Buttons.Any(b => b.Button == 2 && b.Pressed);
    public bool IsMiddleDown => Buttons.Any(b => b.Button == 1 && b.Pressed);
    public override string ToString() => $"Cursor: {CursorType}, Buttons: [{string.Join(", ", Buttons)}]";
}