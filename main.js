var __defProp = Object.defineProperty;
var __defProps = Object.defineProperties;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getOwnPropSymbols = Object.getOwnPropertySymbols;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __propIsEnum = Object.prototype.propertyIsEnumerable;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __spreadValues = (a, b) => {
  for (var prop in b || (b = {}))
    if (__hasOwnProp.call(b, prop))
      __defNormalProp(a, prop, b[prop]);
  if (__getOwnPropSymbols)
    for (var prop of __getOwnPropSymbols(b)) {
      if (__propIsEnum.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    }
  return a;
};
var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __async = (__this, __arguments, generator) => {
  return new Promise((resolve, reject) => {
    var fulfilled = (value) => {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    };
    var rejected = (value) => {
      try {
        step(generator.throw(value));
      } catch (e) {
        reject(e);
      }
    };
    var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
    step((generator = generator.apply(__this, __arguments)).next());
  });
};

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => FileMapperPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  sourcePaths: [],
  targetPath: "Mapped Files",
  fileExtensions: ".pdf,.docx,.doc,.mp4,.epub",
  fieldMappings: {
    fileName: "title",
    filePath: "path",
    fileSize: "size",
    createdDate: "created",
    modifiedDate: "modified",
    fileType: "type",
    tags: "tags"
  },
  syncDuration: 60,
  autoSync: false,
  dateFormat: "YYYY-MM-DD",
  dateIncludeTime: false,
  sizeUnit: "KB",
  pathRules: [],
  includeSystemTags: true
};
var FileMapperPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", DEFAULT_SETTINGS);
    __publicField(this, "syncTimer", 0);
    __publicField(this, "isSyncing", false);
    __publicField(this, "tagCache", null);
  }
  onload() {
    return __async(this, null, function* () {
      yield this.loadSettings();
      this.addSettingTab(new FileMapperSettingTab(this.app, this));
      if (this.settings.autoSync) {
        this.startSync();
      }
    });
  }
  onunload() {
    this.stopSync();
  }
  startSync() {
    this.stopSync();
    const intervalMs = this.settings.syncDuration * 60 * 1e3;
    this.syncTimer = window.setInterval(() => {
      if (!this.isSyncing) {
        this.syncFiles();
      }
    }, intervalMs);
    if (!this.isSyncing) {
      this.syncFiles();
    }
  }
  stopSync() {
    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = 0;
    }
  }
  loadSettings() {
    return __async(this, null, function* () {
      const data = yield this.loadData();
      const merged = __spreadValues(__spreadValues({}, DEFAULT_SETTINGS), data);
      merged.fieldMappings = __spreadValues(__spreadValues({}, DEFAULT_SETTINGS.fieldMappings), (data == null ? void 0 : data.fieldMappings) || {});
      merged.pathRules = this.normalizePathRules(data == null ? void 0 : data.pathRules);
      this.settings = merged;
    });
  }
  saveSettings() {
    return __async(this, null, function* () {
      yield this.saveData(this.settings);
    });
  }
  getFS() {
    try {
      if (window.require) {
        return window.require("fs");
      }
    } catch (e) {
    }
    return null;
  }
  getPath() {
    try {
      if (window.require) {
        return window.require("path");
      }
    } catch (e) {
    }
    return null;
  }
  formatDate(date, format, includeTime) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    let result = format.replace("YYYY", String(year)).replace("MM", month).replace("DD", day);
    if (includeTime) {
      result += ` ${hours}:${minutes}:${seconds}`;
    }
    return result;
  }
  formatSize(sizeInBytes, unit) {
    switch (unit) {
      case "GB":
        return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2);
      case "MB":
        return (sizeInBytes / (1024 * 1024)).toFixed(2);
      case "KB":
        return (sizeInBytes / 1024).toFixed(2);
      default:
        return String(sizeInBytes);
    }
  }
  getFileTags(filePath) {
    return __async(this, null, function* () {
      if (this.tagCache?.has(filePath)) {
        return this.tagCache.get(filePath) ?? [];
      }
      try {
        const childProcess = window.require ? window.require("child_process") : null;
        if (!childProcess || !childProcess.execFile) return [];
        const output = yield new Promise((resolve) => {
          childProcess.execFile("mdls", ["-name", "kMDItemUserTags", filePath], { encoding: "utf8" }, (error, stdout) => {
            if (error || !stdout) return resolve("");
            resolve(stdout);
          });
        });
        const match = output.match(/kMDItemUserTags = \(([\s\S]*?)\)/);
        if (match && match[1]) {
          const tags = match[1].split(",").map((t) => t.trim().replace(/"/g, "")).filter((t) => t);
          this.tagCache?.set(filePath, tags);
          return tags;
        }
      } catch (e) {
      }
      this.tagCache?.set(filePath, []);
      return [];
    });
  }
  yieldToEventLoop() {
    return __async(this, null, function* () {
      yield new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
  syncFiles() {
    return __async(this, null, function* () {
      if (this.isSyncing) return;
      this.isSyncing = true;
      this.tagCache = /* @__PURE__ */ new Map();
      try {
        yield this.doSyncFiles();
      } finally {
        this.tagCache = null;
        this.isSyncing = false;
      }
    });
  }
  doSyncFiles() {
    return __async(this, null, function* () {
      const { sourcePaths, targetPath, fileExtensions, fieldMappings } = this.settings;
      if (!sourcePaths.length || !targetPath) return;
      const extensions = fileExtensions.split(",").map((e) => e.trim().toLowerCase());
      const existingFiles = yield this.getExistingMappedFiles(targetPath);
      const scannedFiles = yield this.scanSourceFiles(sourcePaths, extensions);
      const existingSourcePaths = new Set(existingFiles.map((f) => f.sourcePath));
      const scannedSourcePaths = new Set(scannedFiles.map((f) => f.sourcePath));
      const added = scannedFiles.filter((f) => !existingSourcePaths.has(f.sourcePath));
      const deleted = existingFiles.filter((f) => !scannedSourcePaths.has(f.sourcePath));
      const findSourceBasePath = (filePath, sourcePaths2) => {
        const path = this.getPath();
        let bestMatch = "";
        let bestMatchLen = 0;
        for (const sp of sourcePaths2) {
          const normalizedSp = path && path.normalize ? path.normalize(sp.replace(/[\/\\]+$/, "")) : sp.replace(/[\/\\]+$/, "");
          const normalizedPath = path && path.normalize ? path.normalize(filePath.replace(/[\/\\]+$/, "")) : filePath.replace(/[\/\\]+$/, "");
          const isBoundary = path ? (() => {
            const relative = path.relative(normalizedSp, normalizedPath);
            return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
          })() : normalizedPath === normalizedSp || normalizedPath.startsWith(normalizedSp + "/") || normalizedPath.startsWith(normalizedSp + "\\");
          if (isBoundary && normalizedSp.length > bestMatchLen) {
            bestMatch = normalizedSp;
            bestMatchLen = normalizedSp.length;
          }
        }
        return bestMatch || sourcePaths2[0] || "";
      };
      for (const file of deleted) {
        yield this.deleteMappedFile(targetPath, file.path);
      }
      for (const file of added) {
        const basePath = findSourceBasePath(file.sourcePath, sourcePaths);
        const uniqueName = this.getUniqueFileName(file, basePath);
        const fileWithUniqueName = __spreadProps(__spreadValues({}, file), { name: uniqueName });
        yield this.createMappedFile(targetPath, fileWithUniqueName, fieldMappings);
      }
      const updated = scannedFiles.filter((f) => {
        const existing = existingFiles.find((e) => e.sourcePath === f.sourcePath);
        if (!existing) return false;
        return existing.sourceMtime !== f.sourceMtime;
      });
      for (const file of updated) {
        const existing = existingFiles.find((e) => e.sourcePath === file.sourcePath);
        if (existing) {
          const basePath = findSourceBasePath(file.sourcePath, sourcePaths);
          const uniqueName = this.getUniqueFileName(file, basePath);
          const fileWithUniqueName = __spreadProps(__spreadValues({}, file), { name: uniqueName });
          yield this.updateMappedFile(targetPath, existing.path, fileWithUniqueName, fieldMappings);
        }
      }
    });
  }
  escapeYaml(str) {
    if (!str) return '""';
    if (str.includes('"') || str.includes("\n") || str.includes(":") || str.startsWith(" ")) {
      return `"${str.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return `"${str}"`;
  }
  encodeFileUrl(filePath) {
    try {
      const url = window.require ? window.require("url") : null;
      if (url?.pathToFileURL) {
        return url.pathToFileURL(filePath).href;
      }
    } catch (e) {
    }
    return "file://" + encodeURI(filePath);
  }
  extractFrontmatter(content) {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }
    let parsed = {};
    try {
      const data = (0, import_obsidian.parseYaml)(match[1]);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        parsed = data;
      }
    } catch (e) {
      parsed = this.parseFrontmatterFallback(match[1]);
    }
    const body = content.slice(match[0].length);
    return { frontmatter: parsed, body };
  }
  parseFrontmatterFallback(block) {
    const result = {};
    const lines = block.split("\n");
    for (const line of lines) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim();
        let value = line.substring(colonIdx + 1).trim();
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
    }
    return result;
  }
  normalizePathForMatch(input) {
    return input.replace(/[\\/]+$/, "");
  }
  getDefaultPropertyValue(type) {
    switch (type) {
      case "number":
        return "0";
      case "boolean":
        return "true";
      case "list":
        return "";
      case "json":
        return "{}";
      case "string":
      default:
        return "";
    }
  }
  inferPropertyType(value) {
    if (Array.isArray(value)) return "list";
    if (typeof value === "boolean") return "boolean";
    if (typeof value === "number") return "number";
    if (value && typeof value === "object") return "json";
    return "string";
  }
  normalizePathRules(rules) {
    if (!Array.isArray(rules)) return [];
    const normalized = [];
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") continue;
      const matchType = rule.matchType === "regex" ? "regex" : "prefix";
      const pattern = typeof rule.pattern === "string" ? rule.pattern : "";
      if (Array.isArray(rule.properties)) {
        const properties = rule.properties.filter((prop) => prop && typeof prop === "object").map((prop) => {
          const propType = ["string", "number", "boolean", "list", "json"].includes(prop.type) ? prop.type : "string";
          return {
            key: typeof prop.key === "string" ? prop.key : "",
            type: propType,
            value: typeof prop.value === "string" ? prop.value : this.getDefaultPropertyValue(propType)
          };
        });
        normalized.push({ matchType, pattern, properties });
        continue;
      }
      if (typeof rule.frontmatter === "string" && rule.frontmatter.trim()) {
        let parsed = {};
        try {
          const data = (0, import_obsidian.parseYaml)(rule.frontmatter);
          if (data && typeof data === "object" && !Array.isArray(data)) {
            parsed = data;
          }
        } catch (e) {
          console.warn("Failed to parse legacy rule frontmatter YAML:", e);
        }
        const properties = Object.entries(parsed).map(([key, value]) => {
          const type = this.inferPropertyType(value);
          let valueString = "";
          if (type === "list") {
            valueString = Array.isArray(value) ? value.join(", ") : "";
          } else if (type === "json") {
            try {
              valueString = JSON.stringify(value);
            } catch (e) {
              valueString = String(value);
            }
          } else {
            valueString = String(value);
          }
          return { key, type, value: valueString };
        });
        normalized.push({ matchType, pattern, properties });
        continue;
      }
      normalized.push({ matchType, pattern, properties: [] });
    }
    return normalized;
  }
  getMostSpecificPathRule(filePath) {
    var _a, _b, _c;
    let bestRule = null;
    let bestScore = -1;
    for (const rule of this.settings.pathRules) {
      const pattern = (_a = rule.pattern) == null ? void 0 : _a.trim();
      if (!pattern) continue;
      if (rule.matchType === "prefix") {
        const normalizedPattern = this.normalizePathForMatch(pattern);
        const normalizedPath = this.normalizePathForMatch(filePath);
        const isBoundary = normalizedPath === normalizedPattern || normalizedPath.startsWith(normalizedPattern + "/") || normalizedPath.startsWith(normalizedPattern + "\\");
        if (isBoundary) {
          const score = normalizedPattern.length;
          if (score > bestScore) {
            bestScore = score;
            bestRule = rule;
          }
        }
      } else if (rule.matchType === "regex") {
        try {
          const regex = new RegExp(pattern);
          const match = filePath.match(regex);
          if (match) {
            const score = (_c = (_b = match[0]) == null ? void 0 : _b.length) != null ? _c : 0;
            if (score > bestScore) {
              bestScore = score;
              bestRule = rule;
            }
          }
        } catch (e) {
          console.warn(`Invalid regex pattern in path rule: ${pattern}`, e);
        }
      }
    }
    return bestRule;
  }
  parseRuleFrontmatter(rule) {
    var _a;
    if (!rule || !Array.isArray(rule.properties)) return {};
    const result = {};
    for (const prop of rule.properties) {
      const key = (_a = prop.key) == null ? void 0 : _a.trim();
      if (!key) continue;
      const value = this.coerceRulePropertyValue(prop.type, prop.value);
      result[key] = value;
    }
    return result;
  }
  coerceRulePropertyValue(type, raw) {
    switch (type) {
      case "number": {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : raw;
      }
      case "boolean": {
        const normalized = raw.trim().toLowerCase();
        return ["true", "1", "yes", "y"].includes(normalized);
      }
      case "list": {
        if (!raw.trim()) return [];
        return raw.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
      }
      case "json": {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return raw;
        }
      }
      case "string":
      default:
        return raw;
    }
  }
  getUniqueFileName(file, sourceBasePath) {
    const path = this.getPath();
    let relPath = "";
    if (path) {
      try {
        const normalizedBase = path.resolve(sourceBasePath);
        const normalizedFile = path.resolve(file.sourcePath);
        const candidate = path.relative(normalizedBase, normalizedFile);
        if (candidate === "" || !candidate.startsWith("..") && !path.isAbsolute(candidate)) {
          relPath = candidate;
        }
      } catch (e) {
        relPath = "";
      }
    }
    if (!relPath) {
      const fallback = file.sourcePath.substring(sourceBasePath.length);
      relPath = fallback || file.name;
    }
    relPath = relPath.replace(/^[\/\\]+/, "");
    const withoutExt = relPath.replace(/\.[^.]+$/, "");
    const sanitized = withoutExt.replace(/[\/\\]/g, "_").replace(/^\s*_\s*/, "").replace(/\s*_\s*$/, "");
    return sanitized || file.name;
  }
  getExistingMappedFiles(targetPath) {
    return __async(this, null, function* () {
      const folder = this.app.vault.getFolderByPath(targetPath);
      if (!folder) return [];
      const files = [];
      const processFolder = (f) => __async(this, null, function* () {
        for (const child of f.children) {
          if (child instanceof import_obsidian.TFile && child.extension === "md") {
            try {
              const content = yield this.app.vault.read(child);
              const { frontmatter } = this.extractFrontmatter(content);
              const mappedPathField = this.settings.fieldMappings.filePath;
              const sourcePath = frontmatter["source_path"] || (mappedPathField ? frontmatter[mappedPathField] : "") || frontmatter["path"] || "";
              files.push({
                name: child.basename,
                path: child.path,
                sourcePath,
                sourceMtime: parseFloat(frontmatter["source_mtime"]) || 0,
                size: 0,
                created: new Date(child.stat.ctime),
                modified: new Date(child.stat.mtime),
                extension: ".md"
              });
            } catch (e) {
              console.error(`Error reading mapped file ${child.path}:`, e);
            }
          }
        }
      });
      yield processFolder(folder);
      return files;
    });
  }
  parseFrontmatter(content) {
    return this.extractFrontmatter(content).frontmatter;
  }
  scanSourceFiles(sourcePaths, extensions) {
    return __async(this, null, function* () {
      const files = [];
      const fs = this.getFS();
      const path = this.getPath();
      if (!fs || !path || !fs.promises) {
        console.error("File system access not available");
        return files;
      }
      const yieldEvery = 200;
      let processed = 0;
      for (const sourcePath of sourcePaths) {
        try {
          try {
            yield fs.promises.access(sourcePath);
          } catch {
            console.warn(`Source path does not exist: ${sourcePath}`);
            continue;
          }
          const dirQueue = [sourcePath];
          while (dirQueue.length > 0) {
            const dir = dirQueue.pop();
            let entries = [];
            try {
              entries = yield fs.promises.readdir(dir, { withFileTypes: true });
            } catch (e) {
              console.error(`Error scanning directory ${dir}:`, e);
              continue;
            }
            for (const entry of entries) {
              const fullPath = path.join(dir, entry.name);
              if (entry.isDirectory()) {
                dirQueue.push(fullPath);
              } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (extensions.includes(ext)) {
                  try {
                    const stat = yield fs.promises.stat(fullPath);
                    const baseName = path.basename(entry.name, ext);
                    files.push({
                      name: baseName,
                      path: fullPath,
                      sourcePath: fullPath,
                      sourceMtime: stat.mtimeMs,
                      size: stat.size,
                      created: stat.birthtime,
                      modified: stat.mtime,
                      extension: ext
                    });
                  } catch (e) {
                    console.error(`Error stating file ${fullPath}:`, e);
                  }
                }
              }
              processed += 1;
              if (processed >= yieldEvery) {
                processed = 0;
                yield this.yieldToEventLoop();
              }
            }
          }
        } catch (e) {
          console.error(`Error scanning source path ${sourcePath}:`, e);
        }
      }
      return files;
    });
  }
  ensureTargetFolderByPath(targetPath) {
    return __async(this, null, function* () {
      try {
        let folder = this.app.vault.getFolderByPath(targetPath);
        if (!folder) {
          folder = yield this.app.vault.createFolder(targetPath);
        }
        return folder;
      } catch (e) {
        console.error("Error creating target folder:", e);
        return null;
      }
    });
  }
  createMappedFile(targetPath, file, fieldMappings) {
    return __async(this, null, function* () {
      const folder = yield this.ensureTargetFolderByPath(targetPath);
      if (!folder) return;
      const filePath = `${targetPath}/${file.name}.md`;
      try {
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
          const existingContent = yield this.app.vault.read(existing);
          const content = yield this.generateFileContent(file, fieldMappings, existingContent);
          yield this.app.vault.modify(existing, content);
        } else {
          const content = yield this.generateFileContent(file, fieldMappings);
          yield this.app.vault.create(filePath, content);
        }
      } catch (e) {
        console.error("Error creating mapped file:", e);
      }
    });
  }
  updateMappedFile(targetPath, existingFilePath, file, fieldMappings) {
    return __async(this, null, function* () {
      try {
        const existing = this.app.vault.getAbstractFileByPath(existingFilePath);
        if (existing) {
          const existingContent = yield this.app.vault.read(existing);
          const content = yield this.generateFileContent(file, fieldMappings, existingContent);
          yield this.app.vault.modify(existing, content);
        }
      } catch (e) {
        console.error("Error updating mapped file:", e);
      }
    });
  }
  deleteMappedFile(targetPath, filePath) {
    return __async(this, null, function* () {
      try {
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
          yield this.app.vault.delete(existing);
        }
      } catch (e) {
        console.error("Error deleting mapped file:", e);
      }
    });
  }
  generateFileContent(file, fieldMappings, existingContent) {
    return __async(this, null, function* () {
      const { dateFormat, dateIncludeTime, sizeUnit, includeSystemTags } = this.settings;
      const existing = existingContent ? this.extractFrontmatter(existingContent) : { frontmatter: {}, body: "" };
      const frontmatter = __spreadValues({}, existing.frontmatter);
      const body = existingContent ? existing.body : `[${file.name}](${this.encodeFileUrl(file.sourcePath)})`;
      const pluginFields = /* @__PURE__ */ new Set([
        fieldMappings.fileName,
        fieldMappings.filePath,
        fieldMappings.fileSize,
        fieldMappings.createdDate,
        fieldMappings.modifiedDate,
        fieldMappings.fileType,
        fieldMappings.tags,
        "source_path",
        "source_mtime"
      ]);
      frontmatter[fieldMappings.fileName] = file.name;
      frontmatter[fieldMappings.filePath] = file.sourcePath;
      frontmatter["source_path"] = file.sourcePath;
      frontmatter["source_mtime"] = file.sourceMtime;
      frontmatter[fieldMappings.fileSize] = `${this.formatSize(file.size, sizeUnit)} ${sizeUnit}`;
      frontmatter[fieldMappings.createdDate] = this.formatDate(file.created, dateFormat, dateIncludeTime);
      frontmatter[fieldMappings.modifiedDate] = this.formatDate(file.modified, dateFormat, dateIncludeTime);
      frontmatter[fieldMappings.fileType] = file.extension;
      if (includeSystemTags) {
        const systemTags = yield this.getFileTags(file.sourcePath);
        if (systemTags.length > 0) {
          const existingTags = frontmatter[fieldMappings.tags];
          let mergedTags = [];
          if (Array.isArray(existingTags)) {
            mergedTags = [...existingTags, ...systemTags];
          } else if (typeof existingTags === "string" && existingTags) {
            mergedTags = [existingTags, ...systemTags];
          } else {
            mergedTags = [...systemTags];
          }
          frontmatter[fieldMappings.tags] = [...new Set(mergedTags)];
        }
      }
      const rule = this.getMostSpecificPathRule(file.sourcePath);
      const ruleFrontmatter = this.parseRuleFrontmatter(rule);
      for (const [key, value] of Object.entries(ruleFrontmatter)) {
        if (pluginFields.has(key)) continue;
        if (Object.prototype.hasOwnProperty.call(frontmatter, key)) continue;
        frontmatter[key] = value;
      }
      const yamlBody = (0, import_obsidian.stringifyYaml)(frontmatter).trimEnd();
      const yamlBlock = yamlBody.length > 0 ? yamlBody : "";
      return ["---", yamlBlock, "---", "", body].join("\n");
    });
  }
};
var FileMapperSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    __publicField(this, "plugin");
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    new import_obsidian.Setting(containerEl).setName("Auto Sync").setDesc("Enable automatic file synchronization").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSync).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.autoSync = value;
      yield this.plugin.saveSettings();
      if (value) {
        this.plugin.startSync();
      } else {
        this.plugin.stopSync();
      }
    })));
    new import_obsidian.Setting(containerEl).setName("Source Paths (Multiple)").setDesc("Add multiple paths, one per line. Files from all paths will be mapped.").addTextArea((text) => text.setPlaceholder("/path/to/documents\n/other/path").setValue(this.plugin.settings.sourcePaths.join("\n")).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.sourcePaths = value.split("\n").map((p) => p.trim()).filter((p) => p);
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Target Path").setDesc("Path in Obsidian vault where mapped files will be created").addText((text) => text.setPlaceholder("Mapped Files").setValue(this.plugin.settings.targetPath).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.targetPath = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("File Extensions").setDesc("Comma-separated list of file extensions to map (e.g., .pdf,.docx,.mp4)").addText((text) => text.setPlaceholder(".pdf,.docx,.doc").setValue(this.plugin.settings.fileExtensions).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fileExtensions = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Sync Duration (minutes)").setDesc("How often to sync in minutes").addText((text) => text.setPlaceholder("60").setValue(String(this.plugin.settings.syncDuration)).onChange((value) => __async(this, null, function* () {
      const num = parseInt(value, 10);
      this.plugin.settings.syncDuration = isNaN(num) || num < 1 ? 60 : Math.min(num, 1440);
      yield this.plugin.saveSettings();
      if (this.plugin.settings.autoSync) {
        this.plugin.startSync();
      }
    })));
    new import_obsidian.Setting(containerEl).setName("YAML Field Mappings").setHeading();
    const { fieldMappings } = this.plugin.settings;
    new import_obsidian.Setting(containerEl).setName("File Name Field").addText((text) => text.setPlaceholder("title").setValue(fieldMappings.fileName).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.fileName = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("File Path Field").addText((text) => text.setPlaceholder("path").setValue(fieldMappings.filePath).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.filePath = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("File Size Field").addText((text) => text.setPlaceholder("size").setValue(fieldMappings.fileSize).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.fileSize = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Created Date Field").addText((text) => text.setPlaceholder("created").setValue(fieldMappings.createdDate).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.createdDate = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Modified Date Field").addText((text) => text.setPlaceholder("modified").setValue(fieldMappings.modifiedDate).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.modifiedDate = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("File Type Field").addText((text) => text.setPlaceholder("type").setValue(fieldMappings.fileType).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.fileType = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Tags Field").setDesc("Field name for system tags in frontmatter").addText((text) => text.setPlaceholder("tags").setValue(fieldMappings.tags).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.fieldMappings.tags = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Include System Tags").setDesc("Read macOS Finder tags from source files and add to frontmatter").addToggle((toggle) => toggle.setValue(this.plugin.settings.includeSystemTags).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.includeSystemTags = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Path Rules").setDesc("Add frontmatter based on source path. Most specific rule wins. Fields only fill when missing.").setHeading();
    const rulesContainer = containerEl.createDiv("file-mapper-path-rules");
    this.renderPathRules(rulesContainer);
    new import_obsidian.Setting(containerEl).addButton((button) => button.setButtonText("Add Path Rule").onClick(() => __async(this, null, function* () {
      this.plugin.settings.pathRules.push({ matchType: "prefix", pattern: "", properties: [] });
      yield this.plugin.saveSettings();
      this.display();
    })));
    new import_obsidian.Setting(containerEl).setName("Date & Time Format").setHeading();
    new import_obsidian.Setting(containerEl).setName("Date Format").setDesc("Format: YYYY-MM-DD, DD/MM/YYYY, etc.").addText((text) => text.setPlaceholder("YYYY-MM-DD").setValue(this.plugin.settings.dateFormat).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.dateFormat = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Include Time").setDesc("Include time in date fields").addToggle((toggle) => toggle.setValue(this.plugin.settings.dateIncludeTime).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.dateIncludeTime = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Size Unit").setDesc("Unit for file size display").addDropdown((dropdown) => dropdown.addOption("bytes", "Bytes").addOption("KB", "KB").addOption("MB", "MB").addOption("GB", "GB").setValue(this.plugin.settings.sizeUnit).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.sizeUnit = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).addButton((button) => button.setButtonText("Sync Now").onClick(() => __async(this, null, function* () {
      yield this.plugin.syncFiles();
    })));
  }
  renderPathRules(containerEl) {
    containerEl.empty();
    this.plugin.settings.pathRules.forEach((rule, index) => {
      new import_obsidian.Setting(containerEl).setName(`Rule ${index + 1}`).setDesc("Most specific rule wins (longest match).").addExtraButton((button) => button.setIcon("trash").setTooltip("Delete rule").onClick(() => __async(this, null, function* () {
        this.plugin.settings.pathRules.splice(index, 1);
        yield this.plugin.saveSettings();
        this.display();
      })));
      new import_obsidian.Setting(containerEl).setName("Match Type").addDropdown((dropdown) => dropdown.addOption("prefix", "Prefix").addOption("regex", "Regex").setValue(rule.matchType).onChange((value) => __async(this, null, function* () {
        rule.matchType = value;
        yield this.plugin.saveSettings();
      })));
      new import_obsidian.Setting(containerEl).setName("Pattern").setDesc("Prefix path or regex pattern.").addText((text) => text.setPlaceholder("/path/to/folder").setValue(rule.pattern).onChange((value) => __async(this, null, function* () {
        rule.pattern = value;
        yield this.plugin.saveSettings();
      })));
      const propertiesContainer = containerEl.createDiv("file-mapper-rule-properties");
      this.renderRuleProperties(propertiesContainer, rule);
    });
  }
  renderRuleProperties(containerEl, rule) {
    containerEl.empty();
    rule.properties.forEach((prop, index) => {
      new import_obsidian.Setting(containerEl).setName(`Property ${index + 1}`).addText((text) => text.setPlaceholder("property").setValue(prop.key).onChange((value) => __async(this, null, function* () {
        prop.key = value;
        yield this.plugin.saveSettings();
      }))).addDropdown((dropdown) => dropdown.addOption("string", "string").addOption("number", "number").addOption("boolean", "boolean").addOption("list", "list").addOption("json", "json").setValue(prop.type).onChange((value) => __async(this, null, function* () {
        const previousType = prop.type;
        prop.type = value;
        if (!prop.value || prop.value === this.getDefaultPropertyValue(previousType)) {
          prop.value = this.getDefaultPropertyValue(prop.type);
        }
        yield this.plugin.saveSettings();
        this.display();
      }))).addText((text) => text.setPlaceholder(this.getPropertyValuePlaceholder(prop.type)).setValue(prop.value).onChange((value) => __async(this, null, function* () {
        prop.value = value;
        yield this.plugin.saveSettings();
      }))).addExtraButton((button) => button.setIcon("trash").setTooltip("Delete property").onClick(() => __async(this, null, function* () {
        rule.properties.splice(index, 1);
        yield this.plugin.saveSettings();
        this.display();
      })));
    });
    new import_obsidian.Setting(containerEl).addButton((button) => button.setButtonText("Add Property").onClick(() => __async(this, null, function* () {
      rule.properties.push({ key: "", type: "string", value: this.getDefaultPropertyValue("string") });
      yield this.plugin.saveSettings();
      this.display();
    })));
  }
  getDefaultPropertyValue(type) {
    switch (type) {
      case "number":
        return "0";
      case "boolean":
        return "true";
      case "list":
        return "";
      case "json":
        return "{}";
      case "string":
      default:
        return "";
    }
  }
  getPropertyValuePlaceholder(type) {
    switch (type) {
      case "number":
        return "0";
      case "boolean":
        return "true";
      case "list":
        return "item1, item2";
      case "json":
        return '{"key":"value"}';
      case "string":
      default:
        return "value";
    }
  }
};
