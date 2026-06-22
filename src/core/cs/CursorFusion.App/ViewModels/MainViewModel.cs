using CommunityToolkit.Mvvm.ComponentModel;
using CursorFusion.Core.Mouse;
using CursorFusion.Core.Mouse.Types;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace CursorFusion.App.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly MouseTracker _tracker = new();
    private CancellationTokenSource? _cts;
    private int _trackingIntervalMs = 100;

    [ObservableProperty]
    private string _platform = "Detecting...";

    [ObservableProperty]
    private int _mouseX;

    [ObservableProperty]
    private int _mouseY;

    [ObservableProperty]
    private int? _screenWidth;

    [ObservableProperty]
    private int? _screenHeight;

    [ObservableProperty]
    private string _cursorType = "unknown";

    [ObservableProperty]
    private bool _isLeftDown;

    [ObservableProperty]
    private bool _isMiddleDown;

    [ObservableProperty]
    private bool _isRightDown;

    [ObservableProperty]
    private bool _isAnyButtonDown;

    [ObservableProperty]
    private string _statusText = "Initializing...";

    [ObservableProperty]
    private string _version = "0.1.0";

    [ObservableProperty]
    private bool _isTracking;

    public ObservableCollection<string> ActiveButtons { get; } = new();

    public MainViewModel()
    {
        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            Platform = _tracker.PlatformName;
            StatusText = $"Platform: {Platform}";

            var evt = await _tracker.Sample();
            UpdateFromEvent(evt);

            StartTracking();
        }
        catch (Exception ex)
        {
            StatusText = $"Error: {ex.Message}";
        }
    }

    public void StartTracking()
    {
        if (IsTracking) return;

        _cts = new CancellationTokenSource();
        IsTracking = true;
        StatusText = $"Tracking ({_trackingIntervalMs}ms)";

        _ = Task.Run(async () =>
        {
            while (!_cts.Token.IsCancellationRequested)
            {
                try
                {
                    var evt = await _tracker.Sample();
                    UpdateFromEvent(evt);
                }
                catch (Exception ex)
                {
                    StatusText = $"Tracking error: {ex.Message}";
                }

                try
                {
                    await Task.Delay(_trackingIntervalMs, _cts.Token);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }, _cts.Token);
    }

    public void StopTracking()
    {
        _cts?.Cancel();
        _cts?.Dispose();
        _cts = null;
        IsTracking = false;
        StatusText = "Tracking stopped";
    }

    private void UpdateFromEvent(MouseEvent evt)
    {
        MouseX = evt.Position.X;
        MouseY = evt.Position.Y;
        ScreenWidth = evt.Position.ScreenWidth;
        ScreenHeight = evt.Position.ScreenHeight;
        CursorType = evt.State.CursorType;
        IsLeftDown = evt.State.IsLeftDown;
        IsMiddleDown = evt.State.IsMiddleDown;
        IsRightDown = evt.State.IsRightDown;
        IsAnyButtonDown = evt.State.IsAnyButtonDown;

        ActiveButtons.Clear();
        foreach (var btn in evt.State.Buttons.Where(b => b.Pressed))
        {
            ActiveButtons.Add(btn.Name);
        }
    }
}