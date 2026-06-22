using System;
using System.Collections.Generic;

namespace CursorFusion.Core.Mouse.Types;

public class MouseEvent
{
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;
    public MousePosition Position { get; init; } = new();
    public MouseState State { get; init; } = new(null, null);
    public string Platform { get; init; } = "unknown";
    public override string ToString() => $"[{Timestamp:HH:mm:ss.fff}] [{Platform}] {Position} | {State}";

    public static MouseEvent Create(int x, int y, IEnumerable<(int button, bool pressed)>? buttons,
        string cursorType, string platform, int? screenWidth = null, int? screenHeight = null)
    {
        var btnStates = new List<MouseButtonState>();
        if (buttons != null)
            foreach (var (button, pressed) in buttons)
                btnStates.Add(new MouseButtonState { Button = button, Pressed = pressed });

        return new MouseEvent
        {
            Position = new MousePosition { X = x, Y = y, ScreenWidth = screenWidth, ScreenHeight = screenHeight },
            State = new MouseState(cursorType, btnStates),
            Platform = platform
        };
    }
}