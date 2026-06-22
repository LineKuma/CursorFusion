const fs = require("fs");
const path = require("path");
const os = require("os");
const { VersionInfo } = require("../../src/core/version");

describe("VersionInfo", () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "cf-version-test-"),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe("constructor & load()", () => {
    it("should load version from package.json", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.2.3" }),
      );

      const vi = new VersionInfo(pkgPath);
      expect(vi.version).toBe("1.2.3");
    });

    it("should fallback to 0.0.0 when no package.json", () => {
      const vi = new VersionInfo("/nonexistent/path/package.json");
      expect(vi.version).toBe("0.0.0");
    });

    it("should fallback to 0.0.0 when package.json has empty version", async () => {
      const pkgPath = path.join(tmpDir, "pkg-empty-ver.json");
      await fs.promises.writeFile(pkgPath, JSON.stringify({ version: "" }));

      const vi = new VersionInfo(pkgPath);
      expect(vi.version).toBe("0.0.0");
    });

    it("should handle package.json without version field", async () => {
      const pkgPath = path.join(tmpDir, "pkg-no-ver.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ name: "no-version" }),
      );

      const vi = new VersionInfo(pkgPath);
      expect(vi.version).toBe("0.0.0");
    });

    it("should load prerelease versions", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "2.0.0-beta.1" }),
      );

      const vi = new VersionInfo(pkgPath);
      expect(vi.version).toBe("2.0.0-beta.1");
    });
  });

  describe("toString()", () => {
    it("should return version string", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "3.1.0" }),
      );

      const vi = new VersionInfo(pkgPath);
      expect(vi.toString()).toBe("3.1.0");
    });
  });

  describe("parse()", () => {
    it("should parse standard semver", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "4.5.6" }),
      );

      const vi = new VersionInfo(pkgPath);
      const parsed = vi.parse();

      expect(parsed.major).toBe(4);
      expect(parsed.minor).toBe(5);
      expect(parsed.patch).toBe(6);
      expect(parsed.prerelease).toBeNull();
      expect(parsed.raw).toBe("4.5.6");
    });

    it("should parse v-prefixed version", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "v1.0.0" }),
      );

      const vi = new VersionInfo(pkgPath);
      const parsed = vi.parse();

      expect(parsed.major).toBe(1);
      expect(parsed.raw).toBe("v1.0.0");
    });

    it("should parse alpha/beta/rc versions", async () => {
      const cases = [
        ["0.1.0-alpha.1", "alpha.1"],
        ["1.0.0-beta.2", "beta.2"],
        ["2.0.0-rc.1", "rc.1"],
      ];

      for (const [version, expectedPre] of cases) {
        const pkgPath = path.join(
          tmpDir,
          `pkg-${version.replace(/\./g, "-")}.json`,
        );
        await fs.promises.writeFile(pkgPath, JSON.stringify({ version }));
        const vi = new VersionInfo(pkgPath);
        expect(vi.parse().prerelease).toBe(expectedPre);
      }
    });

    it("should return zeros for unparseable version", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(pkgPath, JSON.stringify({ version: "abc" }));

      const vi = new VersionInfo(pkgPath);
      const parsed = vi.parse();

      expect(parsed.major).toBe(0);
      expect(parsed.minor).toBe(0);
      expect(parsed.patch).toBe(0);
      expect(parsed.raw).toBe("abc");
    });

    it("__innerParse should handle completely invalid strings", () => {
      // 直接测试内部方法
      const result = VersionInfo.__innerParse("not-a-version");
      expect(result.major).toBe(0);
      expect(result.minor).toBe(0);
      expect(result.patch).toBe(0);
      expect(result.prerelease).toBeNull();
      expect(result.raw).toBe("not-a-version");
    });

    it("__innerParse should parse version without prerelease", () => {
      const result = VersionInfo.__innerParse("3.2.1");
      expect(result.major).toBe(3);
      expect(result.minor).toBe(2);
      expect(result.patch).toBe(1);
      expect(result.prerelease).toBeNull();
    });

    it("__innerParse should parse v-prefixed version", () => {
      const result = VersionInfo.__innerParse("v1.0.0");
      expect(result.major).toBe(1);
      expect(result.prerelease).toBeNull();
    });
  });

  describe("isPrerelease()", () => {
    it("should return false for stable releases", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0" }),
      );
      expect(new VersionInfo(pkgPath).isPrerelease()).toBe(false);
    });

    it("should return true for alpha versions", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "0.1.0-alpha.1" }),
      );
      expect(new VersionInfo(pkgPath).isPrerelease()).toBe(true);
    });

    it("should return true for beta versions", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0-beta" }),
      );
      expect(new VersionInfo(pkgPath).isPrerelease()).toBe(true);
    });
  });

  describe("compare()", () => {
    it("should return 0 for equal versions", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0" }),
      );
      const vi = new VersionInfo(pkgPath);

      expect(vi.compare("1.0.0")).toBe(0);
      expect(vi.compare("v1.0.0")).toBe(0);
    });

    it("should return 1 when this > other", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "2.0.0" }),
      );
      const vi = new VersionInfo(pkgPath);

      expect(vi.compare("1.9.9")).toBe(1);
      expect(vi.compare("1.99.99")).toBe(1);
    });

    it("should return -1 when this < other", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0" }),
      );
      const vi = new VersionInfo(pkgPath);

      expect(vi.compare("1.0.1")).toBe(-1);
      expect(vi.compare("2.0.0")).toBe(-1);
    });

    it("should consider stable newer than prerelease", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0" }),
      );
      const vi = new VersionInfo(pkgPath);

      // stable 1.0.0 > prerelease 1.0.0-alpha
      expect(vi.compare("1.0.0-alpha.1")).toBe(1);
    });

    it("should consider prerelease older than stable", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0-alpha.1" }),
      );
      const vi = new VersionInfo(pkgPath);

      expect(vi.compare("1.0.0")).toBe(-1);
    });

    it("should compare two different prereleases alphabetically", async () => {
      // alpha < beta < rc (localeCompare)
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0-alpha.2" }),
      );
      const vi = new VersionInfo(pkgPath);

      // alpha.2 < beta.1
      expect(vi.compare("1.0.0-beta.1")).toBeLessThan(0);
      // alpha.2 > alpha.1
      expect(vi.compare("1.0.0-alpha.1")).toBeGreaterThan(0);
      // beta.1 < rc.1
      expect(vi.compare("1.0.0-rc.1")).toBeLessThan(0);
    });

    it("should return 0 for identical prereleases", async () => {
      const pkgPath = path.join(tmpDir, "package.json");
      await fs.promises.writeFile(
        pkgPath,
        JSON.stringify({ version: "1.0.0-beta.2" }),
      );
      const vi = new VersionInfo(pkgPath);

      expect(vi.compare("1.0.0-beta.2")).toBe(0);
    });
  });

  describe("satisfies()", () => {
    describe("^ (caret) ranges", () => {
      it("should match same major", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "1.2.3" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("^1.0.0")).toBe(true);
      });

      it("should not match different major", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "2.0.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("^1.0.0")).toBe(false);
      });
    });

    describe("~ (tilde) ranges", () => {
      it("should match same minor", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "1.2.5" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("~1.2.0")).toBe(true);
      });

      it("should not match different minor", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "1.3.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("~1.2.0")).toBe(false);
      });
    });

    describe("comparison operators", () => {
      it(">= should work", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "2.0.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies(">=1.0.0")).toBe(true);
        expect(new VersionInfo(pkgPath).satisfies(">=3.0.0")).toBe(false);
      });

      it("> should work", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "2.0.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies(">1.0.0")).toBe(true);
        expect(new VersionInfo(pkgPath).satisfies(">2.0.0")).toBe(false);
        expect(new VersionInfo(pkgPath).satisfies(">3.0.0")).toBe(false);
      });

      it("<= should work", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "1.5.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("<=2.0.0")).toBe(true);
        expect(new VersionInfo(pkgPath).satisfies("<=1.0.0")).toBe(false);
      });

      it("< should work", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "1.5.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("<2.0.0")).toBe(true);
        expect(new VersionInfo(pkgPath).satisfies("<1.5.0")).toBe(false);
        expect(new VersionInfo(pkgPath).satisfies("<1.0.0")).toBe(false);
      });

      it("exact match should work", async () => {
        const pkgPath = path.join(tmpDir, "package.json");
        await fs.promises.writeFile(
          pkgPath,
          JSON.stringify({ version: "1.0.0" }),
        );
        expect(new VersionInfo(pkgPath).satisfies("1.0.0")).toBe(true);
        expect(new VersionInfo(pkgPath).satisfies("1.0.1")).toBe(false);
      });
    });
  });
});
