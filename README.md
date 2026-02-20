# File Mapper

> Map local files to Obsidian with custom YAML frontmatter

[![GitHub release (latest SemVer)](https://img.shields.io/github/v/release/your-username/obsidian-file-mapper?style=flat-square)](https://github.com/your-username/obsidian-file-mapper/releases/latest)
[![Obsidian plugin](https://img.shields.io/badge/Obsidian-Plugin-blue?style=flat-square)](https://obsidian.md)
[![License](https://img.shields.io/github/license/your-username/obsidian-file-mapper?style=flat-square)](LICENSE)

File Mapper is an Obsidian plugin that automatically maps local files from external folders into your Obsidian vault with customizable YAML frontmatter. Perfect for managing PDFs, documents, videos, and other files outside your vault while maintaining full searchability and organization within Obsidian.

## Features

### Core Features

- **Multi-Source Mapping** - Map files from multiple source directories simultaneously
- **Customizable YAML Frontmatter** - Define your own field names for file metadata
- **Auto-Sync** - Automatically detect and sync new, modified, and deleted files
- **Flexible Date Formatting** - Customize date format (YYYY-MM-DD, DD/MM/YYYY, etc.) with optional time
- **Size Unit Selection** - Display file sizes in Bytes, KB, MB, or GB

### What It Maps

For each file, the plugin creates a corresponding `.md` file with:

- **Title** - Customizable field name for the file name
- **Path** - Full path to the original file (clickable link)
- **Size** - File size in your preferred unit
- **Created** - Creation date with customizable format
- **Modified** - Last modified date with customizable format
- **Type** - File extension/type
- **Clickable Link** - Direct link to open the original file

## Installation

### From Obsidian (Recommended)

1. Open **Settings** → **Community plugins**
2. Disable Safe mode (if prompted)
3. Search for "File Mapper"
4. Click **Install** and then **Enable**

### Manual Installation

1. Download the latest release from GitHub
2. Extract the folder to `<vault>/.obsidian/plugins/file-mapper/`
3. Enable the plugin in Obsidian settings

## Settings

### Auto Sync

Enable or disable automatic synchronization. When enabled, the plugin will periodically check for changes in your source directories.

### Sync Duration (minutes)

Set how often (in minutes) the plugin checks for changes. Default is 60 minutes. Range: 1-1440 minutes.

### Source Paths (Multiple)

Add one or more source directories to scan. Each path should be on a new line. The plugin will recursively scan all subdirectories.

Example:
```
/Users/username/Documents
/Users/username/Downloads
/Users/username/Books
```

### Target Path

The folder in your Obsidian vault where mapped files will be created. Default: `Mapped Files`

### File Extensions

Comma-separated list of file extensions to map. Default: `.pdf,.docx,.doc,.mp4,.epub`

Example: `.pdf,.docx,.doc,.xlsx,.pptx,.mp4,.mp3,.epub`

### YAML Field Mappings

Customize the YAML frontmatter field names:

| Default Field | Description |
|---------------|-------------|
| `title` | File name (without extension) |
| `path` | Full path to original file |
| `size` | File size |
| `created` | Creation date |
| `modified` | Last modified date |
| `type` | File extension |

### Date & Time Format

- **Date Format**: Customize the date format using `YYYY`, `MM`, `DD`
  - `YYYY-MM-DD` → `2024-02-20`
  - `DD/MM/YYYY` → `20/02/2024`
  - `MM/DD/YYYY` → `02/20/2024`

- **Include Time**: Toggle to include time in date fields

### Size Unit

Choose how file sizes are displayed:
- **Bytes** - `1024 bytes`
- **KB** - `1.00 KB`
- **MB** - `0.98 MB`
- **GB** - `0.00 GB`

### Manual Sync

Click "Sync Now" button to immediately synchronize files.

## Use Cases

### Academic Research

Manage PDFs of research papers, academic articles, and books outside your vault while having them searchable within Obsidian. Add tags and annotations to create a comprehensive knowledge base.

### Project Documentation

Map project documents, technical specs, and design files from project folders. Keep all documentation organized while maintaining the original file locations.

### Media Library

Organize video tutorials, podcasts, and audio files. Track which content you've consumed and when with modification dates.

### Digital Library

Build a personal library from downloaded e-books, documents, and articles. Search and filter by type, date, or any custom metadata.

### Dev Resources

Map documentation files, code samples, and technical resources. Keep your developer reference library organized without duplicating files.

## How It Works

1. **Scan**: The plugin scans your configured source directories
2. **Filter**: Only files matching your extensions are included
3. **Map**: Creates `.md` files with YAML frontmatter in your target folder
4. **Link**: Each mapped file contains a clickable link to open the original
5. **Sync**: Periodically checks for new, modified, or deleted files

## Example Output

For a PDF file at `/Users/username/Documents/report.pdf`, the plugin creates:

```yaml
---
title: "report"
path: "/Users/username/Documents/report.pdf"
size: 2.50 MB
created: 2024-02-20
modified: 2024-02-21
type: ".pdf"
---
[report](file:///Users/username/Documents/report.pdf)
```

## Limitations

- **Desktop Only**: File system access requires desktop Obsidian
- **Read-only Links**: Opens files in their default application
- **No Content**: Mapped files contain only metadata and links, not file content

## Support

- Report bugs: [GitHub Issues](https://github.com/your-username/obsidian-file-mapper/issues)
- Feature requests: [GitHub Discussions](https://github.com/your-username/obsidian-file-mapper/discussions)

## License

MIT License - See [LICENSE](LICENSE) for details.

---

Made with ❤️ for the Obsidian community
