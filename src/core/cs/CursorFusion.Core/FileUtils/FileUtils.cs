using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading.Tasks;

namespace CursorFusion.Core.FileUtils;

/// <summary>
/// 文件工具类：目录遍历、安全写入、JSON 读写、类型检测
/// </summary>
public class FileUtils
{
    /// <summary>
    /// 递归读取目录下所有文件
    /// </summary>
    public async Task<List<string>> WalkAsync(
        string dir,
        string[]? extensions = null,
        string[]? ignorePatterns = null,
        int maxDepth = 10)
    {
        var results = new List<string>();
        var ignore = ignorePatterns ?? Array.Empty<string>();

        async Task WalkInternalAsync(string currentDir, int depth)
        {
            if (depth > maxDepth)
                return;

            string[] entries;
            try
            {
                entries = Directory.GetFileSystemEntries(currentDir);
            }
            catch
            {
                return;
            }

            foreach (var entry in entries)
            {
                if (ignore.Any(p => entry.Contains(p)))
                    continue;

                if (Directory.Exists(entry))
                {
                    await WalkInternalAsync(entry, depth + 1);
                }
                else if (File.Exists(entry))
                {
                    if (extensions != null && !extensions.Contains(Path.GetExtension(entry)))
                        continue;
                    results.Add(entry);
                }
            }
        }

        await WalkInternalAsync(dir, 0);
        return results;
    }

    /// <summary>确保目录存在（递归创建）</summary>
    public void EnsureDir(string dirPath)
    {
        Directory.CreateDirectory(dirPath);
    }

    /// <summary>安全写入文件（自动创建目录，可选备份）</summary>
    public async Task WriteFileAsync(string filePath, object content, string encoding = "utf-8", bool backup = false)
    {
        var dir = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(dir))
            EnsureDir(dir);

        if (backup && File.Exists(filePath))
        {
            File.Copy(filePath, filePath + ".bak", overwrite: true);
        }

        var text = content is string s ? s : JsonSerializer.Serialize(content, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(filePath, text);
    }

    /// <summary>读取 JSON 文件</summary>
    public T? ReadJson<T>(string filePath)
    {
        var content = File.ReadAllText(filePath);
        return JsonSerializer.Deserialize<T>(content);
    }

    /// <summary>复制目录</summary>
    public async Task CopyDirAsync(string src, string dest)
    {
        EnsureDir(dest);

        var entries = Directory.GetFileSystemEntries(src);
        foreach (var entry in entries)
        {
            var destPath = Path.Combine(dest, Path.GetFileName(entry));
            if (Directory.Exists(entry))
            {
                await CopyDirAsync(entry, destPath);
            }
            else
            {
                File.Copy(entry, destPath, overwrite: true);
            }
        }
    }

    /// <summary>清空目录内容</summary>
    public async Task CleanDirAsync(string dirPath)
    {
        if (!Directory.Exists(dirPath))
            return;

        var entries = Directory.GetFileSystemEntries(dirPath);
        foreach (var entry in entries)
        {
            if (Directory.Exists(entry))
            {
                Directory.Delete(entry, recursive: true);
            }
            else
            {
                File.Delete(entry);
            }
        }

        await Task.CompletedTask;
    }

    /// <summary>检测文件类型</summary>
    public string DetectType(string filePath)
    {
        var ext = Path.GetExtension(filePath).ToLowerInvariant();
        return ext switch
        {
            ".js" => "javascript",
            ".ts" => "typescript",
            ".jsx" => "jsx",
            ".tsx" => "tsx",
            ".json" => "json",
            ".md" => "markdown",
            ".yml" or ".yaml" => "yaml",
            ".html" => "html",
            ".css" => "css",
            ".py" => "python",
            ".go" => "go",
            ".rs" => "rust",
            ".cs" => "csharp",
            ".csproj" => "dotnet-project",
            ".sln" => "dotnet-solution",
            _ => "unknown"
        };
    }
}