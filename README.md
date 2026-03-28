# VRM 虚拟数字人 × OpenClaw

## 项目介绍

这是一个集成 OpenClaw Agent 的 VRM 虚拟形象设计雏形。

在人与虚拟形象交互时，我们希望虚拟形象不仅仅是"能看"，更希望它能"会听、会说、有表情、有动作"。这个项目探索了一种实现思路：将 OpenClaw Agent 作为"大脑"，结合前端技术控制虚拟形象的语音、表情和动作，实现自然的人机交互。

---

## 功能说明

这个虚拟形象能做什么：

| 功能 | 说明 |
|------|------|
| **智能对话** | 用户通过语音或文本输入，OpenClaw Agent 理解意图后返回结构化回复 |
| **语音输出** | 将 Agent 返回的文本通过 TTS 转为语音，虚拟形象同步播放 |
| **表情变化** | 解析 Agent 返回的情绪指令，平滑过渡到对应表情 |
| **动作配合** | 解析动作指令，播放预设动画或 AI 生成动作 |
| **口型同步** | 分析 TTS 音频，实时驱动虚拟形象的嘴型 |

---

## 设计结构

### 数据流

```
用户输入 (语音/文本)
       │
       ▼
┌─────────────────────────────┐
│      OpenClaw Agent         │
│   返回: {voiceText,        │
│          emotion,          │
│          actions,          │
│          expressions}      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│              前端处理                   │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ TTS      │ │ 表情控制 │ │ 动作   │ │
│  │ 语音+口型│ │ setValue │ │ 播放   │ │
│  └──────────┘ └──────────┘ └────────┘ │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│         VRMAvatar          │
│    (虚拟形象渲染呈现)       │
└─────────────────────────────┘
```

### 详细流程

```
Step 1: 用户输入
  ├── 语音: 录音 → VAD 检测静音 > 800ms 自动停止
  └── 文本: 直接输入

Step 2: Agent 处理
  └── 发送输入 → OpenClaw 返回结构化数据

Step 3: 前端响应
  ├── TTS: 发起请求 → 播放音频 → 分析频谱 → 口型同步
  ├── 表情: setTargetExpressions() → updateExpressions() 渐变
  └── 动作: executeAction() → 播放动画 → 定时切换回 Idle
```

---

## 模块说明

| 模块 | 职责 | 核心功能 |
|------|------|----------|
| **VRMAvatar** | 虚拟形象渲染 | 模型加载、骨骼动画、表情控制、眨眼逻辑 |
| **useVRMControl** | 状态管理 | 表情渐变、动作队列、参数配置 |
| **useTTS** | 语音合成 | TTS 调用、音频分析、口型同步 |
| **useDipMotion** | AI 动作生成 | DiP 调用、骨骼映射、帧应用 |
| **useAudioRecorder** | 录音功能 | 麦克风录音、VAD 自动截断 |

---

## 技术栈

| 技术 | 用途 |
|------|------|
| React + React Three Fiber | 前端框架 |
| @pixiv/three-vrm | VRM 渲染 |
| Zustand | 状态管理 |
| Vite | 构建工具 |

---

## 相关技术介绍

### VRM

VRM 是虚拟形象专用的 3D 模型格式，广泛应用于虚拟主播、游戏等领域。

- **官网**: https://vrm-c.github.io/

### TTS (语音合成)

Text-to-Speech，将文字转换为语音。

- **本项目使用**: GPT-SoVITS
- **项目地址**: https://github.com/RVC-Boss/GPT-SoVITS

### DiP (Diffusion Planner)

基于 diffusion 模型的 AI 动作生成技术。

- **输入**: 动作描述文本 (如 "wave hand")
- **输出**: 动作序列数据
- **项目地址**: https://github.com/MotionDiffusionModel/MotionDiffusionModel

---

## 相关项目

| 项目 | 地址 |
|------|------|
| VRM 渲染库 | https://github.com/pixiv/three-vrm |
| GPT-SoVITS | https://github.com/RVC-Boss/GPT-SoVITS |
| DiP 动作模型 | https://github.com/MotionDiffusionModel/MotionDiffusionModel |

---

*更多技术细节见 [详细设计文档](docs/design/SYSTEM_DESIGN.md)*