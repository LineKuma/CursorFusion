using System;
using System.Diagnostics;
using System.Threading.Tasks;
using CursorFusion.Mouse.Types;

namespace CursorFusion.Mouse.Platforms;

/// <summary>
/// 平台抽象基类，提供通用命令执行和采样逻辑
/// </summary>
public abstract class BasePlatform
{
    public abstract string Name { get; }

    /// <summary>同步执行命令并返回输出</summary>
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

    /// <summary>尝试执行命令，失败时返回 null</summary>
    protected string? TryExec(string cmd)
    {
        try
        {
            return Exec(cmd);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>获取屏幕尺寸 (抽象)</summary>
    public abstract (int? Width, int? Height) GetScreenSize();

    /// <summary>获取鼠标位置 (抽象)</summary>
    public abstract Task<MouseEvent> GetPosition();

    /// <summary>获取鼠标状态 (抽象)</summary>
    public abstract Task<MouseEvent> GetState();

    /// <summary>
    /// 采样：同时获取位置和状态，合并为单个 MouseEvent
    /// </summary>
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

    /// <summary>检查当前系统是否可用此平台</summary>
    public abstract bool IsAvailable { get; }
}