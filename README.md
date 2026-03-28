# VRM Digital Human

基于 React Three Fiber 的 VRM 数字人系统，支持 TTS 语音合成和 AI 动作生成。

## 功能特性

- VRM 模型加载与渲染
- TTS 语音合成 (GPT-SoVITS)
- AI 动作生成 (DiP/Motion Diffusion Model)
- 表情系统
- 实时对话交互

## 技术栈

- React 19.0.0
- Three.js 0.173.0
- React Three Fiber 9.0.4
- @pixiv/three-vrm 3.4.0
- Zustand 5.0.11

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 服务依赖

启动项目前需要运行以下服务：

| 服务 | 端点 |
|------|------|
| TTS (GPT-SoVITS) | http://127.0.0.1:9880 |
| DiP (动作生成) | http://localhost:5002 |

## 项目结构

```
r3f-vrm-digital-human/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── hooks/             # 自定义 Hooks
│   ├── stores/            # Zustand 状态管理
│   └── utils/             # 工具函数
├── server/                 # 后端服务
├── public/                 # 静态资源 (VRM 模型)
├── docs/                   # 设计文档
└── package.json
```

## License

MIT