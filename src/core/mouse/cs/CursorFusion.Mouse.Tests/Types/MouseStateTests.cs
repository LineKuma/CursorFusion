using System.Linq;
using CursorFusion.Mouse.Types;
using Xunit;

namespace CursorFusion.Mouse.Tests.Types;

public class MouseStateTests
{
    [Fact]
    public void Should_Handle_Null_CursorType()
    {
        var state = new MouseState(null, null);
        Assert.Equal(CursorTypes.Unknown, state.CursorType);
    }

    [Fact]
    public void Should_Handle_Null_Buttons()
    {
        var state = new MouseState(CursorTypes.Default, null);
        Assert.Empty(state.Buttons);
        Assert.False(state.IsAnyButtonDown);
    }

    [Fact]
    public void Should_Detect_Left_Down()
    {
        var state = new MouseState(CursorTypes.Default, new[]
        {
            new MouseButtonState { Button = 0, Pressed = true }
        });
        Assert.True(state.IsLeftDown);
        Assert.False(state.IsMiddleDown);
        Assert.False(state.IsRightDown);
    }

    [Fact]
    public void Should_Detect_Right_Down()
    {
        var state = new MouseState(CursorTypes.Default, new[]
        {
            new MouseButtonState { Button = 2, Pressed = true }
        });
        Assert.False(state.IsLeftDown);
        Assert.False(state.IsMiddleDown);
        Assert.True(state.IsRightDown);
    }

    [Fact]
    public void Should_Detect_Middle_Down()
    {
        var state = new MouseState(CursorTypes.Default, new[]
        {
            new MouseButtonState { Button = 1, Pressed = true }
        });
        Assert.True(state.IsMiddleDown);
        Assert.False(state.IsLeftDown);
        Assert.False(state.IsRightDown);
    }

    [Fact]
    public void Should_Detect_Any_Button_Down()
    {
        var state = new MouseState(CursorTypes.Default, new[]
        {
            new MouseButtonState { Button = 0, Pressed = true }
        });
        Assert.True(state.IsAnyButtonDown);
    }

    [Fact]
    public void Should_Detect_No_Button_Down()
    {
        var state = new MouseState(CursorTypes.Default, new[]
        {
            new MouseButtonState { Button = 0, Pressed = false }
        });
        Assert.False(state.IsAnyButtonDown);
    }

    [Fact]
    public void ToString_Should_Include_CursorType()
    {
        var state = new MouseState(CursorTypes.Text, null);
        Assert.Contains(CursorTypes.Text, state.ToString());
    }
}