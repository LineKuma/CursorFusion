using System;
using System.Threading.Tasks;
using CursorFusion.Mouse.Platforms;
using CursorFusion.Mouse.Types;
using Xunit;

namespace CursorFusion.Mouse.Tests;

public class MouseTrackerTests
{
    [Fact]
    public void Should_Initialize_On_Construction()
    {
        var tracker = new MouseTracker();
        Assert.NotNull(tracker.PlatformName);
    }

    [Fact]
    public void Should_Detect_Platform()
    {
        var tracker = new MouseTracker();
        var name = tracker.PlatformName;

        // On this Linux test environment, should detect x11 or wayland or unknown
        Assert.True(name == "x11" || name == "wayland" || name == "unknown" || name == "macos");
    }

    [Fact]
    public void Init_Should_Return_Self()
    {
        var tracker = new MouseTracker();
        var result = tracker.Init();
        Assert.Same(tracker, result);
    }

    [Fact]
    public void Double_Init_Should_Not_Change_Platform()
    {
        var tracker = new MouseTracker();
        var name1 = tracker.PlatformName;
        tracker.Init();
        var name2 = tracker.PlatformName;
        Assert.Equal(name1, name2);
    }

    [Fact]
    public async Task Sample_Should_Combine_Position_And_State()
    {
        var tracker = new TestableMouseTracker(new MockPlatform());
        var evt = await tracker.Sample();

        Assert.Equal(42, evt.Position.X);
        Assert.Equal(84, evt.Position.Y);
        Assert.Equal(CursorTypes.Pointer, evt.State.CursorType);
        Assert.Equal("mock", evt.Platform);
    }

    [Fact]
    public async Task GetPosition_Should_Delegate()
    {
        var tracker = new TestableMouseTracker(new MockPlatform());
        var evt = await tracker.GetPosition();

        Assert.Equal(42, evt.Position.X);
        Assert.Equal(84, evt.Position.Y);
    }

    [Fact]
    public async Task GetState_Should_Delegate()
    {
        var tracker = new TestableMouseTracker(new MockPlatform());
        var evt = await tracker.GetState();

        Assert.Equal(CursorTypes.Pointer, evt.State.CursorType);
        Assert.True(evt.State.IsLeftDown);
    }

    [Fact]
    public void Track_Should_Return_Stop_Action()
    {
        var tracker = new TestableMouseTracker(new MockPlatform());
        var stop = tracker.Track(1000, (evt, err) => { });
        Assert.NotNull(stop);
        stop();
    }

    [Fact]
    public void Track_Should_Call_Callback()
    {
        var tracker = new TestableMouseTracker(new MockPlatform());
        var called = false;
        MouseEvent? received = null;
        Action? stopAction = null;

        stopAction = tracker.Track(50, (evt, err) =>
        {
            if (!called)
            {
                called = true;
                received = evt;
                stopAction?.Invoke();
            }
        });

        // Wait for callback
        var start = DateTime.UtcNow;
        while (!called && (DateTime.UtcNow - start).TotalSeconds < 5)
        {
            System.Threading.Thread.Sleep(50);
        }

        Assert.True(called);
        Assert.NotNull(received);
        Assert.Equal(42, received!.Position.X);
    }

    [Fact]
    public void Track_Should_Report_Errors()
    {
        var tracker = new TestableMouseTracker(new ErrorPlatform());
        var errorReceived = false;
        Exception? received = null;
        Action? stopAction = null;

        stopAction = tracker.Track(50, (evt, err) =>
        {
            if (!errorReceived)
            {
                errorReceived = true;
                received = err;
                stopAction?.Invoke();
            }
        });

        var start = DateTime.UtcNow;
        while (!errorReceived && (DateTime.UtcNow - start).TotalSeconds < 5)
        {
            System.Threading.Thread.Sleep(50);
        }

        Assert.True(errorReceived);
        Assert.NotNull(received);
        Assert.Equal("mock error", received!.Message);
    }
}

/// <summary>
/// 可注入平台的 MouseTracker 用于测试
/// </summary>
internal class TestableMouseTracker : MouseTracker
{
    public TestableMouseTracker(BasePlatform platform)
    {
        // 通过反射或直接设置内部字段
        var field = typeof(MouseTracker).GetField("_platform",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        field.SetValue(this, platform);

        var initField = typeof(MouseTracker).GetField("_initialized",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        initField.SetValue(this, true);
    }
}

/// <summary>
/// Mock 平台实现，返回固定值
/// </summary>
internal class MockPlatform : BasePlatform
{
    public override string Name => "mock";
    public override bool IsAvailable => true;

    public override (int? Width, int? Height) GetScreenSize() => (1920, 1080);

    public override Task<MouseEvent> GetPosition()
    {
        return Task.FromResult(MouseEvent.Create(42, 84, null, CursorTypes.Default, Name, 1920, 1080));
    }

    public override Task<MouseEvent> GetState()
    {
        return Task.FromResult(MouseEvent.Create(
            0, 0,
            new[] { (0, true) },
            CursorTypes.Pointer,
            Name,
            1920, 1080
        ));
    }
}

/// <summary>
/// 错误平台实现，用于测试错误处理
/// </summary>
internal class ErrorPlatform : BasePlatform
{
    public override string Name => "error";
    public override bool IsAvailable => false;

    public override (int? Width, int? Height) GetScreenSize() => (null, null);

    public override Task<MouseEvent> GetPosition()
    {
        throw new InvalidOperationException("mock error");
    }

    public override Task<MouseEvent> GetState()
    {
        throw new InvalidOperationException("mock error");
    }
}