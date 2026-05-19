export const site = {
  name: "Yuimi Lab",
  title: "Yuimi Lab | Anime x Code",
  description: "一个混合二次元审美与技术开发记录的个人博客。",
  author: "Yuimi-chaya",
  nav: [
    { href: "/", label: "HOME", icon: "tabler:home-heart", hint: "front page" },
    { href: "/blog/", label: "BLOG", icon: "tabler:book-2", hint: "notes" },
    { href: "/games/", label: "GAME", icon: "tabler:device-gamepad-2", hint: "playroom" },
    { href: "/projects/", label: "WORKS", icon: "tabler:code", hint: "projects" },
    { href: "/about/", label: "ME", icon: "tabler:user-heart", hint: "profile" }
  ]
};

export const categoryLabel: Record<string, string> = {
  tech: "技术开发",
  anime: "二次元",
  life: "日常记录"
};
