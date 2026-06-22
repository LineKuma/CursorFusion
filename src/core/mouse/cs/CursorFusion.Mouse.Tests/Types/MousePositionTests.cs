using CursorFusion.Mouse.Types;
using Xunit;

namespace CursorFusion.Mouse.Tests.Types;

public class MousePositionTests
{
    [Fact]
    public void Should_Create_Default_Position()
    {
        var pos = new MousePosition();
        Assert.Equal(0, pos.X);
        Assert.Equal(0, pos.Y);
        Assert.Null(pos.ScreenWidth);
        Assert.Null(pos.ScreenHeight);
    }

    [Fact]
    public void Should_Set_All_Properties()
    {
        var pos = new MousePosition
        {
            X = 100,
            Y = 200,
            ScreenWidth = 1920,
            ScreenHeight = 1080
        };
        Assert.Equal(100, pos.X);
        Assert.Equal(200, pos.Y);
        Assert.Equal(1920, pos.ScreenWidth);
        Assert.Equal(1080, pos.ScreenHeight);
    }

    [Fact]
    public void ToString_Should_Return_Formatted_String()
    {
        var pos = new MousePosition { X = 100, Y = 200, ScreenWidth = 1920, ScreenHeight = 1080 };
        Assert.Contains("100, 200", pos.ToString());
        Assert.Contains("1920x1080", pos.ToString());
    }
}