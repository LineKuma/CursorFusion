const fs = require("fs");
const path = require("path");

class FileUtils {
  /**
   * 递归读取目录下所有文件
   */
  async walk(dir, options = {}) {
    const { extensions, ignorePatterns = [], maxDepth = 10 } = options;
    const results = [];

    const walkInternal = async (currentDir, depth) => {
      if (depth > maxDepth) return;

      let entries;
      try {
        entries = await fs.promises.readdir(currentDir, {
          withFileTypes: true,
        });
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        // 检查忽略模式
        if (ignorePatterns.some((pattern) => fullPath.includes(pattern)))
          continue;

        if (entry.isDirectory()) {
          await walkInternal(fullPath, depth + 1);
        } else if (entry.isFile()) {
          if (extensions && !extensions.includes(path.extname(entry.name)))
            continue;
          results.push(fullPath);
        }
      }
    };

    await walkInternal(dir, 0);
    return results;
  }

  /**
   * 确保目录存在（递归创建）
   */
  ensureDir(dirPath) {
    return fs.promises.mkdir(dirPath, { recursive: true });
  }

  /**
   * 安全写入文件（自动创建目录）
   */
  async writeFile(filePath, content, options = {}) {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);

    if (options.backup && fs.existsSync(filePath)) {
      await fs.promises.copyFile(filePath, filePath + ".bak");
    }

    await fs.promises.writeFile(
      filePath,
      typeof content === "string" ? content : JSON.stringify(content, null, 2),
      options.encoding || "utf-8",
    );
  }

  /**
   * 读取 JSON 文件
   */
  readJson(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content);
  }

  /**
   * 复制目录
   */
  async copyDir(src, dest) {
    await this.ensureDir(dest);
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDir(srcPath, destPath);
      } else {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * 清空目录内容
   */
  async cleanDir(dirPath) {
    if (!fs.existsSync(dirPath)) return;

    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        await fs.promises.rm(fullPath, { recursive: true, force: true });
      } else {
        await fs.promises.unlink(fullPath);
      }
    }
  }

  /**
   * 检测文件类型
   */
  detectType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const types = {
      ".js": "javascript",
      ".ts": "typescript",
      ".jsx": "jsx",
      ".tsx": "tsx",
      ".json": "json",
      ".md": "markdown",
      ".yml": "yaml",
      ".yaml": "yaml",
      ".html": "html",
      ".css": "css",
      ".py": "python",
      ".go": "go",
      ".rs": "rust",
    };
    return types[ext] || "unknown";
  }
}

module.exports = { FileUtils };
