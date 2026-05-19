---
title: "使用宝塔面板部署 AstrBot + NapCat QQ 机器人教程"
description: "从云服务器端口放行、宝塔 Docker 环境准备，到 AstrBot 与 NapCat 连接测试的一篇完整部署记录。"
pubDate: 2026-05-19
updatedDate: 2026-05-19
cover: "https://img.cdn1.vip/i/6a0c9a06a3375_1779210758.webp"
tags: ["AstrBot", "NapCat", "QQ机器人", "宝塔面板", "Docker"]
category: "tech"
---
从云服务器准备到 QQ 收发消息测试，小白也能照着做。

作者：**喝益胃 / Yuimi-chaya**  
Bilibili 主页：<https://space.bilibili.com/494350222>

> 创作声明：本文由作者提供实践经验与截图，并使用 AI 辅助整理、改写和排版。教程内容会尽量保持清晰准确，但 AstrBot、NapCat、宝塔面板和各云厂商界面可能随版本变化，请以实际页面和官方文档为准。

## 这篇教程能做什么

这篇文章会带你完成：

- 云服务器端口放行
- 宝塔 Docker 环境准备
- AstrBot 部署
- NapCat 部署
- 模型提供方配置
- OneBot v11 / WebSocket 连接
- QQ 消息测试

做完以后，你的 QQ bot 可以收到消息，并让 AstrBot 调用模型回复。

## 先说风险

token、API Key、服务器 IP、QQ 账号都不要公开。

建议使用 QQ 小号做 bot，不建议直接使用常用大号。重要提示词、人设、配置文件、插件数据也建议及时备份。机器人部署、账号登录、记忆类插件、模型调用都有一定风险，请确认理解后再继续。

## 准备工作

正式开始前，先准备下面这些东西：

| 准备项 | 用途 | 建议 |
| --- | --- | --- |
| 云服务器 | 运行 AstrBot 和 NapCat | 腾讯云、阿里云、AWS 等都可以，本文以宝塔面板操作为主 |
| 宝塔面板 | 图形化管理 Docker、容器和端口 | 先确认能正常登录宝塔后台 |
| QQ 小号 | 作为 bot 账号登录 NapCat | 不要用常用大号，首次登录可能触发风控 |
| 模型 API Key | 让 AstrBot 调用大模型回复消息 | DeepSeek、硅基流动等都可以，注意余额和模型名 |
| 浏览器 | 打开 AstrBot WebUI 和 NapCat WebUI | 建议同时开两个标签页，后面会来回切换 |

## 需要放行的端口

| 端口 | 用途 | 是否必需 | 说明 |
| --- | --- | --- | --- |
| `6185` | AstrBot WebUI | 必需 | 浏览器访问 AstrBot 后台，例如 `http://服务器IP:6185` |
| `6099` | NapCat WebUI | 必需 | 浏览器访问 NapCat 后台，例如 `http://服务器IP:6099` |
| `3000 / 3001` | NapCat 容器端口 | 按截图保留 | 用于 NapCat 容器内部服务，手动创建容器时按截图映射即可 |
| `6199` | AstrBot OneBot v11 反向 WebSocket | QQ 对接需要 | NapCat 会通过 `ws://服务器IP:6199/ws` 连接到 AstrBot |

> 注意：云服务商安全组和宝塔系统防火墙是两层东西。只在宝塔里放行不一定够，云服务器控制台里的安全组也要放行。

## 1. 放行云服务器安全组端口

进入云服务器控制台，找到安全组或防火墙规则，放行上面清单里的 TCP 端口。

不同厂商页面不一样，但核心字段基本相同：来源、协议、端口、策略。

![腾讯云轻量服务器防火墙页面](https://img.cdn1.vip/i/6a0c99c7cccb0_1779210695.webp)

添加规则时，可以选择 TCP，也可以按自己的安全策略把来源 IP 改得更严格。

![安全组规则字段](https://img.cdn1.vip/i/6a0c99c958bc4_1779210697.webp)

确认规则保存后，列表里应该能看到 `6185`、`6099`、`6199` 等端口。如果你为了省事临时放行 `ALL`，测试完成后建议改回只放行需要的端口。

## 2. 登录宝塔面板并准备 Docker

打开宝塔面板，进入服务器的应用管理或 Docker 模块。本文使用宝塔自带的 Docker 图形化界面，不要求你熟悉命令行。

![宝塔应用管理](https://img.cdn1.vip/i/6a0c99cb1d107_1779210699.webp)

在宝塔左侧进入 Docker。如果提示未安装 Docker 模块，先点击立即安装。

![安装宝塔 Docker 模块](https://img.cdn1.vip/i/6a0c99ccc9667_1779210700.webp)

确认 Docker 页面能正常打开，并且顶部可以看到应用商店、容器、镜像等菜单。

## 3. 在宝塔中安装 AstrBot

在宝塔 Docker 的应用商店中搜索 AstrBot，点击安装并等待容器启动。

![搜索 AstrBot](https://img.cdn1.vip/i/6a0c99cee4a0b_1779210702.webp)

安装 AstrBot 时，可以检查名称、版本、端口和自定义配置。新手通常只需要确认 WebUI 端口是 `6185`。

![AstrBot 安装配置](https://img.cdn1.vip/i/6a0c99d0a7f89_1779210704.webp)

安装完成后，先不要急着配置模型。先确认容器能启动，再处理 WebUI 访问端口。

AstrBot 启动日志中出现 WebUI 地址，说明后台服务已经跑起来。

![AstrBot WebUI 启动日志](https://img.cdn1.vip/i/6a0c99d26973f_1779210706.webp)

如果你更习惯用容器编排管理服务，也可以参考下面这种配置。重点是 `6185` 用于 WebUI，`6199` 用于 OneBot v11 / aiocqhttp 连接，数据目录要映射出来方便备份。

![容器编排中开放 AstrBot 端口](https://img.cdn1.vip/i/6a0c99d4317b4_1779210708.webp)

参考 `docker-compose.yml`：

```yaml
services:
  astrbot:
    environment:
      - TZ=Asia/Shanghai # 设置时区为上海
    image: soulter/astrbot:latest # 镜像名，注意修改
    container_name: astrbot
    restart: always
    ports:
      - "6185:6185" # 面板端口
      - "6199:6199" # OneBot(aiocqhttp)默认端口
      # - "6195:6195" # 企业微信默认端口
      # - "6196:6196" # QQ官方API(Webhook)默认端口
      # - "XXXX:XXXX" # 插件 webui 端口
    volumes:
      - ./data:/AstrBot/data # AstrBot 数据映射，各种数据都存在这里
      - /etc/localtime:/etc/localtime:ro # 使用宿主机时区，确保时间一致
    networks:
      bot: {}
    deploy:
      resources:
        limits:
          memory: 1G

networks:
  bot:
    external: true
```

> 如果模板中的 `bot` 网络在服务器上不存在，需要先创建，或者把 `networks` 部分改成你实际使用的 Docker 网络。

## 4. 放行并登录 AstrBot WebUI

在宝塔左侧点击“安全”，添加系统防火墙规则，放行 AstrBot WebUI 默认端口 `6185`。

![宝塔放行 6185 端口](https://img.cdn1.vip/i/6a0c99d5e3dd9_1779210709.webp)

然后在浏览器打开：

```text
http://服务器IP:6185
```

地址栏应该显示服务器 IP 加 `6185` 端口。

![AstrBot 地址栏](https://img.cdn1.vip/i/6a0c99d80b1f2_1779210712.webp)

成功进入 AstrBot WebUI 后，可以看到欢迎页和快速引导。

![AstrBot 欢迎页](https://img.cdn1.vip/i/6a0c99d98fb47_1779210713.webp)

如果打不开，优先检查 `6185` 是否同时在云服务器安全组和宝塔防火墙中放行。

## 5. 手动创建 NapCat 容器

回到宝塔 Docker 的“容器”页面，点击“创建容器”，选择“手动创建”。

NapCat 没有直接上架宝塔应用商店，所以这里用镜像名创建。

| 字段 | 填写内容 |
| --- | --- |
| 容器名称 | `napcat` |
| 镜像 | `mlikiowa/napcat-docker:latest` |
| 端口映射 | `6099:6099`、`3001:3001`、`3000:3000` |

![手动创建 NapCat 容器](https://img.cdn1.vip/i/6a0c99db23826_1779210715.webp)

创建完成后，容器列表里应出现 `napcat`，状态为运行中。

## 6. 保存 token 并登录 NapCat

打开 NapCat 容器日志，找到 WebUI 登录地址和 token。

这个 token 只在日志里最容易找到，建议立刻保存到本地安全位置。

![NapCat token 日志](https://img.cdn1.vip/i/6a0c99dca8689_1779210716.webp)

访问地址通常类似：

```text
http://服务器IP:6099/webui
http://服务器IP:6099/webui/web_login
```

以日志里给出的地址为准。

打开 NapCat WebUI 登录页，输入日志中的 token。

![NapCat 登录页](https://img.cdn1.vip/i/6a0c99de38e64_1779210718.webp)

token 正确时会进入 NapCat 后台。如果提示错误，请重新打开容器日志，确认没有复制空格或换行。

## 7. 登录 QQ bot 号

在 NapCat 后台按照页面提示登录 QQ bot 号。

建议使用小号，并提前在手机 QQ 上确认该账号可以正常登录。

![NapCat 基础信息页](https://img.cdn1.vip/i/6a0c99dfc24a8_1779210719.webp)

不要把常用大号拿来做 bot。QQ 登录可能触发安全验证或风控，出现登录失败时先按页面提示完成验证，必要时换小号或稍后再试。

## 8. 配置 AstrBot 模型提供方

回到 AstrBot WebUI，进入“模型提供商”。

如果是第一次配置，可以在欢迎页的快速引导中点击“配置 AI 模型”。

![AstrBot 配置 AI 模型入口](https://img.cdn1.vip/i/6a0c99e153a29_1779210721.webp)

新增提供商时可以选择 DeepSeek，也可以选择 OpenAI Compatible 后填写兼容地址。

![AstrBot 选择模型提供商](https://img.cdn1.vip/i/6a0c99e3102c3_1779210723.webp)

常见配置参考：

| 平台 | API Base URL | 模型名示例 | 说明 |
| --- | --- | --- | --- |
| DeepSeek 官方 | `https://api.deepseek.com/v1` | `deepseek-chat` / `deepseek-reasoner` | 需要 DeepSeek 开放平台 API Key |
| 硅基流动 | `https://api.siliconflow.cn/v1` | 按平台可用模型填写 | 同样使用 OpenAI Compatible 方式接入 |

API Key 只复制一次就要保存好，不要发到群里，也不要放到公开截图里。模型配置后不回复时，先检查 API Key、余额、Base URL 和模型名。

## 9. 填入 API Key 并选择模型

以 DeepSeek 为例，进入控制台的 API keys 页面，创建 API Key。

![DeepSeek 创建 API Key](https://img.cdn1.vip/i/6a0c99e5376a1_1779210725.webp)

创建后立刻复制并保存 API Key。关闭弹窗后，通常无法再次查看完整 key。

![DeepSeek 复制 API Key](https://img.cdn1.vip/i/6a0c99e6bc8f8_1779210726.webp)

回到 AstrBot，在模型提供方里填入刚才复制的 API Key，确认 API Base URL 正确。

![AstrBot 填入 API Key](https://img.cdn1.vip/i/6a0c99e87ff22_1779210728.webp)

点击“获取模型列表”，把需要使用的模型添加到已配置模型中。

![AstrBot 获取模型列表](https://img.cdn1.vip/i/6a0c99ea12388_1779210730.webp)

也可以在模型提供商中继续添加可用模型。

![添加 LLM](https://img.cdn1.vip/i/6a0c99eb97ddf_1779210731.webp)

添加模型后，继续检查默认 LLM。默认 LLM 没选好时，平台连接可能正常，但消息进来后 AstrBot 不知道该调用哪个模型。

![选择默认 LLM](https://img.cdn1.vip/i/6a0c99ed52138_1779210733.webp)

配置完成后，可以先在 AstrBot WebUI 的聊天页测试一句话。

## 10. 配置 AstrBot 与 NapCat 的连接

这一步是整条链路的重点：

- AstrBot 作为反向 WebSocket 服务端
- NapCat 作为 WebSocket 客户端
- NapCat 连接到 AstrBot

### 在 AstrBot 中创建 OneBot v11

进入 AstrBot WebUI，点击左侧“机器人”，创建一个 OneBot v11 / aiocqhttp 机器人。

建议这样填：

- ID 可以写成 `default`、`qq-napcat` 或其他容易识别的名字
- 启用开关打开
- 反向 WebSocket 主机地址填 `0.0.0.0`
- 反向 WebSocket 端口填 `6199`
- token 只有在 NapCat 网络配置里也设置了 token 时才需要填写，新手可以先两边都留空
- 保存配置，并确认 AstrBot 容器或宝塔端口里已经暴露 `6199`

![AstrBot 创建 OneBot v11 机器人](https://img.cdn1.vip/i/6a0c99ef38842_1779210735.webp)

### 在 NapCat 中新增 WebSocket 客户端

进入 NapCat WebUI 的“网络配置”，新增一个 WebSocket 客户端。

![NapCat 新增 WebSocket 客户端](https://img.cdn1.vip/i/6a0c99f0bdaf1_1779210736.webp)

启用后填写 AstrBot 的 ws 地址。

常用 URL：

```text
ws://服务器IP:6199/ws
```

![NapCat WebSocket 客户端设置](https://img.cdn1.vip/i/6a0c99f25aa0d_1779210738.webp)

如果 AstrBot 和 NapCat 都在 Docker 里，并且你已经把两个容器加入同一个 Docker 网络，可以尝试：

```text
ws://astrbot:6199/ws
```

如果只有 NapCat 是 Docker，通常使用：

```text
ws://宿主机IP:6199/ws
```

回到 AstrBot 控制台或平台日志，看到 OneBot v11 / aiocqhttp 适配器已连接，就说明 NapCat 已经连上 AstrBot。

![AstrBot 显示 NapCat 已连接](https://img.cdn1.vip/i/6a0c99f41afc5_1779210740.webp)

如果连接失败，优先检查：

- `6199` 是否开放
- NapCat URL 是否写成 `ws://服务器IP:6199/ws`
- AstrBot 的 OneBot v11 机器人是否启用
- token 是否两边一致，或者两边都留空

## 11. 发送 QQ 消息测试

用另一个 QQ 给 bot 号发一句普通消息，例如“你好”。

不要一开始就发很长的提示词，先验证最短链路是否能跑通。

检查顺序：

1. QQ 端：bot 号能收到消息
2. NapCat 端：日志里能看到收到 QQ 消息并转发
3. AstrBot 端：控制台或日志里能看到 OneBot v11 收到事件
4. 模型端：AstrBot 调用模型成功，没有 API Key 或余额错误
5. QQ 端：bot 返回一条模型回复

QQ 端能看到回复，说明最终用户侧已经能看到结果。

![QQ 端收到 bot 回复](https://img.cdn1.vip/i/6a0c99f59f640_1779210741.webp)

NapCat 日志显示收到 QQ 消息并发送回复。

![NapCat 收发消息日志](https://img.cdn1.vip/i/6a0c99f76057f_1779210743.webp)

AstrBot 日志显示收到事件、调用模型并发送消息。

![AstrBot 收发消息日志](https://img.cdn1.vip/i/6a0c99fa23f6b_1779210746.webp)

只要 QQ 端能看到回复，NapCat 日志有收发记录，AstrBot 日志有事件和发送记录，三者同时成立时，部署、连接和测试这条链路就基本完成了。

## 完成检查清单

| 检查项 | 通过表现 |
| --- | --- |
| AstrBot WebUI | `http://服务器IP:6185` 可以打开 |
| NapCat WebUI | `http://服务器IP:6099` 可以打开并登录 |
| QQ bot | NapCat 显示 QQ 已登录 |
| OneBot v11 | AstrBot 日志显示适配器已连接 |
| 模型 | WebUI 测试或 QQ 消息能得到回复 |

## 常见问题

### WebUI 打不开

检查安全组和宝塔防火墙是否都放行；容器是否运行；URL 是否带端口。

### 端口放行了还是访问不了

云服务商安全组、宝塔系统防火墙、Docker 端口映射要同时正确。

### NapCat token 找不到

打开 `napcat` 容器日志，搜索 `token` 或 `WebUI User Panel Url`。

### QQ 登录失败

确认账号能在手机 QQ 登录；完成安全验证；避免频繁重试。

### AstrBot 收不到 QQ 消息

检查 NapCat 网络配置 URL，`6199` 是否暴露，AstrBot OneBot v11 是否启用。

### 模型配置后不回复

检查 API Key、余额、Base URL、模型名；先在 AstrBot WebUI 里单独测试模型。

### Docker 内互联失败

两个容器都在 Docker 时，尝试加入同一 Docker 网络后使用：

```text
ws://astrbot:6199/ws
```

## 安全提醒

- 不要公开 token、API Key、服务器 IP、QQ 登录二维码和后台截图
- 不建议用常用 QQ 大号做 bot，也不要把 bot 直接拉进不熟悉的群进行压力测试
- 配置、人设提示词、重要插件数据建议及时备份，修改前先保存旧配置
- 如果你同时使用多个记忆类插件，先确认它们的数据读写范围，避免互相覆盖或重复注入
- 测试完成后，可以把临时放宽的端口规则收紧，只保留实际需要的端口

## 参考资料

- AstrBot 文档：<https://docs.astrbot.app/>
- AstrBot OneBot v11 接入文档：<https://docs.astrbot.app/platform/aiocqhttp.html>
- Bilibili 主页：<https://space.bilibili.com/494350222>

