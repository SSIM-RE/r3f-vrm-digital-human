# VRM Digital Human

基于 React Three Fiber 的 VRM 数字人系统设计

## 设计思路

这个项目探索了如何构建一个**可交互的虚拟数字人**，核心挑战在于：

1. **多模态输出** - 语音（TTS）+ 表情 + 动作
2. **实时响应** - 用户输入后快速反馈
3. **自然交互** - 动作和表情要符合人类习惯

---

## 系统架构

```
用户输入 (语音/文本)
       │
       ▼
┌─────────────────────────────┐
│      前端 (React + R3F)      │
│  • 语音录制 + 转写           │
│  • 调用 AI Agent             │
│  • TTS + 动作 + 表情控制     │
└─────────────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│       外部服务 (可选)        │
│  • TTS (语音合成)           │
│  • DiP (AI 动作生成)        │
│  • Agent (对话理解)         │
└─────────────────────────────┘
```

---

## 核心模块设计

### 1. VRM 渲染层

使用 `@pixiv/three-vrm` 加载 VRM 模型，关键设计：

- **表情控制**：直接调用 `expressionManager.setValue()`，VRM 自动处理权重叠加
- **骨骼动画**：通过 `humanoid.getNormalizedBoneNode()` 获取骨骼引用
- **版本兼容**：VRM 1.0 和 0.x 的骨骼/表情名称略有不同

### 2. TTS 语音合成

设计思路：用**频谱分析**驱动口型同步

- 将音频分为低/中/高频段
- 不同频段对应不同元音口型
- 用音量驱动嘴巴开合程度

### 3. AI 动作生成

两种方案：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 预设动画 (Mixamo) | 稳定、快速 | 动作单一 |
| DiP 生成 | 自然、多样 | 需要 GPU + 模型 |

骨骼映射：将 AI 生成的 22 关节数据映射到 VRM 骨骼

### 4. 状态管理

使用 Zustand 管理 VRM 状态：

```javascript
{
  expressions,      // 当前表情值
  targetExpressions, // 目标表情 (渐变用)
  isSpeaking,       // TTS 播放状态
  animation,        // 当前动画
  lipSyncExpressions // TTS 口型数据
}
```

---

## 技术栈

- React 19 + React Three Fiber
- Three.js + @pixiv/three-vrm
- Zustand (状态管理)
- Vite (构建工具)

---

## 项目结构

```
src/
├── components/      # React 组件
│   ├── VRMAvatar.jsx    # VRM 核心组件
│   └── UI.jsx           # 对话界面
├── hooks/           # 业务逻辑
│   ├── useTTS.js        # 语音合成
│   ├── useDipMotion.js   # AI 动作
│   └── useAudioRecorder.js # 录音
├── stores/          # 状态管理
│   └── useVRMControl.js
└── utils/           # 工具函数
    └── dipAnimator.js    # 骨骼转换
```

---

## 快速开始

```bash
npm install
npm run dev
```

---

## 外部依赖

项目依赖以下外部服务（可选）：

- **TTS**: GPT-SoVITS (端口 9880)
- **动作生成**: DiP in WSL2 (端口 5002)
- **对话**: OpenClaw Agent (端口 18789)

---

## 设计要点总结

1. **VRM 表情是累加的** - 不需要手动计算混合
2. **TTS 状态用 isSpeaking 判断** - 不是口型值
3. **动作优先用预设** - DiP 作为增强
4. **骨骼映射要翻转轴** - HML 和 VRM 坐标系不同

---

## License

MIT