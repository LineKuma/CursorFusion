using CursorFusion.Core.Mouse;
using CursorFusion.Core.Mouse.Types;

namespace CursorFusion.Core.Tests.Mouse;

public class MouseTrackerTests
{
    [Fact]
    public void Constructor_ShouldInitialize()
    {
        var tracker = new MouseTracker();
        Assert.NotNull(tracker);
    }

    [Fact]
    public void PlatformName_ShouldReturnValue()
    {
        var tracker = new MouseTracker();
        var name = tracker.PlatformName;
        Assert.NotNull(name);
        Assert.NotEmpty(name);
    }

    [Fact]
    public void Init_ShouldNotThrow()
    {
        var tracker = new MouseTracker();
        tracker.Init();
    }

    [Fact]
    public void Init_ShouldBeIdempotent()
    {
        var tracker = new MouseTracker();
        tracker.Init();
        tracker.Init();
    }

    [Fact]
    public async Task GetPosition_ShouldReturnEvent()
    {
        var tracker = new MouseTracker();
        var evt = await tracker.GetPosition();
        Assert.NotNull(evt);
        Assert.NotNull(evt.Position);
        Assert.NotNull(evt.Platform);
    }

    [Fact]
    public async Task GetState_ShouldReturnEvent()
    {
        var tracker = new MouseTracker();
        var evt = await tracker.GetState();
        Assert.NotNull(evt);
        Assert.NotNull(evt.State);
        Assert.NotNull(evt.State.CursorType);
    }

    [Fact]
    public async Task Sample_ShouldReturnEvent()
    {
        var tracker = new MouseTracker();
        var evt = await tracker.Sample();
        Assert.NotNull(evt);
        Assert.NotNull(evt.Position);
        Assert.NotNull(evt.State);
        Assert.NotEqual(default(DateTime), evt.Timestamp);
    }

    [Fact]
    public void Track_ShouldReturnStopAction()
    {
        var tracker = new MouseTracker();
        var callbackCount = 0;
        Action<MouseEvent?, Exception?> callback = (evt, err) =>
        {
            if (evt != null) callbackCount++;
        };

        var stop = tracker.Track(100, callback);
        Assert.NotNull(stop);

        // 等待一点时间让回调被调用
        Thread.Sleep(250);
        stop();

        Assert.True(callbackCount > 0, $"Expected at least one callback, got {callbackCount}");
    }

    [Fact]
    public void Track_Stop_ShouldStopCallbacks()
    {
        var tracker = new MouseTracker();
        var callbackCount = 0;
        Action<MouseEvent?, Exception?> callback = (evt, err) =>
        {
            if (evt != null) callbackCount++;
        };

        var stop = tracker.Track(50, callback);
        Thread.Sleep(120);
        stop();

        var countAfterStop = callbackCount;
        Thread.Sleep(150);

        Assert.Equal(countAfterStop, callbackCount);
    }
}