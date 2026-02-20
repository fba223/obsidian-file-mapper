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
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
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
    cover: "cover"
  },
  syncDuration: 60,
  autoSync: false,
  dateFormat: "YYYY-MM-DD",
  dateIncludeTime: false,
  sizeUnit: "KB",
  enableCover: false,
  coverPath: "cover-images",
  coverSize: 600,
  pathRules: []
};
var FileMapperPlugin = class extends import_obsidian.Plugin {
  constructor() {
    super(...arguments);
    __publicField(this, "settings", DEFAULT_SETTINGS);
    __publicField(this, "syncTimer", 0);
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
      this.syncFiles();
    }, intervalMs);
    this.syncFiles();
  }
  stopSync() {
    if (this.syncTimer) {
      window.clearInterval(this.syncTimer);
      this.syncTimer = 0;
    }
  }
  loadSettings() {
    return __async(this, null, function* () {
      this.settings = __spreadValues(__spreadValues({}, DEFAULT_SETTINGS), yield this.loadData());
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
  syncFiles() {
    return __async(this, null, function* () {
      const { sourcePaths, targetPath, fileExtensions, fieldMappings } = this.settings;
      if (!sourcePaths.length || !targetPath)
        return;
      const extensions = fileExtensions.split(",").map((e) => e.trim().toLowerCase());
      const existingFiles = yield this.getExistingMappedFiles(targetPath);
      const scannedFiles = yield this.scanSourceFiles(sourcePaths, extensions);
      const existingSourcePaths = new Set(existingFiles.map((f) => f.sourcePath));
      const scannedSourcePaths = new Set(scannedFiles.map((f) => f.sourcePath));
      const added = scannedFiles.filter((f) => !existingSourcePaths.has(f.sourcePath));
      const deleted = existingFiles.filter((f) => !scannedSourcePaths.has(f.sourcePath));
      const findSourceBasePath = (filePath, sourcePaths2) => {
        let bestMatch = "";
        let bestMatchLen = 0;
        for (const sp of sourcePaths2) {
          const normalizedSp = sp.replace(/[\/\\]+$/, "");
          const normalizedPath = filePath.replace(/[\/\\]+$/, "");
          const isBoundary = normalizedPath === normalizedSp || normalizedPath.startsWith(normalizedSp + "/") || normalizedPath.startsWith(normalizedSp + "\\");
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
        const coverPath = yield this.generateCover(fileWithUniqueName);
        fileWithUniqueName.coverPath = coverPath || void 0;
        yield this.createMappedFile(targetPath, fileWithUniqueName, fieldMappings);
      }
      const updated = scannedFiles.filter((f) => {
        const existing = existingFiles.find((e) => e.sourcePath === f.sourcePath);
        if (!existing)
          return false;
        return existing.sourceMtime !== f.sourceMtime;
      });
      for (const file of updated) {
        const existing = existingFiles.find((e) => e.sourcePath === file.sourcePath);
        if (existing) {
          const basePath = findSourceBasePath(file.sourcePath, sourcePaths);
          const uniqueName = this.getUniqueFileName(file, basePath);
          const fileWithUniqueName = __spreadProps(__spreadValues({}, file), { name: uniqueName });
          const coverPath = yield this.generateCover(fileWithUniqueName);
          fileWithUniqueName.coverPath = coverPath || void 0;
          yield this.updateMappedFile(targetPath, existing.path, fileWithUniqueName, fieldMappings);
        }
      }
    });
  }
  escapeYaml(str) {
    if (!str)
      return '""';
    if (str.includes('"') || str.includes("\n") || str.includes(":") || str.startsWith(" ")) {
      return `"${str.replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
    }
    return `"${str}"`;
  }
  encodeFileUrl(filePath) {
    return "file://" + encodeURIComponent(filePath);
  }
  extractFrontmatter(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\s*\n?/);
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
  getMostSpecificPathRule(filePath) {
    var _a, _b, _c;
    let bestRule = null;
    let bestScore = -1;
    for (const rule of this.settings.pathRules) {
      const pattern = (_a = rule.pattern) == null ? void 0 : _a.trim();
      if (!pattern)
        continue;
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
    if (!rule || !((_a = rule.frontmatter) == null ? void 0 : _a.trim()))
      return {};
    try {
      const data = (0, import_obsidian.parseYaml)(rule.frontmatter);
      if (data && typeof data === "object" && !Array.isArray(data)) {
        return data;
      }
    } catch (e) {
      console.warn("Failed to parse rule frontmatter YAML:", e);
    }
    return {};
  }
  getUniqueFileName(file, sourceBasePath) {
    const relPath = file.sourcePath.substring(sourceBasePath.length);
    const sanitized = relPath.replace(/[\/\\]/g, "_").replace(/^\s*_\s*/, "").replace(/\s*_\s*$/, "");
    return sanitized || file.name;
  }
  getExistingMappedFiles(targetPath) {
    return __async(this, null, function* () {
      const folder = this.app.vault.getFolderByPath(targetPath);
      if (!folder)
        return [];
      const files = [];
      const processFolder = (f) => __async(this, null, function* () {
        for (const child of f.children) {
          if (child instanceof import_obsidian.TFile && child.extension === "md") {
            try {
              const content = yield this.app.vault.read(child);
              const { frontmatter } = this.extractFrontmatter(content);
              files.push({
                name: child.basename,
                path: child.path,
                sourcePath: frontmatter["source_path"] || "",
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
  scanSourceFiles(sourcePaths, extensions) {
    return __async(this, null, function* () {
      const files = [];
      const fs = this.getFS();
      const path = this.getPath();
      if (!fs || !path) {
        console.error("File system access not available");
        return files;
      }
      for (const sourcePath of sourcePaths) {
        try {
          if (!fs.existsSync(sourcePath)) {
            console.warn(`Source path does not exist: ${sourcePath}`);
            continue;
          }
          const scanDir = (dir) => {
            try {
              const entries = fs.readdirSync(dir, { withFileTypes: true });
              for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                  scanDir(fullPath);
                } else if (entry.isFile()) {
                  const ext = path.extname(entry.name).toLowerCase();
                  if (extensions.includes(ext)) {
                    try {
                      const stat = fs.statSync(fullPath);
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
              }
            } catch (e) {
              console.error(`Error scanning directory ${dir}:`, e);
            }
          };
          scanDir(sourcePath);
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
      if (!folder)
        return;
      const filePath = `${targetPath}/${file.name}.md`;
      try {
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
          const existingContent = yield this.app.vault.read(existing);
          const content = this.generateFileContent(file, fieldMappings, existingContent);
          yield this.app.vault.modify(existing, content);
        } else {
          const content = this.generateFileContent(file, fieldMappings);
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
          const content = this.generateFileContent(file, fieldMappings, existingContent);
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
    const { dateFormat, dateIncludeTime, sizeUnit, enableCover } = this.settings;
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
      fieldMappings.cover,
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
    if (enableCover && file.coverPath) {
      frontmatter[fieldMappings.cover] = file.coverPath;
    } else {
      delete frontmatter[fieldMappings.cover];
    }
    const rule = this.getMostSpecificPathRule(file.sourcePath);
    const ruleFrontmatter = this.parseRuleFrontmatter(rule);
    for (const [key, value] of Object.entries(ruleFrontmatter)) {
      if (pluginFields.has(key))
        continue;
      if (Object.prototype.hasOwnProperty.call(frontmatter, key))
        continue;
      frontmatter[key] = value;
    }
    const yamlBody = (0, import_obsidian.stringifyYaml)(frontmatter).trimEnd();
    const yamlBlock = yamlBody.length > 0 ? yamlBody : "";
    return ["---", yamlBlock, "---", "", body].join("\n");
  }
  generateCover(file) {
    return __async(this, null, function* () {
      if (!this.settings.enableCover) {
        return null;
      }
      const { coverPath, coverSize } = this.settings;
      const ext = file.extension.toLowerCase();
      const supportedExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".mp4", ".mov", ".avi", ".mp3", ".wav", ".docx", ".pptx", ".xlsx"];
      if (!supportedExtensions.includes(ext)) {
        console.log(`Cover: unsupported file type ${ext}`);
        return null;
      }
      try {
        const vault = this.app.vault;
        const coverFolder = vault.getAbstractFileByPath(coverPath);
        if (!coverFolder) {
          yield vault.createFolder(coverPath);
        }
        const cacheKey = this.getCoverCacheKey(file.sourcePath, file.sourceMtime);
        const coverFileName = `${cacheKey}.png`;
        const coverFullPath = `${coverPath}/${coverFileName}`;
        const existingCover = vault.getAbstractFileByPath(coverFullPath);
        if (existingCover) {
          return coverFullPath;
        }
        const fs = require("fs");
        const { execSync } = require("child_process");
        try {
          execSync(`qlmanage -t -s ${coverSize} -o /tmp "${file.sourcePath}"`, { stdio: "ignore" });
          const generatedPng = `${file.sourcePath}.png`;
          if (fs.existsSync(generatedPng)) {
            const coverData = fs.readFileSync(generatedPng);
            const base64Data = coverData.toString("base64");
            yield vault.create(coverFullPath, `data:image/png;base64,${base64Data}`);
            fs.unlinkSync(generatedPng);
            return coverFullPath;
          }
        } catch (e) {
          console.log("qlmanage failed, skipping cover generation");
        }
        return null;
      } catch (e) {
        console.error("Error generating cover:", e);
        return null;
      }
    });
  }
  getCoverCacheKey(filePath, mtime) {
    const crypto = require("crypto");
    return crypto.createHash("md5").update(filePath + mtime).digest("hex").substring(0, 8);
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
    new import_obsidian.Setting(containerEl).setName("Path Rules").setDesc("Add frontmatter based on source path. Most specific rule wins. Fields only fill when missing.").setHeading();
    const rulesContainer = containerEl.createDiv("file-mapper-path-rules");
    this.renderPathRules(rulesContainer);
    new import_obsidian.Setting(containerEl).addButton((button) => button.setButtonText("Add Path Rule").onClick(() => __async(this, null, function* () {
      this.plugin.settings.pathRules.push({ matchType: "prefix", pattern: "", frontmatter: "" });
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
    new import_obsidian.Setting(containerEl).setName("Cover Image").setHeading();
    new import_obsidian.Setting(containerEl).setName("Enable Cover").setDesc("Generate cover images for mapped files").addToggle((toggle) => toggle.setValue(this.plugin.settings.enableCover).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.enableCover = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Cover Path").setDesc("Folder to store cover images").addText((text) => text.setPlaceholder("cover-images").setValue(this.plugin.settings.coverPath).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.coverPath = value;
      yield this.plugin.saveSettings();
    })));
    new import_obsidian.Setting(containerEl).setName("Cover Size").setDesc("Thumbnail size in pixels").addText((text) => text.setPlaceholder("600").setValue(String(this.plugin.settings.coverSize)).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.coverSize = parseInt(value) || 600;
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
      new import_obsidian.Setting(containerEl).setName("Frontmatter (YAML)").setDesc("YAML snippet without --- delimiters. Fields only fill when missing.").addTextArea((text) => text.setPlaceholder("topic: ai\ncategory: papers").setValue(rule.frontmatter).onChange((value) => __async(this, null, function* () {
        rule.frontmatter = value;
        yield this.plugin.saveSettings();
      })));
    });
  }
};
