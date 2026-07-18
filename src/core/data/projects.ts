export const projectTechLines = [
  { key: "unity", label: "Unity3D", note: "互动原型 / 小游戏" },
  { key: "blender", label: "Blender", note: "模型 / 场景 / 小道具" },
  { key: "ue5", label: "UE5", note: "学习中 / 电影感场景" },
  { key: "mmd", label: "MMD", note: "动作 / 镜头 / 舞台" },
  { key: "astrbot", label: "AstrBot", note: "插件 / 部署 / Bot 工具" }
] as const;

export const projectEntries = [
  {
    id: "astrbot-lab",
    title: "AstrBot 插件实验台",
    type: "Bot Plugin",
    line: "astrbot",
    status: "常驻折腾",
    summary: "把插件开发、角色提示词、部署踩坑和小型自动化整理成可以复用的工具箱。",
    details: ["插件结构拆解", "部署流程记录", "Prompt 与人设调试"]
  },
  {
    id: "unity-toys",
    title: "Unity 小机关工坊",
    type: "Interactive Toy",
    line: "unity",
    status: "原型收集中",
    summary: "用 Unity 做一些轻量互动原型，偏小游戏、角色展示和可点击的小玩具。",
    details: ["2D 交互原型", "角色状态机", "小游戏手感测试"]
  },
  {
    id: "blender-props",
    title: "Blender 手账道具箱",
    type: "3D Assets",
    line: "blender",
    status: "素材修炼",
    summary: "练习建模、材质、灯光和小场景，把 3D 做成能放进博客的可爱摆件。",
    details: ["低模小物", "透明材质", "柔光场景"]
  },
  {
    id: "ue5-room",
    title: "UE5 电影感房间",
    type: "Learning Log",
    line: "ue5",
    status: "正在学习",
    summary: "从场景搭建、蓝图、材质开始，慢慢把脑内的二次元房间做成可漫游空间。",
    details: ["蓝图入门", "场景光照", "材质节点"]
  },
  {
    id: "mmd-camera",
    title: "MMD 镜头练习册",
    type: "Motion Stage",
    line: "mmd",
    status: "灵感排队",
    summary: "记录动作、镜头、舞台和角色表现的练习，让喜欢的角色在画面里更有呼吸感。",
    details: ["镜头节奏", "舞台布光", "动作修正"]
  },
  {
    id: "yuimi-web-lab",
    title: "Yuimi Lab 页面机关",
    type: "Web Lab",
    line: "astrbot",
    status: "持续追加",
    summary: "把博客里的导航、樱花、音乐、看板娘、右键菜单都做成有一点玩具感的体验。",
    details: ["Astro 页面", "轻交互组件", "可爱动效"]
  }
] as const;

