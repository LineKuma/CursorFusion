using CursorFusion.Core.Version;

namespace CursorFusion.Core.Tests.Version;

public class VersionInfoTests
{
    [Fact]
    public void Constructor_Default_ShouldBeZeroOneZero()
    {
        var v = new VersionInfo();
        Assert.Equal(0, v.Major);
        Assert.Equal(1, v.Minor);
        Assert.Equal(0, v.Patch);
        Assert.Null(v.PreRelease);
        Assert.Null(v.BuildMetadata);
    }

    [Fact]
    public void Constructor_Custom_ShouldSetValues()
    {
        var v = new VersionInfo(1, 2, 3, "alpha", "build.1");
        Assert.Equal(1, v.Major);
        Assert.Equal(2, v.Minor);
        Assert.Equal(3, v.Patch);
        Assert.Equal("alpha", v.PreRelease);
        Assert.Equal("build.1", v.BuildMetadata);
    }

    [Fact]
    public void Parse_ValidSemver_ShouldParse()
    {
        var v = VersionInfo.Parse("1.2.3");
        Assert.Equal(1, v.Major);
        Assert.Equal(2, v.Minor);
        Assert.Equal(3, v.Patch);
        Assert.Null(v.PreRelease);
    }

    [Fact]
    public void Parse_WithPreRelease_ShouldParse()
    {
        var v = VersionInfo.Parse("1.2.3-alpha.1");
        Assert.Equal(1, v.Major);
        Assert.Equal(2, v.Minor);
        Assert.Equal(3, v.Patch);
        Assert.Equal("alpha.1", v.PreRelease);
    }

    [Fact]
    public void Parse_WithBuildMetadata_ShouldParse()
    {
        var v = VersionInfo.Parse("1.2.3+build.123");
        Assert.Equal("build.123", v.BuildMetadata);
    }

    [Fact]
    public void Parse_WithPreReleaseAndBuild_ShouldParse()
    {
        var v = VersionInfo.Parse("1.2.3-beta.1+build.456");
        Assert.Equal("beta.1", v.PreRelease);
        Assert.Equal("build.456", v.BuildMetadata);
    }

    [Fact]
    public void Parse_InvalidVersion_ShouldThrowFormatException()
    {
        Assert.Throws<FormatException>(() => VersionInfo.Parse("not.a.version"));
        Assert.Throws<FormatException>(() => VersionInfo.Parse("1.2"));
        Assert.Throws<FormatException>(() => VersionInfo.Parse(""));
    }

    [Fact]
    public void TryParse_Valid_ShouldReturnTrue()
    {
        var success = VersionInfo.TryParse("2.0.0", out var result);
        Assert.True(success);
        Assert.NotNull(result);
        Assert.Equal(2, result.Major);
    }

    [Fact]
    public void TryParse_Invalid_ShouldReturnFalse()
    {
        var success = VersionInfo.TryParse("invalid", out var result);
        Assert.False(success);
        Assert.Null(result);
    }

    [Fact]
    public void BumpPatch_ShouldIncrementPatch()
    {
        var v = new VersionInfo(1, 2, 3);
        var bumped = v.BumpPatch();
        Assert.Equal(1, bumped.Major);
        Assert.Equal(2, bumped.Minor);
        Assert.Equal(4, bumped.Patch);
        Assert.Null(bumped.PreRelease);
    }

    [Fact]
    public void BumpMinor_ShouldIncrementMinorAndResetPatch()
    {
        var v = new VersionInfo(1, 2, 3);
        var bumped = v.BumpMinor();
        Assert.Equal(1, bumped.Major);
        Assert.Equal(3, bumped.Minor);
        Assert.Equal(0, bumped.Patch);
    }

    [Fact]
    public void BumpMajor_ShouldIncrementMajorAndResetOthers()
    {
        var v = new VersionInfo(1, 2, 3);
        var bumped = v.BumpMajor();
        Assert.Equal(2, bumped.Major);
        Assert.Equal(0, bumped.Minor);
        Assert.Equal(0, bumped.Patch);
    }

    [Fact]
    public void WithPreRelease_ShouldSetPreRelease()
    {
        var v = new VersionInfo(1, 0, 0);
        var prerelease = v.WithPreRelease("rc.1");
        Assert.Equal("rc.1", prerelease.PreRelease);
        Assert.True(prerelease.IsPreRelease);
        Assert.False(prerelease.IsStable);
    }

    [Fact]
    public void IsPreRelease_And_IsStable()
    {
        var stable = new VersionInfo(1, 0, 0);
        Assert.True(stable.IsStable);
        Assert.False(stable.IsPreRelease);

        var prerelease = new VersionInfo(1, 0, 0, "alpha");
        Assert.False(prerelease.IsStable);
        Assert.True(prerelease.IsPreRelease);
    }

    [Fact]
    public void ToString_ShouldFormatCorrectly()
    {
        Assert.Equal("1.2.3", new VersionInfo(1, 2, 3).ToString());
        Assert.Equal("1.2.3-alpha", new VersionInfo(1, 2, 3, "alpha").ToString());
        Assert.Equal("1.2.3+build.1", new VersionInfo(1, 2, 3, null, "build.1").ToString());
        Assert.Equal("1.2.3-beta+build.1", new VersionInfo(1, 2, 3, "beta", "build.1").ToString());
    }

    [Fact]
    public void Equality_ShouldWork()
    {
        var a = new VersionInfo(1, 2, 3);
        var b = new VersionInfo(1, 2, 3);
        var c = new VersionInfo(1, 2, 4);

        Assert.True(a == b);
        Assert.True(a != c);
        Assert.True(a.Equals(b));
        Assert.False(a.Equals(null));
        Assert.Equal(a.GetHashCode(), b.GetHashCode());
    }

    [Fact]
    public void Comparison_GreaterThan()
    {
        Assert.True(new VersionInfo(2, 0, 0) > new VersionInfo(1, 9, 9));
        Assert.True(new VersionInfo(1, 3, 0) > new VersionInfo(1, 2, 9));
        Assert.True(new VersionInfo(1, 2, 4) > new VersionInfo(1, 2, 3));
        Assert.True(new VersionInfo(1, 0, 0) > new VersionInfo(1, 0, 0, "beta"));
    }

    [Fact]
    public void Comparison_LessThan()
    {
        Assert.True(new VersionInfo(1, 0, 0) < new VersionInfo(2, 0, 0));
        Assert.True(new VersionInfo(1, 0, 0, "alpha") < new VersionInfo(1, 0, 0));
    }

    [Fact]
    public void Comparison_GreaterThanOrEqual()
    {
        Assert.True(new VersionInfo(1, 0, 0) >= new VersionInfo(1, 0, 0));
        Assert.True(new VersionInfo(1, 0, 1) >= new VersionInfo(1, 0, 0));
    }

    [Fact]
    public void Comparison_LessThanOrEqual()
    {
        Assert.True(new VersionInfo(1, 0, 0) <= new VersionInfo(1, 0, 0));
        Assert.True(new VersionInfo(1, 0, 0) <= new VersionInfo(1, 0, 1));
    }
}