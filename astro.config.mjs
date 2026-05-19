import { defineConfig } from "astro/config";
import expressiveCode from "astro-expressive-code";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeExpressiveCode from "rehype-expressive-code";
import * as pagefind from "pagefind";
import { fileURLToPath } from "node:url";

const expressiveCodeOptions = {
  themes: ["github-dark"],
  defaultProps: {
    wrap: true,
    overridesByLang: {
      "bash,sh,zsh,powershell,ps1,bat,cmd": {
        frame: "terminal"
      }
    }
  },
  frames: {
    showCopyToClipboardButton: true,
    removeCommentsWhenCopyingTerminalFrames: false
  },
  styleOverrides: {
    borderRadius: "8px",
    codeFontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
    codeFontSize: "0.9rem",
    codeLineHeight: "1.72",
    codePaddingBlock: "1.1rem",
    codePaddingInline: "1.25rem",
    codeBackground: "#111827",
    uiFontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
    frames: {
      frameBoxShadowCssValue: "0 18px 38px rgba(12, 18, 31, 0.28)",
      editorActiveTabBackground: "#111827",
      terminalTitlebarBackground: "#fdf5f0",
      terminalTitlebarForeground: "#31425f",
      inlineButtonBackground: "#ffffff",
      inlineButtonForeground: "#31425f",
      inlineButtonBorder: "#f7b7c8"
    }
  }
};

const pagefindIntegration = () => ({
  name: "yuimi-pagefind",
  hooks: {
    "astro:build:done": async ({ dir, logger }) => {
      const { index, errors } = await pagefind.createIndex({
        forceLanguage: "zh",
        includeCharacters: "_-:"
      });

      if (!index) {
        logger.warn(`Pagefind index was not created: ${errors.join(", ")}`);
        return;
      }

      const distDir = fileURLToPath(dir);
      const addResult = await index.addDirectory({
        path: distDir,
        glob: "**/*.html"
      });

      if (addResult.errors.length) {
        logger.warn(`Pagefind indexing warnings: ${addResult.errors.join(", ")}`);
      }

      const writeResult = await index.writeFiles({
        outputPath: fileURLToPath(new URL("./pagefind", dir))
      });

      if (writeResult.errors.length) {
        logger.warn(`Pagefind write warnings: ${writeResult.errors.join(", ")}`);
      } else {
        logger.info(`Pagefind indexed ${addResult.page_count} pages.`);
      }

      await pagefind.close();
    }
  }
});

export default defineConfig({
  site: "https://yuimi-chaya.github.io",
  output: "static",
  integrations: [
    expressiveCode(expressiveCodeOptions),
    sitemap(),
    icon({
      include: {
        tabler: ["home-heart", "book-2", "device-gamepad-2", "code", "user-heart", "search"]
      }
    }),
    pagefindIntegration()
  ],
  markdown: {
    syntaxHighlight: false,
    gfm: true,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: "append",
          properties: {
            className: ["heading-anchor"],
            ariaLabel: "复制标题链接"
          },
          content: {
            type: "text",
            value: "#"
          }
        }
      ],
      [rehypeExpressiveCode, expressiveCodeOptions]
    ]
  },
  devToolbar: {
    enabled: false
  }
});
