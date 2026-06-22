using System;
using System.IO;

namespace CursorFusion.Core.Logger;

/// <summary>
/// 日志级别
/// </summary>
public enum LogLevel
{
    Debug,
    Info,
    Warn,
    Error,
    Fatal
}

/// <summary>
/// 日志管理器：支持多级别、格式化输出、文件/控制台双输出
/// </summary>
public class Logger
{
    private readonly LogLevel _minLevel;
    private readonly bool _silent;
    private readonly string? _logFile;
    private readonly object _lock = new();

    public Logger(LogLevel minLevel = LogLevel.Info, bool silent = false, string? logFile = null)
    {
        _minLevel = minLevel;
        _silent = silent;
        _logFile = logFile;
    }

    public void Debug(string message) => Log(LogLevel.Debug, message);
    public void Info(string message) => Log(LogLevel.Info, message);
    public void Warn(string message) => Log(LogLevel.Warn, message);
    public void Error(string message) => Log(LogLevel.Error, message);
    public void Error(string message, Exception ex) => Log(LogLevel.Error, $"{message}: {ex.Message}");
    public void Fatal(string message) => Log(LogLevel.Fatal, message);

    private void Log(LogLevel level, string message)
    {
        if (level < _minLevel) return;

        var timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
        var levelStr = level.ToString().ToUpperInvariant().PadRight(5);
        var formatted = $"[{timestamp}] [{levelStr}] {message}";

        lock (_lock)
        {
            if (!_silent)
            {
                var originalColor = Console.ForegroundColor;
                Console.ForegroundColor = level switch
                {
                    LogLevel.Debug => ConsoleColor.Gray,
                    LogLevel.Warn => ConsoleColor.Yellow,
                    LogLevel.Error => ConsoleColor.Red,
                    LogLevel.Fatal => ConsoleColor.DarkRed,
                    _ => ConsoleColor.White
                };
                Console.WriteLine(formatted);
                Console.ForegroundColor = originalColor;
            }

            if (_logFile != null)
            {
                var dir = Path.GetDirectoryName(_logFile);
                if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                    Directory.CreateDirectory(dir);
                File.AppendAllText(_logFile, formatted + Environment.NewLine);
            }
        }
    }

    /// <summary>获取当前日志级别</summary>
    public LogLevel MinLevel => _minLevel;

    /// <summary>是否静默模式</summary>
    public bool IsSilent => _silent;
}