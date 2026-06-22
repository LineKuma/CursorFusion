using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;

namespace CursorFusion.Core.Config;

/// <summary>
/// 配置管理器：加载、保存、查询 JSON 配置文件
/// </summary>
public class ConfigManager
{
    private readonly string _configPath;
    private Dictionary<string, JsonElement> _data = new();
    private string _rawJson = "{}";

    public ConfigManager(string? configPath = null)
    {
        _configPath = configPath
            ?? Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                ".cursorfusion", "config.json"
            );
    }

    /// <summary>配置文件路径</summary>
    public string ConfigPath => _configPath;

    /// <summary>异步加载配置</summary>
    public async Task LoadAsync()
    {
        if (!File.Exists(_configPath))
        {
            _data = new Dictionary<string, JsonElement>();
            _rawJson = "{}";
            return;
        }

        _rawJson = await File.ReadAllTextAsync(_configPath);
        using var doc = JsonDocument.Parse(_rawJson);
        _data = new Dictionary<string, JsonElement>();

        foreach (var prop in doc.RootElement.EnumerateObject())
        {
            _data[prop.Name] = prop.Value.Clone();
        }
    }

    /// <summary>保存配置到文件</summary>
    public async Task SaveAsync()
    {
        var dir = Path.GetDirectoryName(_configPath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);

        await File.WriteAllTextAsync(_configPath, _rawJson);
    }

    /// <summary>获取所有配置</summary>
    public Dictionary<string, object?> GetAll()
    {
        var result = new Dictionary<string, object?>();
        foreach (var (key, value) in _data)
        {
            result[key] = JsonElementToObject(value);
        }
        return result;
    }

    /// <summary>获取字符串配置</summary>
    public string? GetString(string key, string? defaultValue = null)
    {
        if (_data.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.String)
            return value.GetString();
        return defaultValue;
    }

    /// <summary>获取整数配置</summary>
    public int GetInt(string key, int defaultValue = 0)
    {
        if (_data.TryGetValue(key, out var value) && value.ValueKind == JsonValueKind.Number)
            return value.GetInt32();
        return defaultValue;
    }

    /// <summary>获取布尔配置</summary>
    public bool GetBool(string key, bool defaultValue = false)
    {
        if (_data.TryGetValue(key, out var value) &&
            (value.ValueKind == JsonValueKind.True || value.ValueKind == JsonValueKind.False))
            return value.GetBoolean();
        return defaultValue;
    }

    /// <summary>设置配置项</summary>
    public void Set(string key, object? value)
    {
        var json = JsonSerializer.Serialize(value);
        using var doc = JsonDocument.Parse(json);
        _data[key] = doc.RootElement.Clone();

        // 重建 raw JSON
        var dict = new Dictionary<string, object?>();
        foreach (var (k, v) in _data)
        {
            dict[k] = JsonElementToObject(v);
        }
        _rawJson = JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true });
    }

    /// <summary>检查配置项是否存在</summary>
    public bool Has(string key) => _data.ContainsKey(key);

    /// <summary>删除配置项</summary>
    public bool Remove(string key)
    {
        var removed = _data.Remove(key);
        if (removed)
        {
            var dict = new Dictionary<string, object?>();
            foreach (var (k, v) in _data)
            {
                dict[k] = JsonElementToObject(v);
            }
            _rawJson = JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true });
        }
        return removed;
    }

    private static object? JsonElementToObject(JsonElement element)
    {
        return element.ValueKind switch
        {
            JsonValueKind.String => element.GetString(),
            JsonValueKind.Number => element.TryGetInt64(out var l) ? l : element.GetDouble(),
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            JsonValueKind.Null => null,
            JsonValueKind.Array => element.EnumerateArray().Select(JsonElementToObject).ToList(),
            JsonValueKind.Object => element.EnumerateObject()
                .ToDictionary(p => p.Name, p => JsonElementToObject(p.Value)),
            _ => element.GetRawText()
        };
    }
}