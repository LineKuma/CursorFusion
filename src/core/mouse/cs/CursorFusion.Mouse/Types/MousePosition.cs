namespace CursorFusion.Mouse.Types;

/// <summary>
/// 鼠标指针位置信息
/// </summary>
public class MousePosition
{
    /// <summary>X 坐标 (像素)</summary>
    public int X { get; init; }

    /// <summary>Y 坐标 (像素)</summary>
    public int Y { get; init; }

    /// <summary>屏幕宽度 (像素), 可能为 null</summary>
    public int? ScreenWidth { get; init; }

    /// <summary>屏幕高度 (像素), 可能为 null</summary>
    public int? ScreenHeight { get; init; }

    public override string ToString() =>
        $"({X}, {Y}) @ {ScreenWidth}x{ScreenHeight}";
}