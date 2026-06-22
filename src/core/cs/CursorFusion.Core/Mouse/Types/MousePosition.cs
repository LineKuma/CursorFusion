namespace CursorFusion.Core.Mouse.Types;

public class MousePosition
{
    public int X { get; init; }
    public int Y { get; init; }
    public int? ScreenWidth { get; init; }
    public int? ScreenHeight { get; init; }
    public override string ToString() => $"({X}, {Y}) @ {ScreenWidth}x{ScreenHeight}";
}