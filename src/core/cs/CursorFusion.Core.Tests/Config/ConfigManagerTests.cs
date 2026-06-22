using CursorFusion.Core.Config;

namespace CursorFusion.Core.Tests.Config;

public class ConfigManagerTests
{
    [Fact]
    public void Constructor_DefaultPath_ShouldSetConfigPath()
    {
        var config = new ConfigManager();
        Assert.Contains(".cursorfusion", config.ConfigPath);
        Assert.Contains("config.json", config.ConfigPath);
    }

    [Fact]
    public void Constructor_CustomPath_ShouldSetConfigPath()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        Assert.Equal("/tmp/test-config.json", config.ConfigPath);
    }

    [Fact]
    public async Task LoadAsync_NonExistentFile_ShouldNotThrow()
    {
        var config = new ConfigManager("/tmp/nonexistent-config.json");
        await config.LoadAsync();
        var all = config.GetAll();
        Assert.Empty(all);
    }

    [Fact]
    public async Task LoadAsync_ExistingFile_ShouldParseJson()
    {
        var path = Path.GetTempFileName();
        try
        {
            await File.WriteAllTextAsync(path, "{\"key1\": \"value1\", \"key2\": 42}");

            var config = new ConfigManager(path);
            await config.LoadAsync();

            Assert.Equal("value1", config.GetString("key1"));
            Assert.Equal(42, config.GetInt("key2"));
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Fact]
    public void Set_And_GetString_ShouldWork()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        config.Set("name", "CursorFusion");
        Assert.Equal("CursorFusion", config.GetString("name"));
    }

    [Fact]
    public void Set_And_GetInt_ShouldWork()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        config.Set("port", 8080);
        Assert.Equal(8080, config.GetInt("port"));
    }

    [Fact]
    public void Set_And_GetBool_ShouldWork()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        config.Set("enabled", true);
        Assert.True(config.GetBool("enabled"));
    }

    [Fact]
    public void GetString_MissingKey_ShouldReturnDefault()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        Assert.Null(config.GetString("missing"));
        Assert.Equal("default", config.GetString("missing", "default"));
    }

    [Fact]
    public void GetInt_MissingKey_ShouldReturnDefault()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        Assert.Equal(0, config.GetInt("missing"));
        Assert.Equal(100, config.GetInt("missing", 100));
    }

    [Fact]
    public void GetBool_MissingKey_ShouldReturnDefault()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        Assert.False(config.GetBool("missing"));
        Assert.True(config.GetBool("missing", true));
    }

    [Fact]
    public void Has_ShouldReturnCorrectly()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        Assert.False(config.Has("key"));
        config.Set("key", "value");
        Assert.True(config.Has("key"));
    }

    [Fact]
    public void Remove_ShouldRemoveKey()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        config.Set("key", "value");
        Assert.True(config.Has("key"));

        var removed = config.Remove("key");
        Assert.True(removed);
        Assert.False(config.Has("key"));
    }

    [Fact]
    public void Remove_MissingKey_ShouldReturnFalse()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        Assert.False(config.Remove("nonexistent"));
    }

    [Fact]
    public async Task SaveAsync_ShouldWriteFile()
    {
        var path = Path.GetTempFileName();
        try
        {
            var config = new ConfigManager(path);
            config.Set("test", "saved");
            await config.SaveAsync();

            Assert.True(File.Exists(path));
            var content = await File.ReadAllTextAsync(path);
            Assert.Contains("test", content);
            Assert.Contains("saved", content);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
        }
    }

    [Fact]
    public void GetAll_ShouldReturnAllKeys()
    {
        var config = new ConfigManager("/tmp/test-config.json");
        config.Set("a", 1);
        config.Set("b", "two");
        config.Set("c", true);

        var all = config.GetAll();
        Assert.Equal(3, all.Count);
        Assert.Contains("a", all.Keys);
        Assert.Contains("b", all.Keys);
        Assert.Contains("c", all.Keys);
    }
}