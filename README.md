# Asteria Lab

一个用 Astro 构建的个人博客起点，方向是“二次元审美 + 技术开发记录”。

## 本地开发

```bash
npm install
npm run dev
```

当前项目已带 `.npmrc`，默认使用 `https://registry.npmmirror.com/`。

## 构建

```bash
npm run build
```

构建产物会输出到 `dist/`。

## 写文章

文章放在：

```text
src/content/blog/
```

新增 Markdown 文件即可，例如：

```md
---
title: "文章标题"
description: "一句话摘要"
pubDate: 2026-05-18
tags: ["Astro", "Dev"]
category: "tech"
---

正文内容。
```

`category` 可选：`tech`、`anime`、`life`。

## 个性化

- 站点名称、作者、导航：`src/lib/site.ts`
- 首页结构：`src/pages/index.astro`
- 全局样式：`src/styles/global.css`
- 本地视觉资产生成：`scripts/generate-assets.mjs`
- 静态图片输出：`public/assets/`

## GitHub Pages

已经包含 GitHub Pages 工作流：

```text
.github/workflows/deploy.yml
```

如果仓库是 `你的用户名.github.io`，当前配置可以直接使用。

如果仓库是普通项目页，例如 `blog`，需要给 Astro 增加 `base: "/blog"`，否则静态资源路径会不对。

## 中文路径

当前项目在 `C:\Users\a1234\Desktop\个人博客` 下已经通过：

```bash
npm install
npm run build
```

所以这个中文路径对当前 Astro 项目没有实际影响。以后如果接入少数老旧脚本或外部工具，再考虑迁移到英文路径。
