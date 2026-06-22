using System.Collections.Generic;

namespace CursorFusion.Core.Mouse.Types;

public class MouseButtonState
{
    public int Button { get; init; }
    public bool Pressed { get; init; }
    public string Name => Button switch { 0 => "left", 1 => "middle", 2 => "right", _ => $"button{Button}" };
    public override string ToString() => $"{Name}: {(Pressed ? "down" : "up")}";
    public static readonly Dictionary<int, string> ButtonNames = new() { { 0, "left" }, { 1, "middle" }, { 2, "right" } };
}