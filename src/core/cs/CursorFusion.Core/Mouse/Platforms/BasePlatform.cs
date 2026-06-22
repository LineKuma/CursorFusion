using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Threading.Tasks;
using CursorFusion.Core.Mouse.Types;

namespace CursorFusion.Core.Mouse.Platforms;

/// <summary>
/// 平台抽象基类，提供通用命令执行和采样逻辑
/// </summary>
public abstract class BasePlatform
{
    public abstract string Name { get; }

    protected string Exec(string cmd)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "/bin/bash",
            ArgumentList = { "-c", cmd },
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var proc = Process.Start(psi)
            ?? throw new InvalidOperationException($"Failed to start: {cmd}");

        proc.WaitForExit(5000);
        return proc.StandardOutput.ReadToEnd().Trim();
    }

    protected string? TryExec(string cmd)
    {
        try { return Exec(cmd); }
        catch { return null; }
    }

    public abstract (int? Width, int? Height) GetScreenSize();
    public abstract Task<MouseEvent> GetPosition();
    public abstract Task<MouseEvent> GetState();

    public virtual async Task<MouseEvent> Sample()
    {
        var posTask = GetPosition();
        var stateTask = GetState();
        await Task.WhenAll(posTask, stateTask);

        var pos = posTask.Result.Position;
        var state = stateTask.Result.State;

        return MouseEvent.Create(
            pos.X, pos.Y,
            state.Buttons.Select(b => (b.Button, b.Pressed)),
            state.CursorType,
            Name,
            pos.ScreenWidth,
            pos.ScreenHeight
        );
    }

    public abstract bool IsAvailable { get; }
}