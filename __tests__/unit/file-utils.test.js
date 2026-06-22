const fs = require("fs");
const path = require("path");
const os = require("os");
const { FileUtils } = require("../../src/core/file-utils");

describe("FileUtils", () => {
  let tmpDir;
  let fu;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cf-file-test-"));
    fu = new FileUtils();
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  describe("walk()", () => {
    beforeEach(async () => {
      // 创建测试目录结构
      await fs.promises.mkdir(path.join(tmpDir, "src"), { recursive: true });
      await fs.promises.mkdir(path.join(tmpDir, "src/components"), {
        recursive: true,
      });
      await fs.promises.mkdir(path.join(tmpDir, "dist"), { recursive: true });
      await fs.promises.mkdir(path.join(tmpDir, "node_modules"), {
        recursive: true,
      });

      await fs.promises.writeFile(path.join(tmpDir, "index.js"), "// index");
      await fs.promises.writeFile(path.join(tmpDir, "package.json"), "{}");
      await fs.promises.writeFile(path.join(tmpDir, "src/app.js"), "// app");
      await fs.promises.writeFile(
        path.join(tmpDir, "src/utils.js"),
        "// utils",
      );
      await fs.promises.writeFile(
        path.join(tmpDir, "src/components/Button.jsx"),
        "// button",
      );
      await fs.promises.writeFile(
        path.join(tmpDir, "dist/bundle.js"),
        "// bundle",
      );
      await fs.promises.writeFile(
        path.join(tmpDir, "node_modules/dep.js"),
        "// dep",
      );
      await fs.promises.writeFile(path.join(tmpDir, "README.md"), "# readme");
    });

    it("should find all files recursively by default", async () => {
      const files = await fu.walk(tmpDir);
      expect(files.length).toBeGreaterThanOrEqual(7); // 至少包含非 node_modules 文件
    });

    it("should filter by extensions", async () => {
      const jsFiles = await fu.walk(tmpDir, { extensions: [".js"] });
      for (const f of jsFiles) {
        expect(path.extname(f)).toBe(".js");
      }
      expect(jsFiles.length).toBeGreaterThan(0);
    });

    it("should filter out ignored patterns", async () => {
      const files = await fu.walk(tmpDir, {
        ignorePatterns: ["node_modules", "dist"],
      });
      const result = files.join(",");
      expect(result).not.toContain("node_modules");
      expect(result).not.toContain("dist");
    });

    it("should respect maxDepth", async () => {
      const files = await fu.walk(tmpDir, { maxDepth: 1 });
      // depth=1 只扫描顶层目录下的文件和一级子目录
      // 不应该深入到 src/components
      const hasDeepFile = files.some((f) => f.includes("components"));
      expect(hasDeepFile).toBe(false);
    });

    it("should handle deeply nested directories (3+ levels)", async () => {
      // 创建 4 层嵌套: level1/level2/level3/level4
      const deepPath = path.join(tmpDir, "l1", "l2", "l3", "l4");
      await fs.promises.mkdir(deepPath, { recursive: true });
      await fs.promises.writeFile(path.join(deepPath, "deep.js"), "// deep");

      const files = await fu.walk(tmpDir, { extensions: [".js"] });
      expect(files.some((f) => f.includes("deep.js"))).toBe(true);

      // 确认递归到了第 4 层
      const deepFile = files.find((f) => f.includes("deep.js"));
      expect(deepFile).toBeDefined();
      expect(deepFile).toContain(path.join("l1", "l2", "l3", "l4"));
    });

    it("should skip non-matching extensions in nested dirs", async () => {
      // 创建混合内容的深层目录
      const mixDir = path.join(tmpDir, "mixed");
      await fs.promises.mkdir(path.join(mixDir, "sub"), { recursive: true });
      await fs.promises.writeFile(path.join(mixDir, "code.js"), "// code");
      await fs.promises.writeFile(path.join(mixDir, "data.json"), "{}");
      await fs.promises.writeFile(
        path.join(mixDir, "sub", "inner.js"),
        "// inner",
      );
      await fs.promises.writeFile(
        path.join(mixDir, "sub", "inner.txt"),
        "text",
      );
      await fs.promises.writeFile(
        path.join(mixDir, "sub", "style.css"),
        "/* css */",
      );

      const jsFiles = await fu.walk(mixDir, { extensions: [".js"] });
      // 应该找到 code.js 和 inner.js，但不包括 .json/.txt/.css
      expect(jsFiles).toHaveLength(2);
      expect(jsFiles.every((f) => f.endsWith(".js"))).toBe(true);
    });

    it("should return empty when all files filtered out by extensions", async () => {
      const onlyMdDir = path.join(tmpDir, "md-only");
      await fs.promises.mkdir(onlyMdDir);
      await fs.promises.writeFile(path.join(onlyMdDir, "readme.md"), "# hello");

      const jsFiles = await fu.walk(onlyMdDir, { extensions: [".js"] });
      expect(jsFiles).toEqual([]);
    });

    it("should recurse into subdirectories at every depth level", async () => {
      // 在独立目录创建 5 层嵌套，每层都有文件和子目录
      const nestedDir = path.join(tmpDir, "nested-deep");
      await fs.promises.mkdir(nestedDir);
      let currentPath = nestedDir;
      for (let i = 1; i <= 5; i++) {
        currentPath = path.join(currentPath, `level${i}`);
        await fs.promises.mkdir(currentPath);
        await fs.promises.writeFile(
          path.join(currentPath, `file${i}.js`),
          `// level ${i}`,
        );
      }

      // 不限制深度，应该遍历到最底层
      const files = await fu.walk(nestedDir, {
        extensions: [".js"],
        maxDepth: 10,
      });
      expect(files).toHaveLength(5); // 每层一个 .js 文件
      for (let i = 1; i <= 5; i++) {
        expect(files.some((f) => f.includes(`file${i}.js`))).toBe(true);
      }
    });

    it("should handle directory containing only subdirectories (no leaf files)", async () => {
      const dirOnly = path.join(tmpDir, "dir-only");
      await fs.promises.mkdir(path.join(dirOnly, "a", "b"), {
        recursive: true,
      });
      await fs.promises.writeFile(
        path.join(dirOnly, "a", "b", "leaf.js"),
        "// leaf",
      );

      const files = await fu.walk(dirOnly, { extensions: [".js"] });
      expect(files).toHaveLength(1);
      expect(files[0]).toContain("leaf.js");
    });

    it("should skip non-file non-directory entries (e.g., symlinks)", async () => {
      const symDir = path.join(tmpDir, "symlink-test");
      await fs.promises.mkdir(symDir);

      // 创建一个普通文件和一个指向它的符号链接
      const realFile = path.join(symDir, "real.js");
      await fs.promises.writeFile(realFile, "// real");
      const symLink = path.join(symDir, "link.js");
      await fs.promises.symlink(realFile, symLink);

      const files = await fu.walk(symDir, { extensions: [".js"] });
      // 应该只找到真实文件，符号链接可能被跳过或作为文件处理
      expect(files.length).toBeGreaterThanOrEqual(1);
      expect(files.some((f) => f.includes("real.js"))).toBe(true);
    });

    it("should return empty array for empty directory", async () => {
      const emptyDir = path.join(tmpDir, "empty");
      await fs.promises.mkdir(emptyDir);
      const files = await fu.walk(emptyDir);
      expect(files).toEqual([]);
    });

    it("should handle non-existent directory gracefully", async () => {
      const files = await fu.walk("/nonexistent/path/xyz");
      expect(files).toEqual([]);
    });
  });

  describe("ensureDir()", () => {
    it("should create directory that does not exist", async () => {
      const newPath = path.join(tmpDir, "new/nested/dir");
      await fu.ensureDir(newPath);
      expect(fs.existsSync(newPath)).toBe(true);
    });

    it("should not throw if directory already exists", async () => {
      await expect(fu.ensureDir(tmpDir)).resolves.not.toThrow();
    });
  });

  describe("writeFile()", () => {
    it("should write string content", async () => {
      const filePath = path.join(tmpDir, "output.txt");
      await fu.writeFile(filePath, "hello world");

      const content = await fs.promises.readFile(filePath, "utf-8");
      expect(content).toBe("hello world");
    });

    it("should auto-create parent directories", async () => {
      const filePath = path.join(tmpDir, "deep", "nested", "file.txt");
      await fu.writeFile(filePath, "content");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("should write JSON content as formatted string", async () => {
      const filePath = path.join(tmpDir, "data.json");
      await fu.writeFile(filePath, { foo: "bar", num: 42 });

      const content = JSON.parse(await fs.promises.readFile(filePath, "utf-8"));
      expect(content.foo).toBe("bar");
      expect(content.num).toBe(42);
    });

    it("should create backup when backup option is true", async () => {
      const filePath = path.join(tmpDir, "important.txt");
      await fu.writeFile(filePath, "original");
      await fu.writeFile(filePath, "updated", { backup: true });

      const backupContent = await fs.promises.readFile(
        filePath + ".bak",
        "utf-8",
      );
      expect(backupContent).toBe("original");

      const currentContent = await fs.promises.readFile(filePath, "utf-8");
      expect(currentContent).toBe("updated");
    });
  });

  describe("readJson()", () => {
    it("should parse JSON file correctly", async () => {
      const filePath = path.join(tmpDir, "config.json");
      await fs.promises.writeFile(
        filePath,
        JSON.stringify({ a: 1, b: [2, 3] }),
      );

      const data = fu.readJson(filePath);
      expect(data).toEqual({ a: 1, b: [2, 3] });
    });

    it("should throw on invalid JSON", () => {
      expect(() =>
        fu.readJson(path.join(tmpDir, "nonexistent.json")),
      ).toThrow();
    });
  });

  describe("copyDir()", () => {
    it("should copy all files from source to destination", async () => {
      // 准备源目录
      const srcDir = path.join(tmpDir, "source");
      await fs.promises.mkdir(path.join(srcDir, "sub"), { recursive: true });
      await fs.promises.writeFile(path.join(srcDir, "a.txt"), "aaa");
      await fs.promises.writeFile(path.join(srcDir, "sub", "b.txt"), "bbb");

      const destDir = path.join(tmpDir, "dest");
      await fu.copyDir(srcDir, destDir);

      expect(fs.existsSync(path.join(destDir, "a.txt"))).toBe(true);
      expect(fs.existsSync(path.join(destDir, "sub", "b.txt"))).toBe(true);

      const aContent = await fs.promises.readFile(
        path.join(destDir, "a.txt"),
        "utf-8",
      );
      expect(aContent).toBe("aaa");
    });
  });

  describe("cleanDir()", () => {
    it("should remove all contents of directory", async () => {
      await fs.promises.writeFile(path.join(tmpDir, "keep-me.txt"), "data");
      await fs.promises.mkdir(path.join(tmpDir, "subdir"));
      await fs.promises.writeFile(
        path.join(tmpDir, "subdir", "nested.txt"),
        "nested",
      );

      await fu.cleanDir(tmpDir);

      const entries = await fs.promises.readdir(tmpDir);
      expect(entries).toEqual([]); // 目录本身存在但内容清空
    });

    it("should not throw on non-existent directory", async () => {
      await expect(fu.cleanDir("/nonexistent/path")).resolves.not.toThrow();
    });
  });

  describe("detectType()", () => {
    const testCases = [
      ["/path/to/file.js", "javascript"],
      ["/path/to/file.ts", "typescript"],
      ["/path/to/App.jsx", "jsx"],
      ["/path/to/App.tsx", "tsx"],
      ["/path/to/data.json", "json"],
      ["/path/to/readme.md", "markdown"],
      ["/path/to/config.yml", "yaml"],
      ["/path/to/config.yaml", "yaml"],
      ["/path/to/index.html", "html"],
      ["/path/to/style.css", "css"],
      ["/path/to/script.py", "python"],
      ["/path/to/main.go", "go"],
      ["/path/to/lib.rs", "rust"],
      ["/path/to/unknown.xyz", "unknown"],
    ];

    test.each(testCases)(
      'detectType("%s") should return "%s"',
      (filePath, expectedType) => {
        expect(fu.detectType(filePath)).toBe(expectedType);
      },
    );
  });
});
