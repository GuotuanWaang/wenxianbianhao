# 分类文献编号（Zotero 8 插件）

一个面向 Zotero 8 的轻量插件，用于给选中分类下的文献批量编号。

## 功能

- 在工具菜单中执行：`工具 -> 对所选分类文献编号...`
- 在分类右键菜单中执行：`对该分类文献编号...`
- 仅处理常规文献条目（自动跳过附件/笔记/注释）
- 在文献列表自动新增“编号”列，并放在“创建者”列前（显示 `extra/CollectionNumber`）
- 插件内置头像图标（16/32/48/96/128）
- 可选是否包含子分类
- 可设置：
  - 起始编号（如 `1`）
  - 补零位数（如 `3` 得到 `001`）
  - 编号前缀（如 `PD-` 得到 `PD-001`）
  - 是否覆盖已有插件编号（`extra/CollectionNumber`）
- 编号结果写入文献字段：`extra` 中的 `CollectionNumber` 行（不再占用索书号）

## 安装

1. 执行构建：

```bash
cd /Users/guotuan/Desktop/VS/wenxianbianhao
npm run build
```

2. 构建后生成：

`dist/collection-numbering-0.1.4.xpi`

3. 在 Zotero 中安装：
   - 打开 `工具 -> 插件`
   - 点击右上角齿轮
   - 选择 `Install Add-on From File...`
   - 选择上面生成的 `.xpi`

## 使用说明

1. 在左侧面板选中一个分类
2. 通过工具菜单或右键菜单触发“文献编号”
3. 按提示输入参数并确认执行
4. 完成后会弹出统计结果（成功数、跳过数、失败数）

## 项目结构

```text
wenxianbianhao/
├── bootstrap.js
├── manifest.json
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   ├── icon-96.png
│   └── icon-128.png
├── package.json
├── scripts/
│   └── build-xpi.sh
└── dist/
```
