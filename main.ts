import { App, Plugin, PluginSettingTab, Setting, TFolder, TFile, Vault } from 'obsidian';

interface FileMapperSettings {
  sourcePaths: string[];
  targetPath: string;
  fileExtensions: string;
  fieldMappings: {
    fileName: string;
    filePath: string;
    fileSize: string;
    createdDate: string;
    modifiedDate: string;
    fileType: string;
  };
  autoSync: boolean;
  syncDuration: number;
  dateFormat: string;
  dateIncludeTime: boolean;
  sizeUnit: string;
}

interface SourceFile {
  name: string;
  path: string;
  sourcePath: string;
  sourceMtime: number;
  size: number;
  created: Date;
  modified: Date;
  extension: string;
}

const DEFAULT_SETTINGS: FileMapperSettings = {
  sourcePaths: [],
  targetPath: 'Mapped Files',
  fileExtensions: '.pdf,.docx,.doc,.mp4,.epub',
  fieldMappings: {
    fileName: 'title',
    filePath: 'path',
    fileSize: 'size',
    createdDate: 'created',
    modifiedDate: 'modified',
    fileType: 'type'
  },
  syncDuration: 60,
  autoSync: false,
  dateFormat: 'YYYY-MM-DD',
  dateIncludeTime: false,
  sizeUnit: 'KB'
};

declare global {
  interface Window {
    require: any;
    process: any;
  }
}

export default class FileMapperPlugin extends Plugin {
  settings: FileMapperSettings = DEFAULT_SETTINGS;
  private syncTimer: number = 0;

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new FileMapperSettingTab(this.app, this));
    
    if (this.settings.autoSync) {
      this.startSync();
    }
  }

  onunload() {
    this.stopSync();
  }

  startSync() {
    this.stopSync();
    const intervalMs = this.settings.syncDuration * 60 * 1000;
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

  async loadSettings() {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private getFS() {
    try {
      if (window.require) {
        return window.require('fs');
      }
    } catch (e) {}
    return null;
  }

  private getPath() {
    try {
      if (window.require) {
        return window.require('path');
      }
    } catch (e) {}
    return null;
  }

  private formatDate(date: Date, format: string, includeTime: boolean): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    let result = format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
    
    if (includeTime) {
      result += ` ${hours}:${minutes}:${seconds}`;
    }
    
    return result;
  }

  private formatSize(sizeInBytes: number, unit: string): string {
    switch(unit) {
      case 'GB':
        return (sizeInBytes / (1024 * 1024 * 1024)).toFixed(2);
      case 'MB':
        return (sizeInBytes / (1024 * 1024)).toFixed(2);
      case 'KB':
        return (sizeInBytes / 1024).toFixed(2);
      default:
        return String(sizeInBytes);
    }
  }

  async syncFiles() {
    const { sourcePaths, targetPath, fileExtensions, fieldMappings } = this.settings;
    if (!sourcePaths.length || !targetPath) return;

    const extensions = fileExtensions.split(',').map(e => e.trim().toLowerCase());
    const existingFiles = await this.getExistingMappedFiles(targetPath);
    const scannedFiles = await this.scanSourceFiles(sourcePaths, extensions);
    
    const existingSourcePaths = new Set(existingFiles.map(f => f.sourcePath));
    const scannedSourcePaths = new Set(scannedFiles.map(f => f.sourcePath));
    
    const added = scannedFiles.filter(f => !existingSourcePaths.has(f.sourcePath));
    const deleted = existingFiles.filter(f => !scannedSourcePaths.has(f.sourcePath));
    
    const findSourceBasePath = (filePath: string, sourcePaths: string[]): string => {
      let bestMatch = '';
      let bestMatchLen = 0;
      for (const sp of sourcePaths) {
        const normalizedSp = sp.replace(/[\/\\]+$/, '');
        const normalizedPath = filePath.replace(/[\/\\]+$/, '');
        const isBoundary = normalizedPath === normalizedSp || 
                          normalizedPath.startsWith(normalizedSp + '/') || 
                          normalizedPath.startsWith(normalizedSp + '\\');
        if (isBoundary && normalizedSp.length > bestMatchLen) {
          bestMatch = normalizedSp;
          bestMatchLen = normalizedSp.length;
        }
      }
      return bestMatch || sourcePaths[0] || '';
    };
    
    for (const file of deleted) {
      await this.deleteMappedFile(targetPath, file.path);
    }
    
    for (const file of added) {
      const basePath = findSourceBasePath(file.sourcePath, sourcePaths);
      const uniqueName = this.getUniqueFileName(file, basePath);
      const fileWithUniqueName = { ...file, name: uniqueName };
      await this.createMappedFile(targetPath, fileWithUniqueName, fieldMappings);
    }
    
    const updated = scannedFiles.filter(f => {
      const existing = existingFiles.find(e => e.sourcePath === f.sourcePath);
      if (!existing) return false;
      return existing.sourceMtime !== f.sourceMtime;
    });
    
    for (const file of updated) {
      const existing = existingFiles.find(e => e.sourcePath === file.sourcePath);
      if (existing) {
        const basePath = findSourceBasePath(file.sourcePath, sourcePaths);
        const uniqueName = this.getUniqueFileName(file, basePath);
        const fileWithUniqueName = { ...file, name: uniqueName };
        await this.updateMappedFile(targetPath, existing.path, fileWithUniqueName, fieldMappings);
      }
    }
  }

  private escapeYaml(str: string): string {
    if (!str) return '""';
    if (str.includes('"') || str.includes('\n') || str.includes(':') || str.startsWith(' ')) {
      return `"${str.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;
    }
    return `"${str}"`;
  }

  private encodeFileUrl(filePath: string): string {
    return 'file://' + encodeURIComponent(filePath);
  }

  private getUniqueFileName(file: SourceFile, sourceBasePath: string): string {
    const relPath = file.sourcePath.substring(sourceBasePath.length);
    const sanitized = relPath.replace(/[\/\\]/g, '_').replace(/^\s*_\s*/, '').replace(/\s*_\s*$/, '');
    return sanitized || file.name;
  }

  async getExistingMappedFiles(targetPath: string): Promise<SourceFile[]> {
    const folder = this.app.vault.getFolderByPath(targetPath);
    if (!folder) return [];
    
    const files: SourceFile[] = [];
    const processFolder = async (f: TFolder) => {
      for (const child of f.children) {
        if (child instanceof TFile && child.extension === 'md') {
          try {
            const content = await this.app.vault.read(child);
            const frontmatter = this.parseFrontmatter(content);
            
            files.push({
              name: child.basename,
              path: child.path,
            sourcePath: frontmatter['source_path'] || '',
            sourceMtime: parseFloat(frontmatter['source_mtime']) || 0,
              size: 0,
              created: new Date(child.stat.ctime),
              modified: new Date(child.stat.mtime),
              extension: '.md'
            });
          } catch (e) {
            console.error(`Error reading mapped file ${child.path}:`, e);
          }
        }
      }
    };
    await processFolder(folder);
    return files;
  }

  private parseFrontmatter(content: string): Record<string, any> {
    const result: Record<string, any> = {};
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) return result;
    
    const lines = match[1].split('\n');
    for (const line of lines) {
      const colonIdx = line.indexOf(':');
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

  async scanSourceFiles(sourcePaths: string[], extensions: string[]): Promise<SourceFile[]> {
    const files: SourceFile[] = [];
    const fs = this.getFS();
    const path = this.getPath();
    
    if (!fs || !path) {
      console.error('File system access not available');
      return files;
    }
    
    for (const sourcePath of sourcePaths) {
      try {
        if (!fs.existsSync(sourcePath)) {
          console.warn(`Source path does not exist: ${sourcePath}`);
          continue;
        }
        
        const scanDir = (dir: string) => {
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
  }

  async ensureTargetFolderByPath(targetPath: string): Promise<TFolder | null> {
    try {
      let folder = this.app.vault.getFolderByPath(targetPath);
      if (!folder) {
        folder = await this.app.vault.createFolder(targetPath);
      }
      return folder;
    } catch (e) {
      console.error('Error creating target folder:', e);
      return null;
    }
  }

  async createMappedFile(targetPath: string, file: SourceFile, fieldMappings: FileMapperSettings['fieldMappings']) {
    const folder = await this.ensureTargetFolderByPath(targetPath);
    if (!folder) return;
    
    const content = this.generateFileContent(file, fieldMappings);
    const filePath = `${targetPath}/${file.name}.md`;
    
    try {
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (existing) {
        await this.app.vault.modify(existing as TFile, content);
      } else {
        await this.app.vault.create(filePath, content);
      }
    } catch (e) {
      console.error('Error creating mapped file:', e);
    }
  }

  async updateMappedFile(targetPath: string, existingFilePath: string, file: SourceFile, fieldMappings: FileMapperSettings['fieldMappings']) {
    try {
      const existing = this.app.vault.getAbstractFileByPath(existingFilePath);
      if (existing) {
        const content = this.generateFileContent(file, fieldMappings);
        await this.app.vault.modify(existing as TFile, content);
      }
    } catch (e) {
      console.error('Error updating mapped file:', e);
    }
  }

  async deleteMappedFile(targetPath: string, filePath: string) {
    try {
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (existing) {
        await this.app.vault.delete(existing);
      }
    } catch (e) {
      console.error('Error deleting mapped file:', e);
    }
  }

  generateFileContent(file: SourceFile, fieldMappings: FileMapperSettings['fieldMappings']): string {
    const { dateFormat, dateIncludeTime, sizeUnit } = this.settings;
    
    const lines = ['---'];
    lines.push(`${fieldMappings.fileName}: ${this.escapeYaml(file.name)}`);
    lines.push(`${fieldMappings.filePath}: ${this.escapeYaml(file.sourcePath)}`);
    lines.push(`source_path: ${this.escapeYaml(file.sourcePath)}`);
    lines.push(`source_mtime: ${file.sourceMtime}`);
    lines.push(`${fieldMappings.fileSize}: ${this.formatSize(file.size, sizeUnit)} ${sizeUnit}`);
    lines.push(`${fieldMappings.createdDate}: ${this.formatDate(file.created, dateFormat, dateIncludeTime)}`);
    lines.push(`${fieldMappings.modifiedDate}: ${this.formatDate(file.modified, dateFormat, dateIncludeTime)}`);
    lines.push(`${fieldMappings.fileType}: ${this.escapeYaml(file.extension)}`);
    lines.push('---');
    lines.push('');
    lines.push(`[${file.name}](${this.encodeFileUrl(file.sourcePath)})`);
    return lines.join('\n');
  }
}

class FileMapperSettingTab extends PluginSettingTab {
  plugin: FileMapperPlugin;

  constructor(app: App, plugin: FileMapperPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    
    new Setting(containerEl)
      .setName('Auto Sync')
      .setDesc('Enable automatic file synchronization')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.autoSync)
        .onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
          if (value) {
            this.plugin.startSync();
          } else {
            this.plugin.stopSync();
          }
        }));
    
    new Setting(containerEl)
      .setName('Source Paths (Multiple)')
      .setDesc('Add multiple paths, one per line. Files from all paths will be mapped.')
      .addTextArea(text => text
        .setPlaceholder('/path/to/documents\n/other/path')
        .setValue(this.plugin.settings.sourcePaths.join('\n'))
        .onChange(async (value) => {
          this.plugin.settings.sourcePaths = value.split('\n').map(p => p.trim()).filter(p => p);
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Target Path')
      .setDesc('Path in Obsidian vault where mapped files will be created')
      .addText(text => text
        .setPlaceholder('Mapped Files')
        .setValue(this.plugin.settings.targetPath)
        .onChange(async (value) => {
          this.plugin.settings.targetPath = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('File Extensions')
      .setDesc('Comma-separated list of file extensions to map (e.g., .pdf,.docx,.mp4)')
      .addText(text => text
        .setPlaceholder('.pdf,.docx,.doc')
        .setValue(this.plugin.settings.fileExtensions)
        .onChange(async (value) => {
          this.plugin.settings.fileExtensions = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Sync Duration (minutes)')
      .setDesc('How often to sync in minutes')
      .addText(text => text
        .setPlaceholder('60')
        .setValue(String(this.plugin.settings.syncDuration))
        .onChange(async (value) => {
          const num = parseInt(value, 10);
          this.plugin.settings.syncDuration = isNaN(num) || num < 1 ? 60 : Math.min(num, 1440);
          await this.plugin.saveSettings();
          if (this.plugin.settings.autoSync) {
            this.plugin.startSync();
          }
        }));
    
    new Setting(containerEl)
      .setName('YAML Field Mappings')
      .setHeading();
    
    const { fieldMappings } = this.plugin.settings;
    
    new Setting(containerEl)
      .setName('File Name Field')
      .addText(text => text
        .setPlaceholder('title')
        .setValue(fieldMappings.fileName)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.fileName = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('File Path Field')
      .addText(text => text
        .setPlaceholder('path')
        .setValue(fieldMappings.filePath)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.filePath = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('File Size Field')
      .addText(text => text
        .setPlaceholder('size')
        .setValue(fieldMappings.fileSize)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.fileSize = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Created Date Field')
      .addText(text => text
        .setPlaceholder('created')
        .setValue(fieldMappings.createdDate)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.createdDate = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Modified Date Field')
      .addText(text => text
        .setPlaceholder('modified')
        .setValue(fieldMappings.modifiedDate)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.modifiedDate = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('File Type Field')
      .addText(text => text
        .setPlaceholder('type')
        .setValue(fieldMappings.fileType)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.fileType = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Date & Time Format')
      .setHeading();
    
    new Setting(containerEl)
      .setName('Date Format')
      .setDesc('Format: YYYY-MM-DD, DD/MM/YYYY, etc.')
      .addText(text => text
        .setPlaceholder('YYYY-MM-DD')
        .setValue(this.plugin.settings.dateFormat)
        .onChange(async (value) => {
          this.plugin.settings.dateFormat = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Include Time')
      .setDesc('Include time in date fields')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.dateIncludeTime)
        .onChange(async (value) => {
          this.plugin.settings.dateIncludeTime = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .setName('Size Unit')
      .setDesc('Unit for file size display')
      .addDropdown(dropdown => dropdown
        .addOption('bytes', 'Bytes')
        .addOption('KB', 'KB')
        .addOption('MB', 'MB')
        .addOption('GB', 'GB')
        .setValue(this.plugin.settings.sizeUnit)
        .onChange(async (value) => {
          this.plugin.settings.sizeUnit = value;
          await this.plugin.saveSettings();
        }));
    
    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Sync Now')
        .onClick(async () => {
          await this.plugin.syncFiles();
        }));
  }
}
