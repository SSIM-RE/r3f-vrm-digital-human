# VRM Digital Human

基于 React Three Fiber 的 VRM 数字人系统，支持 TTS 语音合成和 AI 动作生成。

## 介绍

这是一个 VRM 数字人前端应用，可以加载 VRM 模型，通过 GPT-SoVITS 实现语音合成，使用 DiP (Motion Diffusion Model) 生成 AI 动作。

## 功能特性

- VRM 模型加载与渲染
- TTS 语音合成 (GPT-SoVITS)
- AI 动作生成 (DiP/Motion Diffusion Model)
- 表情系统（开心、悲伤、惊讶等）
- 实时对话交互（接入 OpenClaw Agent）

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

## 服务依赖

| 服务 | 端点 |
|------|------|
| TTS (GPT-SoVITS) | http://127.0.0.1:9880 |
| DiP (动作生成) | http://localhost:5002 |
| OpenClaw Gateway | http://localhost:18789 |

## 项目结构

```
src/
├── components/      # React 组件
│   ├── Experience.jsx   # 3D 场景
│   ├── VRMAvatar.jsx    # VRM 模型组件
│   ├── UI.jsx           # UI 界面
│   └── CameraWidget.jsx # 相机控制
├── hooks/          # 自定义 Hooks
│   ├── useVRM.js        # VRM 加载
│   ├── useTTS.js        # TTS 语音合成
│   ├── useDipMotion.js # DiP 动作生成
│   └── useAgent.js      # AI Agent 调用
├── stores/         # Zustand 状态管理
│   └── useVRMControl.js # VRM 控制状态
└── utils/          # 工具函数
    ├── dipAnimator.js   # 骨骼动画转换
    └── motionBuffer.js  # 动作缓冲区
```

## 技术栈

- React 19.0.0
- Three.js 0.173.0
- React Three Fiber 9.0.4
- @pixiv/three-vrm 3.4.0
- Zustand 5.0.11

## License

MIT