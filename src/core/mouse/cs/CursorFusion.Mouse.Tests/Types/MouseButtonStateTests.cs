using CursorFusion.Mouse.Types;
using Xunit;

namespace CursorFusion.Mouse.Tests.Types;

public class MouseButtonStateTests
{
    [Fact]
    public void Should_Create_Button_State()
    {
        var btn = new MouseButtonState { Button = 0, Pressed = true };
        Assert.Equal(0, btn.Button);
        Assert.True(btn.Pressed);
        Assert.Equal("left", btn.Name);
    }

    [Fact]
    public void Name_Should_Map_Correctly()
    {
        Assert.Equal("left", new MouseButtonState { Button = 0 }.Name);
        Assert.Equal("middle", new MouseButtonState { Button = 1 }.Name);
        Assert.Equal("right", new MouseButtonState { Button = 2 }.Name);
        Assert.Equal("button5", new MouseButtonState { Button = 5 }.Name);
    }

    [Fact]
    public void ToString_Should_Show_Up_Down()
    {
        Assert.Contains("down", new MouseButtonState { Button = 0, Pressed = true }.ToString());
        Assert.Contains("up", new MouseButtonState { Button = 0, Pressed = false }.ToString());
    }

    [Fact]
    public void ButtonNames_Should_Have_Three_Entries()
    {
        Assert.Equal(3, MouseButtonState.ButtonNames.Count);
        Assert.Equal("left", MouseButtonState.ButtonNames[0]);
        Assert.Equal("middle", MouseButtonState.ButtonNames[1]);
        Assert.Equal("right", MouseButtonState.ButtonNames[2]);
    }
}