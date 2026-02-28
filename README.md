# 文献分类编号 / Collection Numbering

Zotero add-on for:
- Batch numbering items in a selected collection
- Translating English titles with DeepSeek

Repository: <https://github.com/GuotuanWaang/wenxianbianhao>

---

## 中文说明

### 项目简介

`分类文献编号` 是一个 Zotero 插件，支持对选中分类中的文献进行顺序编号，并可调用 DeepSeek 将英文题名翻译为中文。

### 主要功能

- 菜单入口：
  - `工具 -> 对所选分类文献编号...`
  - `工具 -> 题名翻译（DeepSeek）...`
  - `工具 -> 配置 DeepSeek 题名翻译...`
- 分类右键入口：
  - `对该分类文献编号...`
  - `题名翻译（DeepSeek）...`
- Zotero 设置页（左侧）新增插件页：`分类文献编号`
- 仅处理常规文献条目（自动跳过附件/笔记/注释）
- 自动注册两列：
  - `编号`（显示 `extra/CollectionNumber`）
  - `题名翻译`（显示插件专用翻译结果）
- 编号参数支持：
  - 起始编号
  - 补零位数
  - 编号前缀
  - 是否覆盖已有编号
- 翻译支持：
  - 仅处理英文标题（含拉丁字符且不含中文）
  - 可选择是否覆盖已有翻译
  - `deepseek-reasoner` 无文本时回退 `deepseek-chat`

### 兼容性

- Manifest: `manifest_version = 2`
- Zotero:
  - `strict_min_version: 6.999`
  - `strict_max_version: 9.9.*`
- 当前版本：`0.2.3`

### 安装与构建

1. 本地构建 XPI：

```bash
cd /Users/guotuan/Desktop/VS/wenxianbianhao
npm run build
```

2. 构建产物路径：

```text
dist/collection-numbering-<version>.xpi
```

例如当前版本：

```text
dist/collection-numbering-0.2.3.xpi
```

3. 在 Zotero 安装：
- 打开 `工具 -> 插件`
- 点击右上角齿轮
- 选择 `Install Add-on From File...`
- 选择上一步生成的 `.xpi`

### 使用流程

1. 在左侧面板选中一个分类
2. 如需题名翻译，先打开：
   - Zotero `设置 -> 分类文献编号`
   - 填写 `API Key / Model / Endpoint`
3. 执行编号命令或翻译命令
4. 查看弹窗统计结果（成功、跳过、失败）

### 数据存储策略

- 编号写入：`extra` 字段中的 `CollectionNumber`
- 题名翻译写入：插件专用 `relations`（不写入 `Extra`）
- DeepSeek 配置保存到 Zotero 全局偏好：
  - `extensions.collection-numbering.apiKey`
  - `extensions.collection-numbering.apiModel`
  - `extensions.collection-numbering.apiEndpoint`

### 目录结构

```text
wenxianbianhao/
├── addon/
│   └── chrome/content/preferencesPane.xhtml
├── bootstrap.js
├── icons/
├── manifest.json
├── package.json
├── scripts/
│   └── build-xpi.sh
└── dist/
```

### 开发说明

- 核心逻辑：`bootstrap.js`
- 设置页：`addon/chrome/content/preferencesPane.xhtml`
- 打包脚本：`scripts/build-xpi.sh`

---

## English

### Overview

`Collection Numbering` is a Zotero add-on that:
- Assigns sequential numbers to items in a selected collection
- Translates English paper titles using DeepSeek

### Features

- Tools menu commands:
  - `Tools -> 对所选分类文献编号...` (Number items in selected collection)
  - `Tools -> 题名翻译（DeepSeek）...` (Translate titles with DeepSeek)
  - `Tools -> 配置 DeepSeek 题名翻译...` (Open translation settings)
- Collection context menu commands for numbering and translation
- Dedicated settings pane in Zotero Preferences: `分类文献编号`
- Only regular items are processed (attachments/notes/annotations are skipped)
- Two custom item columns:
  - `编号` (`extra/CollectionNumber`)
  - `题名翻译` (plugin translation value)
- Numbering options:
  - Start number
  - Zero padding
  - Prefix
  - Overwrite existing numbers
- Translation behavior:
  - Only English-like titles are translated
  - Optional overwrite for existing translations
  - Fallback from `deepseek-reasoner` to `deepseek-chat` if needed

### Compatibility

- Manifest version: `2`
- Zotero version range:
  - Min: `6.999`
  - Max: `9.9.*`
- Current add-on version: `0.2.3`

### Build and Install

1. Build the XPI package:

```bash
cd /Users/guotuan/Desktop/VS/wenxianbianhao
npm run build
```

2. Output package:

```text
dist/collection-numbering-<version>.xpi
```

3. Install in Zotero:
- Open `Tools -> Add-ons`
- Click the gear icon
- Select `Install Add-on From File...`
- Choose the generated `.xpi`

### Configuration

Open Zotero Preferences and go to `分类文献编号`, then set:
- `API Key`
- `Model`
- `API Endpoint`

Settings are stored in:
- `extensions.collection-numbering.apiKey`
- `extensions.collection-numbering.apiModel`
- `extensions.collection-numbering.apiEndpoint`

### Data Storage

- Numbering: `extra/CollectionNumber`
- Title translation: plugin-specific `relations`
- Original `title` remains unchanged
- No translation text is written to `Extra`

### License

MIT License. See [LICENSE](./LICENSE).
