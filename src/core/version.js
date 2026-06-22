const fs = require("fs");
const path = require("path");

class VersionInfo {
  constructor(packageJsonPath) {
    this.packageJsonPath =
      packageJsonPath || path.join(__dirname, "../../package.json");
    this._version = null;
  }

  load() {
    if (fs.existsSync(this.packageJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(this.packageJsonPath, "utf-8"));
      this._version = pkg.version || "0.0.0";
    } else {
      this._version = "0.0.0";
    }
    return this._version;
  }

  get version() {
    if (!this._version) this.load();
    return this._version;
  }

  toString() {
    return this.version;
  }

  parse() {
    const v = this.version;
    const match = v.match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
    if (!match) {
      return { major: 0, minor: 0, patch: 0, prerelease: null, raw: v };
    }

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      prerelease: match[4] || null,
      raw: v,
    };
  }

  isPrerelease() {
    const parsed = this.parse();
    return parsed.prerelease !== null;
  }

  compare(otherVersion) {
    const a = this.parse();
    const b = new VersionInfo.__innerParse(otherVersion);

    // 比较 major.minor.patch
    for (const key of ["major", "minor", "patch"]) {
      if (a[key] > b[key]) return 1;
      if (a[key] < b[key]) return -1;
    }

    // 预发布版本低于正式版
    if (a.prerelease && !b.prerelease) return -1;
    if (!a.prerelease && b.prerelease) return 1;
    if (a.prerelease && b.prerelease) {
      return a.prerelease.localeCompare(b.prerelease);
    }

    return 0;
  }

  satisfies(range) {
    // 简化的 semver 范围匹配：支持 ^, ~, >=, >, <=, <, =
    const v = this.version.replace(/^v/, "");

    if (range.startsWith("^")) {
      const min = range.slice(1).replace(/^v/, "");
      const parts = min.split(".").map(Number);
      return v.startsWith(`${parts[0]}.`);
    }

    if (range.startsWith("~")) {
      const min = range.slice(1).replace(/^v/, "");
      const [major, minor] = min.split(".").map(Number);
      const [vmajor, vminor] = v.split(".").map(Number);
      return vmajor === major && vminor === minor;
    }

    if (range.startsWith(">=")) return v >= range.slice(2).replace(/^v/, "");
    if (range.startsWith(">")) return v > range.slice(1).replace(/^v/, "");
    if (range.startsWith("<=")) return v <= range.slice(2).replace(/^v/, "");
    if (range.startsWith("<")) return v < range.slice(1).replace(/^v/, "");

    return v === range.replace(/^v/, "");
  }
}

// 静态辅助方法
VersionInfo.__innerParse = function (versionStr) {
  const match = String(versionStr).match(/^v?(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match)
    return { major: 0, minor: 0, patch: 0, prerelease: null, raw: versionStr };

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    raw: versionStr,
  };
};

module.exports = { VersionInfo };
