using System;
using System.Text.RegularExpressions;

namespace CursorFusion.Core.Version;

/// <summary>
/// 语义化版本信息
/// </summary>
public partial class VersionInfo
{
    public int Major { get; }
    public int Minor { get; }
    public int Patch { get; }
    public string? PreRelease { get; }
    public string? BuildMetadata { get; }

    public VersionInfo(int major = 0, int minor = 1, int patch = 0,
        string? preRelease = null, string? buildMetadata = null)
    {
        Major = major;
        Minor = minor;
        Patch = patch;
        PreRelease = preRelease;
        BuildMetadata = buildMetadata;
    }

    /// <summary>从字符串解析版本</summary>
    public static VersionInfo Parse(string version)
    {
        var match = SemverRegex().Match(version);
        if (!match.Success)
            throw new FormatException($"Invalid semver version: {version}");

        return new VersionInfo(
            int.Parse(match.Groups[1].Value),
            int.Parse(match.Groups[2].Value),
            int.Parse(match.Groups[3].Value),
            match.Groups[4].Success ? match.Groups[4].Value : null,
            match.Groups[5].Success ? match.Groups[5].Value : null
        );
    }

    /// <summary>尝试解析版本</summary>
    public static bool TryParse(string version, out VersionInfo? result)
    {
        try
        {
            result = Parse(version);
            return true;
        }
        catch
        {
            result = null;
            return false;
        }
    }

    /// <summary>递增补丁版本</summary>
    public VersionInfo BumpPatch() => new(Major, Minor, Patch + 1, null, null);

    /// <summary>递增次版本</summary>
    public VersionInfo BumpMinor() => new(Major, Minor + 1, 0, null, null);

    /// <summary>递增主版本</summary>
    public VersionInfo BumpMajor() => new(Major + 1, 0, 0, null, null);

    /// <summary>设置预发布标签</summary>
    public VersionInfo WithPreRelease(string preRelease) =>
        new(Major, Minor, Patch, preRelease, BuildMetadata);

    /// <summary>是否为预发布版本</summary>
    public bool IsPreRelease => !string.IsNullOrEmpty(PreRelease);

    /// <summary>是否为稳定版本</summary>
    public bool IsStable => string.IsNullOrEmpty(PreRelease);

    public override string ToString()
    {
        var version = $"{Major}.{Minor}.{Patch}";
        if (!string.IsNullOrEmpty(PreRelease))
            version += $"-{PreRelease}";
        if (!string.IsNullOrEmpty(BuildMetadata))
            version += $"+{BuildMetadata}";
        return version;
    }

    public override bool Equals(object? obj)
    {
        return obj is VersionInfo other &&
               Major == other.Major &&
               Minor == other.Minor &&
               Patch == other.Patch &&
               PreRelease == other.PreRelease;
    }

    public override int GetHashCode() =>
        HashCode.Combine(Major, Minor, Patch, PreRelease);

    public static bool operator ==(VersionInfo a, VersionInfo b) =>
        a.Equals(b);

    public static bool operator !=(VersionInfo a, VersionInfo b) =>
        !a.Equals(b);

    public static bool operator >(VersionInfo a, VersionInfo b)
    {
        if (a.Major != b.Major) return a.Major > b.Major;
        if (a.Minor != b.Minor) return a.Minor > b.Minor;
        if (a.Patch != b.Patch) return a.Patch > b.Patch;
        if (a.IsStable && b.IsPreRelease) return true;
        if (a.IsPreRelease && b.IsStable) return false;
        return string.Compare(a.PreRelease, b.PreRelease, StringComparison.Ordinal) > 0;
    }

    public static bool operator <(VersionInfo a, VersionInfo b) =>
        !(a > b) && a != b;

    public static bool operator >=(VersionInfo a, VersionInfo b) =>
        a > b || a == b;

    public static bool operator <=(VersionInfo a, VersionInfo b) =>
        a < b || a == b;

    [GeneratedRegex(@"^(\d+)\.(\d+)\.(\d+)(?:-([\w.]+))?(?:\+([\w.]+))?$")]
    private static partial Regex SemverRegex();
}