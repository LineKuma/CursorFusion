using CoreFileUtils = CursorFusion.Core.FileUtils.FileUtils;

namespace CursorFusion.Core.Tests.FileUtils;

public class FileUtilsTests
{
    private readonly string _tempDir;

    public FileUtilsTests()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), $"cursorfusion-tests-{Guid.NewGuid()}");
        Directory.CreateDirectory(_tempDir);
    }

    [Fact]
    public void EnsureDir_ShouldCreateDirectory()
    {
        var dir = Path.Combine(_tempDir, "new-dir");
        Assert.False(Directory.Exists(dir));

        var utils = new CoreFileUtils();
        utils.EnsureDir(dir);

        Assert.True(Directory.Exists(dir));
    }

    [Fact]
    public void EnsureDir_ExistingDirectory_ShouldNotThrow()
    {
        var utils = new CoreFileUtils();
        utils.EnsureDir(_tempDir);
    }

    [Fact]
    public async Task WriteFileAsync_ShouldCreateFile()
    {
        var utils = new CoreFileUtils();
        var filePath = Path.Combine(_tempDir, "test.txt");

        await utils.WriteFileAsync(filePath, "hello world");

        Assert.True(File.Exists(filePath));
        Assert.Equal("hello world", await File.ReadAllTextAsync(filePath));
    }

    [Fact]
    public async Task WriteFileAsync_ShouldCreateParentDir()
    {
        var utils = new CoreFileUtils();
        var filePath = Path.Combine(_tempDir, "sub", "nested", "test.txt");

        await utils.WriteFileAsync(filePath, "nested content");

        Assert.True(File.Exists(filePath));
    }

    [Fact]
    public async Task WriteFileAsync_WithBackup_ShouldCreateBackup()
    {
        var utils = new CoreFileUtils();
        var filePath = Path.Combine(_tempDir, "backup-test.txt");

        await utils.WriteFileAsync(filePath, "original");
        await utils.WriteFileAsync(filePath, "updated", backup: true);

        Assert.True(File.Exists(filePath + ".bak"));
        Assert.Equal("original", await File.ReadAllTextAsync(filePath + ".bak"));
        Assert.Equal("updated", await File.ReadAllTextAsync(filePath));
    }

    [Fact]
    public void ReadJson_ShouldDeserialize()
    {
        var utils = new CoreFileUtils();
        var filePath = Path.Combine(_tempDir, "data.json");
        File.WriteAllText(filePath, "{\"Name\": \"test\", \"Count\": 42}");

        var result = utils.ReadJson<TestData>(filePath);

        Assert.NotNull(result);
        Assert.Equal("test", result.Name);
        Assert.Equal(42, result.Count);
    }

    [Fact]
    public async Task CopyDirAsync_ShouldCopyFiles()
    {
        var utils = new CoreFileUtils();
        var srcDir = Path.Combine(_tempDir, "src");
        var destDir = Path.Combine(_tempDir, "dest");

        Directory.CreateDirectory(srcDir);
        await File.WriteAllTextAsync(Path.Combine(srcDir, "a.txt"), "a");
        await File.WriteAllTextAsync(Path.Combine(srcDir, "b.txt"), "b");

        await utils.CopyDirAsync(srcDir, destDir);

        Assert.True(Directory.Exists(destDir));
        Assert.True(File.Exists(Path.Combine(destDir, "a.txt")));
        Assert.True(File.Exists(Path.Combine(destDir, "b.txt")));
    }

    [Fact]
    public async Task CleanDirAsync_ShouldRemoveContents()
    {
        var utils = new CoreFileUtils();
        var dir = Path.Combine(_tempDir, "to-clean");
        Directory.CreateDirectory(dir);
        await File.WriteAllTextAsync(Path.Combine(dir, "file.txt"), "content");

        await utils.CleanDirAsync(dir);

        Assert.True(Directory.Exists(dir));
        Assert.Empty(Directory.GetFileSystemEntries(dir));
    }

    [Fact]
    public async Task CleanDirAsync_NonExistent_ShouldNotThrow()
    {
        var utils = new CoreFileUtils();
        await utils.CleanDirAsync(Path.Combine(_tempDir, "nonexistent"));
    }

    [Fact]
    public async Task WalkAsync_ShouldFindFiles()
    {
        var utils = new CoreFileUtils();
        var dir = Path.Combine(_tempDir, "walk");
        Directory.CreateDirectory(Path.Combine(dir, "sub"));
        await File.WriteAllTextAsync(Path.Combine(dir, "a.txt"), "a");
        await File.WriteAllTextAsync(Path.Combine(dir, "b.cs"), "b");
        await File.WriteAllTextAsync(Path.Combine(dir, "sub", "c.txt"), "c");

        var all = await utils.WalkAsync(dir);

        Assert.Equal(3, all.Count);
    }

    [Fact]
    public async Task WalkAsync_WithExtensionFilter_ShouldFilter()
    {
        var utils = new CoreFileUtils();
        var dir = Path.Combine(_tempDir, "walk-filter");
        Directory.CreateDirectory(dir);
        await File.WriteAllTextAsync(Path.Combine(dir, "a.txt"), "a");
        await File.WriteAllTextAsync(Path.Combine(dir, "b.cs"), "b");

        var results = await utils.WalkAsync(dir, extensions: new[] { ".cs" });

        Assert.Single(results);
        Assert.EndsWith(".cs", results[0]);
    }

    [Fact]
    public async Task WalkAsync_WithIgnorePatterns_ShouldIgnore()
    {
        var utils = new CoreFileUtils();
        var dir = Path.Combine(_tempDir, "walk-ignore");
        Directory.CreateDirectory(Path.Combine(dir, "node_modules"));
        Directory.CreateDirectory(Path.Combine(dir, "src"));
        await File.WriteAllTextAsync(Path.Combine(dir, "node_modules", "dep.js"), "dep");
        await File.WriteAllTextAsync(Path.Combine(dir, "src", "main.js"), "main");

        var results = await utils.WalkAsync(dir, ignorePatterns: new[] { "node_modules" });

        Assert.Single(results);
        Assert.Contains("src", results[0]);
    }

    [Fact]
    public void DetectType_ShouldReturnCorrectTypes()
    {
        var utils = new CoreFileUtils();

        Assert.Equal("javascript", utils.DetectType("file.js"));
        Assert.Equal("typescript", utils.DetectType("file.ts"));
        Assert.Equal("json", utils.DetectType("file.json"));
        Assert.Equal("markdown", utils.DetectType("file.md"));
        Assert.Equal("yaml", utils.DetectType("file.yml"));
        Assert.Equal("html", utils.DetectType("file.html"));
        Assert.Equal("css", utils.DetectType("file.css"));
        Assert.Equal("python", utils.DetectType("file.py"));
        Assert.Equal("go", utils.DetectType("file.go"));
        Assert.Equal("rust", utils.DetectType("file.rs"));
        Assert.Equal("csharp", utils.DetectType("file.cs"));
        Assert.Equal("dotnet-project", utils.DetectType("file.csproj"));
        Assert.Equal("dotnet-solution", utils.DetectType("file.sln"));
        Assert.Equal("unknown", utils.DetectType("file.xyz"));
        Assert.Equal("unknown", utils.DetectType("file"));
    }

    private class TestData
    {
        public string Name { get; set; } = "";
        public int Count { get; set; }
    }
}