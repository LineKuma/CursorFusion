using CoreLogger = CursorFusion.Core.Logger.Logger;
using CursorFusion.Core.Logger;

namespace CursorFusion.Core.Tests.Logger;

public class LoggerTests
{
    [Fact]
    public void Constructor_Default_ShouldSetInfoLevel()
    {
        var logger = new CoreLogger();
        Assert.Equal(LogLevel.Info, logger.MinLevel);
        Assert.False(logger.IsSilent);
    }

    [Fact]
    public void Constructor_Silent_ShouldSetSilent()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Debug, silent: true);
        Assert.True(logger.IsSilent);
    }

    [Fact]
    public void Constructor_WithLogFile_ShouldAcceptPath()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Info, silent: false, logFile: "/tmp/test.log");
        Assert.False(logger.IsSilent);
    }

    [Fact]
    public void Debug_ShouldNotThrow()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Debug, silent: true);
        logger.Debug("test debug message");
    }

    [Fact]
    public void Info_ShouldNotThrow()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Info, silent: true);
        logger.Info("test info message");
    }

    [Fact]
    public void Warn_ShouldNotThrow()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Warn, silent: true);
        logger.Warn("test warn message");
    }

    [Fact]
    public void Error_ShouldNotThrow()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Error, silent: true);
        logger.Error("test error message");
    }

    [Fact]
    public void Error_WithException_ShouldNotThrow()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Error, silent: true);
        logger.Error("test error", new Exception("inner"));
    }

    [Fact]
    public void Fatal_ShouldNotThrow()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Debug, silent: true);
        logger.Fatal("test fatal message");
    }

    [Fact]
    public void Debug_WhenLevelIsInfo_ShouldBeSilent()
    {
        var logger = new CoreLogger(minLevel: LogLevel.Info, silent: true);
        logger.Debug("should not appear");
    }

    [Fact]
    public void LogLevel_Enum_ShouldHaveCorrectValues()
    {
        Assert.Equal(0, (int)LogLevel.Debug);
        Assert.Equal(1, (int)LogLevel.Info);
        Assert.Equal(2, (int)LogLevel.Warn);
        Assert.Equal(3, (int)LogLevel.Error);
        Assert.Equal(4, (int)LogLevel.Fatal);
    }
}