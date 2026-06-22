using System;
using System.Linq;
using CursorFusion.Mouse.Types;
using Xunit;

namespace CursorFusion.Mouse.Tests.Types;

public class MouseEventTests
{
    [Fact]
    public void Should_Create_Default_Event()
    {
        var evt = new MouseEvent();
        Assert.NotNull(evt.Position);
        Assert.NotNull(evt.State);
        Assert.Equal("unknown", evt.Platform);
        Assert.True(evt.Timestamp <= DateTime.UtcNow);
    }

    [Fact]
    public void Create_Should_Return_Event_With_All_Fields()
    {
        var buttons = new[] { (0, true), (1, false) };
        var evt = MouseEvent.Create(
            100, 200,
            buttons,
            CursorTypes.Pointer,
            "x11",
            1920, 1080
        );

        Assert.Equal(100, evt.Position.X);
        Assert.Equal(200, evt.Position.Y);
        Assert.Equal(1920, evt.Position.ScreenWidth);
        Assert.Equal(1080, evt.Position.ScreenHeight);
        Assert.Equal(CursorTypes.Pointer, evt.State.CursorType);
        Assert.Equal("x11", evt.Platform);
        Assert.Equal(2, evt.State.Buttons.Count);
        Assert.True(evt.State.IsLeftDown);
    }

    [Fact]
    public void Create_Should_Handle_Null_Buttons()
    {
        var evt = MouseEvent.Create(0, 0, null, CursorTypes.Default, "test");
        Assert.Empty(evt.State.Buttons);
    }

    [Fact]
    public void Create_Should_Handle_Null_ScreenSize()
    {
        var evt = MouseEvent.Create(0, 0, null, CursorTypes.Default, "test");
        Assert.Null(evt.Position.ScreenWidth);
        Assert.Null(evt.Position.ScreenHeight);
    }

    [Fact]
    public void ToString_Should_Include_Platform()
    {
        var evt = MouseEvent.Create(0, 0, null, CursorTypes.Default, "wayland");
        Assert.Contains("wayland", evt.ToString());
    }
}