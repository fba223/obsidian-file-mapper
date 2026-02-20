# File Mapper - Obsidian Plugin Description

## Short Description (50 chars)
Map local files to Obsidian with custom YAML frontmatter

## Full Description

File Mapper is an Obsidian plugin that automatically syncs local files from external folders into your vault with customizable metadata. Perfect for managing PDFs, documents, videos, and other files outside your vault while maintaining full searchability within Obsidian.

### Key Features

**Multi-Source Mapping**
- Map files from multiple source directories simultaneously
- Each source gets unique filenames to prevent conflicts

**Customizable Frontmatter**
- Define custom field names for file metadata
- Add extra frontmatter based on source path (e.g., `topic: ai`)
- Configure date formats (YYYY-MM-DD, DD/MM/YYYY, etc.)
- Toggle time inclusion in dates
- Choose size units (bytes, KB, MB, GB)

**Auto-Sync**
- Automatically detect new, modified, and deleted files
- Configurable sync interval (1-1440 minutes)

**What It Creates**
For each mapped file, the plugin creates a `.md` note with:
- Clickable link to open the original file
- File name, path, size, type
- Creation and modification dates
- All metadata in YAML frontmatter
 - Preserves your manual frontmatter/body edits on sync

### Use Cases

- **Academic Research**: Manage PDFs and papers while keeping them searchable
- **Project Documentation**: Map project files from external folders
- **Media Library**: Organize videos and audio with metadata tracking
- **Digital Library**: Build a searchable e-book collection

### Example Output

```yaml
---
title: "research-paper"
path: "/Users/docs/research-paper.pdf"
size: 2.5 MB
created: 2024-01-15
modified: 2024-02-20
type: ".pdf"
---
[Open research-paper.pdf](file:///Users/docs/research-paper.pdf)
```

---

**Note**: Desktop-only plugin. Requires file system access.
