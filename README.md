# VRM Digital Human

React + React Three Fiber + DiP 动作生成的 VRM 数字人系统

---

## 功能特性

- VRM 模型加载与渲染
- TTS 语音合成 (GPT-SoVITS)
- AI 动作生成 (DiP/Motion Diffusion Model)
- 表情系统
- 实时对话交互

---

## 技术栈

- React 19.0.0
- Three.js 0.173.0
- React Three Fiber 9.0.4
- @pixiv/three-vrm 3.4.0
- Zustand 5.0.11

---

## 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

---

## 服务依赖

| 服务 | 端点 | 说明 |
|------|------|------|
| TTS | http://127.0.0.1:9880 | GPT-SoVITS |
| DiP | http://localhost:5002 | WSL2 动作生成 |

---

## 项目结构

```
├── src/              # 前端源码
├── server/           # 后端服务
├── public/           # VRM 模型
├── docs/             # 设计文档
└── package.json
```

---

## License

MIT