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
    tags: string;
  };
  autoSync: boolean;
  syncDuration: number;
  dateFormat: string;
  dateIncludeTime: boolean;
  sizeUnit: string;
  pathRules: PathRule[];
  includeSystemTags: boolean;
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
    fileType: 'type',
    tags: 'tags'
  },
  syncDuration: 60,
  autoSync: false,
  dateFormat: 'YYYY-MM-DD',
  dateIncludeTime: false,
  sizeUnit: 'KB',
  pathRules: [],
  includeSystemTags: true
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
  private isSyncing: boolean = false;
  private tagCache: Map<string, string[]> | null = null;

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

  async loadSettings() {
    const data = await this.loadData();
    const merged = { ...DEFAULT_SETTINGS, ...data } as FileMapperSettings;

    // Deep merge fieldMappings to ensure new fields are present after upgrades
    merged.fieldMappings = {
      ...DEFAULT_SETTINGS.fieldMappings,
      ...(data?.fieldMappings || {})
    };

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

  private async getFileTags(filePath: string): Promise<string[]> {
    if (this.tagCache?.has(filePath)) {
      return this.tagCache.get(filePath) ?? [];
    }
    try {
      const childProcess = window.require ? window.require('child_process') : null;
      if (!childProcess?.execFile) return [];

      const output = await new Promise<string>((resolve) => {
        childProcess.execFile('mdls', ['-name', 'kMDItemUserTags', filePath], { encoding: 'utf8' }, (error: any, stdout: string) => {
          if (error || !stdout) return resolve('');
          resolve(stdout);
        });
      });

      const match = output.match(/kMDItemUserTags = \(([\s\S]*?)\)/);
      if (match && match[1]) {
        const tags = match[1].split(',').map(t => t.trim().replace(/"/g, '')).filter(t => t);
        this.tagCache?.set(filePath, tags);
        return tags;
      }
    } catch (e) {
      // 文件不存在或无标签时返回空数组
    }
    this.tagCache?.set(filePath, []);
    return [];
  }

  private async yieldToEventLoop(): Promise<void> {
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  async syncFiles() {
    // Prevent re-entry
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.tagCache = new Map();

    try {
      await this.doSyncFiles();
    } finally {
      this.tagCache = null;
      this.isSyncing = false;
    }
  }

  private async doSyncFiles() {
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
      const path = this.getPath();
      let bestMatch = '';
      let bestMatchLen = 0;
      for (const sp of sourcePaths) {
        const normalizedSp = path?.normalize ? path.normalize(sp.replace(/[\/\\]+$/, '')) : sp.replace(/[\/\\]+$/, '');
        const normalizedPath = path?.normalize ? path.normalize(filePath.replace(/[\/\\]+$/, '')) : filePath.replace(/[\/\\]+$/, '');
        const isBoundary = path
          ? (() => {
              const relative = path.relative(normalizedSp, normalizedPath);
              return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
            })()
          : (normalizedPath === normalizedSp ||
             normalizedPath.startsWith(normalizedSp + '/') ||
             normalizedPath.startsWith(normalizedSp + '\\'));
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
    try {
      const url = window.require ? window.require('url') : null;
      if (url?.pathToFileURL) {
        return url.pathToFileURL(filePath).href;
      }
    } catch (e) {
      // fall back to encodeURI
    }
    // Use encodeURI instead of encodeURIComponent to preserve / and : for file paths
    return 'file://' + encodeURI(filePath);
  }

  private extractFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
    // Support both \n and \r\n line endings
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
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
          .map((prop: any) => {
            const propType = (['string', 'number', 'boolean', 'list', 'json'].includes(prop.type) ? prop.type : 'string') as RulePropertyType;
            return {
              key: typeof prop.key === 'string' ? prop.key : '',
              type: propType,
              value: typeof prop.value === 'string' ? prop.value : this.getDefaultPropertyValue(propType)
            };
          });
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
    const path = this.getPath();
    let relPath = '';

    if (path) {
      try {
        const normalizedBase = path.resolve(sourceBasePath);
        const normalizedFile = path.resolve(file.sourcePath);
        const candidate = path.relative(normalizedBase, normalizedFile);
        if (candidate === '' || (!candidate.startsWith('..') && !path.isAbsolute(candidate))) {
          relPath = candidate;
        }
      } catch (e) {
        relPath = '';
      }
    }

    if (!relPath) {
      const fallback = file.sourcePath.substring(sourceBasePath.length);
      relPath = fallback || file.name;
    }

    relPath = relPath.replace(/^[\/\\]+/, '');
    // Remove extension and sanitize path separators
    const withoutExt = relPath.replace(/\.[^.]+$/, '');
    const sanitized = withoutExt.replace(/[\/\\]/g, '_').replace(/^\s*_\s*/, '').replace(/\s*_\s*$/, '');
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
    
    if (!fs || !path || !fs.promises) {
      console.error('File system access not available');
      return files;
    }
    
    const yieldEvery = 200;
    let processed = 0;

    for (const sourcePath of sourcePaths) {
      try {
        try {
          await fs.promises.access(sourcePath);
        } catch {
          console.warn(`Source path does not exist: ${sourcePath}`);
          continue;
        }

        const dirQueue: string[] = [sourcePath];
        while (dirQueue.length > 0) {
          const dir = dirQueue.pop() as string;
          let entries: any[] = [];
          try {
            entries = await fs.promises.readdir(dir, { withFileTypes: true });
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
                  const stat = await fs.promises.stat(fullPath);
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
              await this.yieldToEventLoop();
            }
          }
        }
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
        const content = await this.generateFileContent(file, fieldMappings, existingContent);
        await this.app.vault.modify(existing as TFile, content);
      } else {
        const content = await this.generateFileContent(file, fieldMappings);
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
        const content = await this.generateFileContent(file, fieldMappings, existingContent);
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

  async generateFileContent(file: SourceFile, fieldMappings: FileMapperSettings['fieldMappings'], existingContent?: string): Promise<string> {
    const { dateFormat, dateIncludeTime, sizeUnit, includeSystemTags } = this.settings;

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
      fieldMappings.tags,
      'source_path',
      'source_mtime'
    ]);

    frontmatter[fieldMappings.fileName] = file.name;
    frontmatter[fieldMappings.filePath] = file.sourcePath;
    frontmatter['source_path'] = file.sourcePath;
    frontmatter['source_mtime'] = file.sourceMtime;
    frontmatter[fieldMappings.fileSize] = `${this.formatSize(file.size, sizeUnit)} ${sizeUnit}`;
    frontmatter[fieldMappings.createdDate] = this.formatDate(file.created, dateFormat, dateIncludeTime);
    frontmatter[fieldMappings.modifiedDate] = this.formatDate(file.modified, dateFormat, dateIncludeTime);
    frontmatter[fieldMappings.fileType] = file.extension;

    // Handle system tags
    if (includeSystemTags) {
      const systemTags = await this.getFileTags(file.sourcePath);
      if (systemTags.length > 0) {
        // Merge with existing tags
        const existingTags = frontmatter[fieldMappings.tags];
        let mergedTags: string[] = [];

        if (Array.isArray(existingTags)) {
          mergedTags = [...existingTags, ...systemTags];
        } else if (typeof existingTags === 'string' && existingTags) {
          mergedTags = [existingTags, ...systemTags];
        } else {
          mergedTags = [...systemTags];
        }

        // Deduplicate tags
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
      .setName('Tags Field')
      .setDesc('Field name for system tags in frontmatter')
      .addText(text => text
        .setPlaceholder('tags')
        .setValue(fieldMappings.tags)
        .onChange(async (value) => {
          this.plugin.settings.fieldMappings.tags = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Include System Tags')
      .setDesc('Read macOS Finder tags from source files and add to frontmatter')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.includeSystemTags)
        .onChange(async (value) => {
          this.plugin.settings.includeSystemTags = value;
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
