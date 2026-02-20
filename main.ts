import { App, Plugin, PluginSettingTab, Setting, TFolder, TFile, Vault, parseYaml, stringifyYaml } from 'obsidian';

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
  pathRules: PathRule[];
}

type PathRuleMatchType = 'prefix' | 'regex';
type RulePropertyType = 'string' | 'number' | 'boolean' | 'list' | 'json';

interface PathRule {
  matchType: PathRuleMatchType;
  pattern: string;
  properties: RuleProperty[];
}

interface RuleProperty {
  key: string;
  type: RulePropertyType;
  value: string;
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
  sizeUnit: 'KB',
  pathRules: []
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
    const data = await this.loadData();
    const merged = { ...DEFAULT_SETTINGS, ...data } as FileMapperSettings;
    merged.pathRules = this.normalizePathRules((data as any)?.pathRules);
    this.settings = merged;
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

  private extractFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\s*\n?/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    let parsed: Record<string, any> = {};
    try {
      const data = parseYaml(match[1]);
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        parsed = data as Record<string, any>;
      }
    } catch (e) {
      parsed = this.parseFrontmatterFallback(match[1]);
    }

    const body = content.slice(match[0].length);
    return { frontmatter: parsed, body };
  }

  private parseFrontmatterFallback(block: string): Record<string, any> {
    const result: Record<string, any> = {};
    const lines = block.split('\n');
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

  private normalizePathForMatch(input: string): string {
    return input.replace(/[\\/]+$/, '');
  }

  private getDefaultPropertyValue(type: RulePropertyType): string {
    switch (type) {
      case 'number':
        return '0';
      case 'boolean':
        return 'true';
      case 'list':
        return '';
      case 'json':
        return '{}';
      case 'string':
      default:
        return '';
    }
  }

  private inferPropertyType(value: any): RulePropertyType {
    if (Array.isArray(value)) return 'list';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return 'number';
    if (value && typeof value === 'object') return 'json';
    return 'string';
  }

  private normalizePathRules(rules: any): PathRule[] {
    if (!Array.isArray(rules)) return [];

    const normalized: PathRule[] = [];
    for (const rule of rules) {
      if (!rule || typeof rule !== 'object') continue;
      const matchType: PathRuleMatchType = rule.matchType === 'regex' ? 'regex' : 'prefix';
      const pattern = typeof rule.pattern === 'string' ? rule.pattern : '';

      if (Array.isArray(rule.properties)) {
        const properties: RuleProperty[] = rule.properties
          .filter((prop: any) => prop && typeof prop === 'object')
          .map((prop: any) => ({
            key: typeof prop.key === 'string' ? prop.key : '',
            type: (['string', 'number', 'boolean', 'list', 'json'].includes(prop.type) ? prop.type : 'string') as RulePropertyType,
            value: typeof prop.value === 'string' ? prop.value : this.getDefaultPropertyValue('string')
          }));
        normalized.push({ matchType, pattern, properties });
        continue;
      }

      if (typeof rule.frontmatter === 'string' && rule.frontmatter.trim()) {
        let parsed: Record<string, any> = {};
        try {
          const data = parseYaml(rule.frontmatter);
          if (data && typeof data === 'object' && !Array.isArray(data)) {
            parsed = data as Record<string, any>;
          }
        } catch (e) {
          console.warn('Failed to parse legacy rule frontmatter YAML:', e);
        }
        const properties = Object.entries(parsed).map(([key, value]) => {
          const type = this.inferPropertyType(value);
          let valueString = '';
          if (type === 'list') {
            valueString = Array.isArray(value) ? value.join(', ') : '';
          } else if (type === 'json') {
            try {
              valueString = JSON.stringify(value);
            } catch {
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

  private getMostSpecificPathRule(filePath: string): PathRule | null {
    let bestRule: PathRule | null = null;
    let bestScore = -1;

    for (const rule of this.settings.pathRules) {
      const pattern = rule.pattern?.trim();
      if (!pattern) continue;

      if (rule.matchType === 'prefix') {
        const normalizedPattern = this.normalizePathForMatch(pattern);
        const normalizedPath = this.normalizePathForMatch(filePath);
        const isBoundary = normalizedPath === normalizedPattern ||
          normalizedPath.startsWith(normalizedPattern + '/') ||
          normalizedPath.startsWith(normalizedPattern + '\\');
        if (isBoundary) {
          const score = normalizedPattern.length;
          if (score > bestScore) {
            bestScore = score;
            bestRule = rule;
          }
        }
      } else if (rule.matchType === 'regex') {
        try {
          const regex = new RegExp(pattern);
          const match = filePath.match(regex);
          if (match) {
            const score = match[0]?.length ?? 0;
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

  private parseRuleFrontmatter(rule: PathRule | null): Record<string, any> {
    if (!rule || !Array.isArray(rule.properties)) return {};
    const result: Record<string, any> = {};
    for (const prop of rule.properties) {
      const key = prop.key?.trim();
      if (!key) continue;
      const value = this.coerceRulePropertyValue(prop.type, prop.value);
      result[key] = value;
    }
    return result;
  }

  private coerceRulePropertyValue(type: RulePropertyType, raw: string): any {
    switch (type) {
      case 'number': {
        const parsed = Number(raw);
        return Number.isFinite(parsed) ? parsed : raw;
      }
      case 'boolean': {
        const normalized = raw.trim().toLowerCase();
        return ['true', '1', 'yes', 'y'].includes(normalized);
      }
      case 'list': {
        if (!raw.trim()) return [];
        return raw.split(',').map(item => item.trim()).filter(item => item.length > 0);
      }
      case 'json': {
        try {
          return JSON.parse(raw);
        } catch (e) {
          return raw;
        }
      }
      case 'string':
      default:
        return raw;
    }
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
            const { frontmatter } = this.extractFrontmatter(content);
            
            const mappedPathField = this.settings.fieldMappings.filePath;
            const sourcePath =
              frontmatter['source_path'] ||
              (mappedPathField ? frontmatter[mappedPathField] : '') ||
              frontmatter['path'] ||
              '';

            files.push({
              name: child.basename,
              path: child.path,
              sourcePath,
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
    return this.extractFrontmatter(content).frontmatter;
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
    
    const filePath = `${targetPath}/${file.name}.md`;
    
    try {
      const existing = this.app.vault.getAbstractFileByPath(filePath);
      if (existing) {
        const existingContent = await this.app.vault.read(existing as TFile);
        const content = this.generateFileContent(file, fieldMappings, existingContent);
        await this.app.vault.modify(existing as TFile, content);
      } else {
        const content = this.generateFileContent(file, fieldMappings);
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
        const existingContent = await this.app.vault.read(existing as TFile);
        const content = this.generateFileContent(file, fieldMappings, existingContent);
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

  generateFileContent(file: SourceFile, fieldMappings: FileMapperSettings['fieldMappings'], existingContent?: string): string {
    const { dateFormat, dateIncludeTime, sizeUnit } = this.settings;

    const existing = existingContent ? this.extractFrontmatter(existingContent) : { frontmatter: {}, body: '' };
    const frontmatter: Record<string, any> = { ...existing.frontmatter };
    const body = existingContent ? existing.body : `[${file.name}](${this.encodeFileUrl(file.sourcePath)})`;

    const pluginFields = new Set<string>([
      fieldMappings.fileName,
      fieldMappings.filePath,
      fieldMappings.fileSize,
      fieldMappings.createdDate,
      fieldMappings.modifiedDate,
      fieldMappings.fileType,
      'source_path',
      'source_mtime'
    ]);

    frontmatter[fieldMappings.fileName] = file.name;
    frontmatter[fieldMappings.filePath] = file.sourcePath;
    delete frontmatter['source_path'];
    frontmatter['source_mtime'] = file.sourceMtime;
    frontmatter[fieldMappings.fileSize] = `${this.formatSize(file.size, sizeUnit)} ${sizeUnit}`;
    frontmatter[fieldMappings.createdDate] = this.formatDate(file.created, dateFormat, dateIncludeTime);
    frontmatter[fieldMappings.modifiedDate] = this.formatDate(file.modified, dateFormat, dateIncludeTime);
    frontmatter[fieldMappings.fileType] = file.extension;

    const rule = this.getMostSpecificPathRule(file.sourcePath);
    const ruleFrontmatter = this.parseRuleFrontmatter(rule);
    for (const [key, value] of Object.entries(ruleFrontmatter)) {
      if (pluginFields.has(key)) continue;
      if (Object.prototype.hasOwnProperty.call(frontmatter, key)) continue;
      frontmatter[key] = value;
    }

    const yamlBody = stringifyYaml(frontmatter).trimEnd();
    const yamlBlock = yamlBody.length > 0 ? yamlBody : '';
    return ['---', yamlBlock, '---', '', body].join('\n');
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
      .setName('Path Rules')
      .setDesc('Add frontmatter based on source path. Most specific rule wins. Fields only fill when missing.')
      .setHeading();

    const rulesContainer = containerEl.createDiv('file-mapper-path-rules');
    this.renderPathRules(rulesContainer);

    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Add Path Rule')
        .onClick(async () => {
          this.plugin.settings.pathRules.push({ matchType: 'prefix', pattern: '', properties: [] });
          await this.plugin.saveSettings();
          this.display();
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

  private renderPathRules(containerEl: HTMLElement) {
    containerEl.empty();

    this.plugin.settings.pathRules.forEach((rule, index) => {
      new Setting(containerEl)
        .setName(`Rule ${index + 1}`)
        .setDesc('Most specific rule wins (longest match).')
        .addExtraButton(button => button
          .setIcon('trash')
          .setTooltip('Delete rule')
          .onClick(async () => {
            this.plugin.settings.pathRules.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }));

      new Setting(containerEl)
        .setName('Match Type')
        .addDropdown(dropdown => dropdown
          .addOption('prefix', 'Prefix')
          .addOption('regex', 'Regex')
          .setValue(rule.matchType)
          .onChange(async (value) => {
            rule.matchType = value as PathRuleMatchType;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Pattern')
        .setDesc('Prefix path or regex pattern.')
        .addText(text => text
          .setPlaceholder('/path/to/folder')
          .setValue(rule.pattern)
          .onChange(async (value) => {
            rule.pattern = value;
            await this.plugin.saveSettings();
          }));

      const propertiesContainer = containerEl.createDiv('file-mapper-rule-properties');
      this.renderRuleProperties(propertiesContainer, rule);
    });
  }

  private renderRuleProperties(containerEl: HTMLElement, rule: PathRule) {
    containerEl.empty();

    rule.properties.forEach((prop, index) => {
      new Setting(containerEl)
        .setName(`Property ${index + 1}`)
        .addText(text => text
          .setPlaceholder('property')
          .setValue(prop.key)
          .onChange(async (value) => {
            prop.key = value;
            await this.plugin.saveSettings();
          }))
        .addDropdown(dropdown => dropdown
          .addOption('string', 'string')
          .addOption('number', 'number')
          .addOption('boolean', 'boolean')
          .addOption('list', 'list')
          .addOption('json', 'json')
          .setValue(prop.type)
          .onChange(async (value) => {
            const previousType = prop.type;
            prop.type = value as RulePropertyType;
            if (!prop.value || prop.value === this.getDefaultPropertyValue(previousType)) {
              prop.value = this.getDefaultPropertyValue(prop.type);
            }
            await this.plugin.saveSettings();
            this.display();
          }))
        .addText(text => text
          .setPlaceholder(this.getPropertyValuePlaceholder(prop.type))
          .setValue(prop.value)
          .onChange(async (value) => {
            prop.value = value;
            await this.plugin.saveSettings();
          }))
        .addExtraButton(button => button
          .setIcon('trash')
          .setTooltip('Delete property')
          .onClick(async () => {
            rule.properties.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          }));
    });

    new Setting(containerEl)
      .addButton(button => button
        .setButtonText('Add Property')
        .onClick(async () => {
          rule.properties.push({ key: '', type: 'string', value: this.getDefaultPropertyValue('string') });
          await this.plugin.saveSettings();
          this.display();
        }));
  }

  private getDefaultPropertyValue(type: RulePropertyType): string {
    switch (type) {
      case 'number':
        return '0';
      case 'boolean':
        return 'true';
      case 'list':
        return '';
      case 'json':
        return '{}';
      case 'string':
      default:
        return '';
    }
  }

  private getPropertyValuePlaceholder(type: RulePropertyType): string {
    switch (type) {
      case 'number':
        return '0';
      case 'boolean':
        return 'true';
      case 'list':
        return 'item1, item2';
      case 'json':
        return '{\"key\":\"value\"}';
      case 'string':
      default:
        return 'value';
    }
  }
}
