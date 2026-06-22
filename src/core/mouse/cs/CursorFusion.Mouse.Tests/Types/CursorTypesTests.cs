using CursorFusion.Mouse.Types;
using Xunit;

namespace CursorFusion.Mouse.Tests.Types;

public class CursorTypesTests
{
    [Fact]
    public void Should_Have_All_Expected_Constants()
    {
        Assert.Equal("default", CursorTypes.Default);
        Assert.Equal("none", CursorTypes.None);
        Assert.Equal("pointer", CursorTypes.Pointer);
        Assert.Equal("text", CursorTypes.Text);
        Assert.Equal("wait", CursorTypes.Wait);
        Assert.Equal("help", CursorTypes.Help);
        Assert.Equal("crosshair", CursorTypes.Crosshair);
        Assert.Equal("move", CursorTypes.Move);
        Assert.Equal("not-allowed", CursorTypes.NotAllowed);
        Assert.Equal("grab", CursorTypes.Grab);
        Assert.Equal("grabbing", CursorTypes.Grabbing);
        Assert.Equal("n-resize", CursorTypes.ResizeN);
        Assert.Equal("s-resize", CursorTypes.ResizeS);
        Assert.Equal("e-resize", CursorTypes.ResizeE);
        Assert.Equal("w-resize", CursorTypes.ResizeW);
        Assert.Equal("ne-resize", CursorTypes.ResizeNe);
        Assert.Equal("nw-resize", CursorTypes.ResizeNw);
        Assert.Equal("se-resize", CursorTypes.ResizeSe);
        Assert.Equal("sw-resize", CursorTypes.ResizeSw);
        Assert.Equal("col-resize", CursorTypes.ResizeCol);
        Assert.Equal("row-resize", CursorTypes.ResizeRow);
        Assert.Equal("zoom-in", CursorTypes.ZoomIn);
        Assert.Equal("zoom-out", CursorTypes.ZoomOut);
        Assert.Equal("unknown", CursorTypes.Unknown);
    }
}