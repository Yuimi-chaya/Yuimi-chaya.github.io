import { getThemePath } from "@/core/themes/registry";

export const hiddenRoutes = [
  { id: "chibi-jealousy", code: "A", label: "嫉妒舞台", detail: "后宫总会起火，别让她们看见不该看的东西" },
  { id: "chibi-apple", code: "B", label: "飞来之物", detail: "舞台记住两次争吵，飞来的就不再只是台词" },
  { id: "found-self", code: "C", label: "寻找自我", detail: "契约真正被改写前停下，回到一切的起点" },
  { id: "photo-archive", code: "D", label: "照片暗门", detail: "照片不会开口，胶带边缘未必守得住秘密" },
  { id: "memory-return", code: "E", label: "记忆归还", detail: "被归还的记忆不会立刻歌唱，先等十一段旧旋律走完" },
] as const;

export const routeBranches = [
  {
    id: "home", label: "HOME", href: getThemePath("kisara", "/"), detail: "首页章节",
    routes: [
      { id: "001", kind: "chapter", label: "站点档案", href: "#kisara-opening", icon: "tabler:file-text" },
      { id: "002", kind: "chapter", label: "冰箱库存", href: "#kisara-fridge-title", icon: "tabler:glass-full" },
      { id: "003", kind: "chapter", label: "课堂残片", href: "#kisara-project-title", icon: "tabler:movie" },
      { id: "004", kind: "chapter", label: "最新信号", href: "#kisara-latest-title", icon: "tabler:archive" },
    ],
  },
  {
    id: "blog", label: "BLOG", href: getThemePath("kisara", "/blog/"), detail: "文章信号",
    routes: [
      { id: "blog-cast", kind: "feature", label: "人物视点", href: `${getThemePath("kisara", "/blog/")}#kisara-blog-hero-title`, icon: "tabler:user-heart" },
      { id: "blog-archive", kind: "feature", label: "文章档案", href: `${getThemePath("kisara", "/blog/")}#kisara-blog-archive`, icon: "tabler:archive" },
    ],
  },
  {
    id: "games", label: "GAME", href: getThemePath("kisara", "/games/"), detail: "互动游乐场",
    routes: [
      { id: "game-investigation", kind: "feature", label: "异常影像", href: `${getThemePath("kisara", "/games/")}#kisara-game-investigation-title`, icon: "tabler:user-scan" },
      { id: "game-arcade", kind: "feature", label: "夜间街机", href: `${getThemePath("kisara", "/games/")}#kisara-arcade-title`, icon: "tabler:device-gamepad-2" },
    ],
  },
  {
    id: "projects", label: "WORKS", href: getThemePath("kisara", "/projects/"), detail: "创作现场",
    routes: [
      { id: "works-cut", kind: "feature", label: "刀切测试", href: `${getThemePath("kisara", "/projects/")}#kisara-works-title`, icon: "tabler:blade" },
      { id: "works-kitchen", kind: "feature", label: "技术食材", href: `${getThemePath("kisara", "/projects/")}#kisara-kitchen-lab`, icon: "tabler:flask-2" },
      { id: "works-result", kind: "feature", label: "实验配方", href: `${getThemePath("kisara", "/projects/")}#kisara-drink-title`, icon: "tabler:flask-2" },
    ],
  },
  {
    id: "about", label: "ME", href: getThemePath("kisara", "/about/"), detail: "个人档案",
    routes: [
      { id: "me-profile", kind: "feature", label: "身份档案", href: getThemePath("kisara", "/about/"), icon: "tabler:user-heart" },
      { id: "me-memories", kind: "feature", label: "五段记忆", href: getThemePath("kisara", "/about/"), icon: "tabler:archive" },
      { id: "me-friends", kind: "feature", label: "友联坐标", href: getThemePath("kisara", "/friends/"), icon: "tabler:link" },
    ],
  },
] as const;
