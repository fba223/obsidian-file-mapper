var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
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
    fileType: "type"
  },
  syncDuration: 60,
  autoSync: false,
  dateFormat: "YYYY-MM-DD",
  dateIncludeTime: false,
  sizeUnit: "KB"
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
      const existingPaths = new Set(existingFiles.map((f) => f.path));
      const scannedPaths = new Set(scannedFiles.map((f) => f.path));
      const added = scannedFiles.filter((f) => !existingPaths.has(f.path));
      const deleted = existingFiles.filter((f) => !scannedPaths.has(f.path));
      for (const file of deleted) {
        yield this.deleteMappedFile(targetPath, file.name);
      }
      for (const file of added) {
        yield this.createMappedFile(targetPath, file, fieldMappings);
      }
      const updated = scannedFiles.filter((f) => {
        const existing = existingFiles.find((e) => e.path === f.path);
        return existing && existing.modified.getTime() !== f.modified.getTime();
      });
      for (const file of updated) {
        yield this.updateMappedFile(targetPath, file, fieldMappings);
      }
    });
  }
  getExistingMappedFiles(targetPath) {
    return __async(this, null, function* () {
      const folder = this.app.vault.getFolderByPath(targetPath);
      if (!folder)
        return [];
      const files = [];
      const processFolder = (f) => {
        for (const child of f.children) {
          if (child instanceof import_obsidian.TFile && child.extension === "md") {
            const stat = child.stat;
            files.push({
              name: child.basename,
              path: child.path,
              size: 0,
              created: new Date(stat.ctime),
              modified: new Date(stat.mtime),
              extension: ".md"
            });
          }
        }
      };
      processFolder(folder);
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
          if (!fs.existsSync(sourcePath))
            continue;
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
                      files.push({
                        name: path.basename(entry.name, ext),
                        path: fullPath,
                        size: stat.size,
                        created: stat.birthtime,
                        modified: stat.mtime,
                        extension: ext
                      });
                    } catch (e) {
                    }
                  }
                }
              }
            } catch (e) {
            }
          };
          scanDir(sourcePath);
        } catch (e) {
          console.error(`Error scanning ${sourcePath}:`, e);
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
      const content = this.generateFileContent(file, fieldMappings);
      const filePath = `${targetPath}/${file.name}.md`;
      try {
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
          yield this.app.vault.modify(existing, content);
        } else {
          yield this.app.vault.create(filePath, content);
        }
      } catch (e) {
        console.error("Error creating mapped file:", e);
      }
    });
  }
  updateMappedFile(targetPath, file, fieldMappings) {
    return __async(this, null, function* () {
      const filePath = `${targetPath}/${file.name}.md`;
      try {
        const existing = this.app.vault.getAbstractFileByPath(filePath);
        if (existing) {
          const content = this.generateFileContent(file, fieldMappings);
          yield this.app.vault.modify(existing, content);
        }
      } catch (e) {
        console.error("Error updating mapped file:", e);
      }
    });
  }
  deleteMappedFile(targetPath, name) {
    return __async(this, null, function* () {
      const filePath = `${targetPath}/${name}.md`;
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
  generateFileContent(file, fieldMappings) {
    const { dateFormat, dateIncludeTime, sizeUnit } = this.settings;
    const lines = ["---"];
    lines.push(`${fieldMappings.fileName}: "${file.name}"`);
    lines.push(`${fieldMappings.filePath}: "${file.path}"`);
    lines.push(`${fieldMappings.fileSize}: ${this.formatSize(file.size, sizeUnit)} ${sizeUnit}`);
    lines.push(`${fieldMappings.createdDate}: ${this.formatDate(file.created, dateFormat, dateIncludeTime)}`);
    lines.push(`${fieldMappings.modifiedDate}: ${this.formatDate(file.modified, dateFormat, dateIncludeTime)}`);
    lines.push(`${fieldMappings.fileType}: "${file.extension}"`);
    lines.push("---");
    lines.push("");
    lines.push(`[${file.name}](file://${file.path.replace(/ /g, "%20")})`);
    return lines.join("\n");
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
    new import_obsidian.Setting(containerEl).setName("Auto Sync").setDesc("Enable automatic file synchronization").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoSync).onChange((value) => __async(this, null, function* () {
      this.plugin.settings.autoSync = value;
      yield this.plugin.saveSettings();
      if (value) {
        this.plugin.startSync();
      } else {
        this.plugin.stopSync();
      }
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
};
