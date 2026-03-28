# 项目技术信息

> 最后更新: 2026-03-28

---

## 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.0.0 | UI 框架 |
| Three.js | 0.173.0 | 3D 渲染 |
| React Three Fiber | 9.0.4 | React + Three.js |
| @pixiv/three-vrm | 3.4.0 | VRM 模型 |
| Zustand | 5.0.11 | 状态管理 |
| Vite | 6.2.0 | 构建工具 |

---

## 系统架构

```
用户语音输入
      │
      ▼
┌─────────────────────────────────────┐
│  前端 (React + R3F)                │
│  • 录音 → Whisper (端口 5000)      │
│  • 调用 Mico Agent                 │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  OpenClaw Gateway (端口 18789)    │
│  → Mico VRM Agent                  │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  Mico VRM Agent                    │
│  返回: { text, emotion, action }  │
└─────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────┐
│  前端执行                           │
│  • TTS: GPT-SoVITS (9880)          │
│  • 动作: DiP (5002)                │
│  • 表情: VRM 表情系统               │
└─────────────────────────────────────┘
```

---

## 依赖服务

| 服务 | 端点 | 路径 |
|------|------|------|
| TTS (GPT-SoVITS) | http://127.0.0.1:9880 | D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604 |
| Mico Agent | /v1/responses (代理到 18789) | OpenClaw Gateway |
| DiP (WSL2) | http://localhost:5002 | /home/ssim/motion-diffusion-model |

---

## 项目结构

```
r3f-vrm-final-main/
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── hooks/              # 自定义 Hooks
│   ├── stores/             # Zustand 状态
│   └── utils/              # 工具函数
├── server/                 # 后端服务
├── public/                 # 静态资源
│   └── models/             # VRM 模型 + 动画
├── docs/                   # 设计文档
├── package.json
└── vite.config.js
```

---

## 关键 API

### TTS
```
POST http://127.0.0.1:9880/tts
{
  "text": "文本",
  "text_lang": "zh",
  "ref_audio_path": "D:\\AI\\...\\koli_ref.wav"
}
```

### DiP
```
POST http://localhost:5002/api/generate
{ "prompt": "动作描述", "duration": 10 }
```

---

## 技术要点

### VRM 表情叠加
- VRM 每帧自动清零 + 累加 morphTargetInfluences
- 直接 setValue 即可

### DiP 骨骼转换
- 翻转 Z 轴
- 手掌骨骼 = 单位四元数
- 交换左右手臂索引

---

## 待决策

- [ ] 音频播放队列机制
- [ ] 口型同步算法
- [ ] 表情预设系统