using System;
using System.Collections.Generic;

namespace CursorFusion.Mouse.Types;

/// <summary>
/// 统一的鼠标事件，包含位置和状态
/// </summary>
public class MouseEvent
{
    /// <summary>时间戳</summary>
    public DateTime Timestamp { get; init; } = DateTime.UtcNow;

    /// <summary>鼠标位置</summary>
    public MousePosition Position { get; init; } = new();

    /// <summary>鼠标状态</summary>
    public MouseState State { get; init; } = new(null, null);

    /// <summary>平台名称 (x11 / wayland / macos / unknown)</summary>
    public string Platform { get; init; } = "unknown";

    public override string ToString() =>
        $"[{Timestamp:HH:mm:ss.fff}] [{Platform}] {Position} | {State}";

    /// <summary>
    /// 工厂方法：创建 MouseEvent
    /// </summary>
    public static MouseEvent Create(
        int x, int y,
        IEnumerable<(int button, bool pressed)>? buttons,
        string cursorType,
        string platform,
        int? screenWidth = null,
        int? screenHeight = null)
    {
        var btnStates = new List<MouseButtonState>();
        if (buttons != null)
        {
            foreach (var (button, pressed) in buttons)
            {
                btnStates.Add(new MouseButtonState { Button = button, Pressed = pressed });
            }
        }

        return new MouseEvent
        {
            Position = new MousePosition
            {
                X = x,
                Y = y,
                ScreenWidth = screenWidth,
                ScreenHeight = screenHeight
            },
            State = new MouseState(cursorType, btnStates),
            Platform = platform
        };
    }
}