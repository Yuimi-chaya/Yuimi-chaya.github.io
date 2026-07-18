import { getTheme } from "@/core/themes/registry";

export const kisaraTheme = getTheme("kisara");

export { default as HomePage } from "./pages/HomePage.astro";
export { default as BlogIndexPage } from "./pages/BlogIndexPage.astro";
export { default as ArticlePage } from "./pages/ArticlePage.astro";
export { default as AboutPage } from "./pages/AboutPage.astro";
export { default as ProjectsPage } from "./pages/ProjectsPage.astro";
export { default as GamesPage } from "./pages/GamesPage.astro";
export { default as NotFoundPage } from "./pages/NotFoundPage.astro";
