# XorTime Clone

一个基于番茄工作法的桌面端时间管理应用，灵感来源于 Antonio Fischetti 的 XorTime。

用 Electron + React + SQLite 构建，数据全部存在本地，不联网、不上传。

---

## 功能概览

| 模块 | 说明 |
|------|------|
| 🍅 **番茄钟** | 专注 / 短休息 / 长休息三态循环，必须绑定任务才开始计时。一轮结束时闪烁提示并等待确认，不会自动打断你切换任务 |
| **悬浮窗** | 置顶小窗显示剩余时间，可拖动，单击唤起主窗口。自带独立计时器，切换标签页或最小化都不会卡住 |
| ✓ **任务** | 任务池 + 今日任务两层结构。预估/实际番茄数可调，内外部中断计数，DDL 到期提醒，支持完成、废弃、恢复、每日重复 |
| 📁 **项目** | 项目分组与待办计数，可关闭 / 重新打开 |
| 💡 **收集箱** | 随手记灵感，之后一键转成正式任务 |
| 📊 **统计** | 周/月/年/全部四个维度，柱状图 + 按任务和项目的饼图，区分「已完成」与「打烂」的番茄钟 |
| ⚙ **设置** | 时长、长休息间隔、提示音、滴答声、自动开始休息/番茄钟、最小化到托盘 |

**打烂的番茄钟**：中途重置会计入「打烂」，并记录已经专注的分钟数，不会假装那段时间没发生过。

**每日重复**：任务池里点「每日」开启后，该任务每天自动出现在今日任务列表，无需手动添加。

**软删除**：删除任务只是归档，可在「已废弃」标签里恢复；只有在那里点「永久删除」才会真正抹掉。

---

## 快速开始

### 环境要求

- Node.js ≥ 18（开发时在 v24 上验证）
- npm

### 安装依赖

```bash
git clone https://github.com/dujiajun2023/xortime-clone.git
cd xortime-clone
npm install
```

### 启动方式

**开发模式**（主进程 + 渲染进程热更新）：

```bash
npm run dev
```

**构建后运行**：

```bash
npm run build     # 编译主进程 TS + 打包渲染进程
npm start         # 或 npx electron .
```

**Windows 静默启动**（无黑框窗口）：

双击 `start.vbs` 或 `启动应用.bat`。首次运行会自动构建，之后直接启动已编译产物。
可以把 `start.vbs` 的快捷方式放到桌面或开机启动项。

**打包安装程序**（Windows NSIS）：

```bash
npm run package   # 产物在 release/
```

### 其它命令

```bash
npm run typecheck   # TypeScript 类型检查
```

---

## 数据存储

数据库是一个 SQLite 文件，位于 Electron 的 `userData` 目录：

- **Windows**: `%APPDATA%\xortime-clone\xortime.db`
  （即 `C:\Users\<你的用户名>\AppData\Roaming\xortime-clone\xortime.db`）
- **macOS**: `~/Library/Application Support/xortime-clone/xortime.db`
- **Linux**: `~/.config/xortime-clone/xortime.db`

> ⚠️ 这里存的是你的真实任务和时间记录。**该文件不在版本控制中**（`.gitignore` 已排除 `*.db`），备份请自行复制。

表结构变更会在启动时自动迁移（`PRAGMA table_info` 检测 + `ALTER TABLE`），无需手动执行脚本。

主要数据表：`tasks`、`daily_tasks`、`projects`、`categories`、`next_things`、`pomodoro_sessions`、`settings`。

---

## 项目结构

```
xortime-clone/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 窗口、托盘、悬浮窗、单实例锁
│   │   ├── database.ts          # sql.js 初始化与 schema 迁移
│   │   ├── ipc.ts               # 所有 ipcMain.handle 数据接口
│   │   └── preload.ts           # contextBridge 暴露 window.api
│   └── renderer/                # React 渲染进程
│       ├── App.tsx              # 侧边栏 + 标签页路由
│       ├── components/
│       │   ├── Timer.tsx        # 番茄钟核心状态机
│       │   ├── TaskList.tsx     # 今日任务 + 任务池
│       │   ├── ProjectList.tsx
│       │   ├── NextThings.tsx   # 收集箱
│       │   ├── Stats.tsx        # 统计图表
│       │   └── Settings.tsx
│       ├── public/floating.html # 悬浮窗（独立计时器）
│       └── styles/globals.css
├── build/icon.ico               # 应用与托盘图标
├── start.vbs                    # Windows 静默启动器
└── 启动应用.bat
```

### 技术栈

- **Electron 33** — 桌面外壳，`contextIsolation: true` / `nodeIntegration: false`
- **React 18 + TypeScript** — UI
- **Vite 6** — 渲染进程打包（`base: './'` 以兼容 `file://` 协议）
- **Tailwind CSS 3** — 样式
- **sql.js** — 纯 WASM SQLite，无需原生编译

### 进程通信

渲染进程通过 preload 注入的 `window.api.*` 调用主进程，主进程用 `ipcMain.handle` 响应并读写 SQLite。所有数据库操作都集中在 `ipc.ts`，渲染进程不直接接触文件系统。

---

## 实现要点

几处不那么显然、但踩坑成本很高的设计：

**计时用时间戳而非递减计数**
`endTimeRef` 存绝对结束时间，每次 tick 用 `endTime - Date.now()` 算剩余。这样即使 `setInterval` 被节流或延迟，时间也不会漂移。两个窗口都设了 `backgroundThrottling: false`。

**悬浮窗有自己的计时器**
悬浮窗不只被动接收主窗口推送的字符串——启动时会拿到 `endTime`，然后自己跑 interval。因此切换标签页导致 `Timer` 组件卸载时，悬浮窗依然正常走秒。

**标签页切换后恢复计时状态**
`Timer` 卸载会丢掉 React state，所以运行中的会话（`endTime`、任务、session id、已完成数）会写进 `localStorage`，重新挂载时读回。这里有个 `didMountRef` 守卫：不加的话，首次渲染的 `idle` 状态会抢在恢复逻辑之前把存档清掉。

**生产/开发模式判定**
`isDev = !app.isPackaged && process.argv.includes('--dev')`。只用 `!app.isPackaged` 是不够的——对已构建产物跑 `npx electron .` 时它同样为真，会去加载并不存在的 `localhost:5173`，结果是一片空白窗口。

**单实例锁**
`app.requestSingleInstanceLock()` 防止重复点击图标启动多个进程；第二次启动会退出并唤起已有窗口。

---

## License

MIT
