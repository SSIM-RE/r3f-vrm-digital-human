# VRM 数字人系统设计

> 基于 React Three Fiber 的 VRM 虚拟数字人设计文档

---

## 设计目标

构建一个**可交互的虚拟数字人**，实现：
- 语音/文本输入 → AI 对话理解
- TTS 语音输出 + 口型同步
- AI 动作生成 + 表情控制

---

## 核心挑战

| 挑战 | 解决思路 |
|------|----------|
| 多模态同步 | 状态机管理，按时间顺序触发 |
| 实时响应 | 预设动画优先，AI 生成作为增强 |
| 自然动作 | DiP 动作生成 + 骨骼映射 |
| VRM 兼容 | 版本检测 + 条件分支 |

---

## 技术栈

- **前端**: React 19 + React Three Fiber + Vite
- **VRM**: @pixiv/three-vrm
- **状态**: Zustand
- **可选服务**: GPT-SoVITS, DiP, OpenClaw

---

## 项目结构

```
src/
├── components/       # React 组件
│   ├── VRMAvatar.jsx    # VRM 核心（渲染、表情、动画）
│   └── UI.jsx           # 对话界面
├── hooks/            # 业务逻辑
│   ├── useTTS.js        # 语音合成 + 口型同步
│   ├── useDipMotion.js  # AI 动作生成
│   └── useAudioRecorder.js # 录音 + VAD
├── stores/           # 状态管理
│   └── useVRMControl.js
└── utils/            # 工具函数
    └── dipAnimator.js    # 骨骼转换
```

---

## 设计要点

### 1. VRM 表情是累加的
```javascript
// 直接 setValue 即可，VRM 自动处理叠加
vrm.expressionManager.setValue('happy', 0.8);
vrm.expressionManager.setValue('aa', 0.5);
```

### 2. 用 isSpeaking 判断 TTS 状态
```javascript
// 不是用口型值判断！
if (isSpeaking) {
  // TTS 播放中：AI 表情 + TTS 口型
} else {
  // TTS 停止：切换到 neutral
}
```

### 3. 骨骼映射 (HML → VRM)
- HML 22 关节 → VRM 骨骼
- 翻转 Z 轴坐标
- 手掌设为单位四元数
- 跳过前 40 帧避免不稳定

### 4. 动作优先级
- AI 动作 > 用户选择 > Idle
- 使用 fadeIn/fadeOut 平滑过渡

---

## 详细设计

→ 参见 [详细设计文档](docs/design/SYSTEM_DESIGN.md)

包含：
- 完整架构图
- 模块设计详解
- 接口定义
- 技术要点总结

---

## 外部依赖

| 服务 | 作用 | 端点 |
|------|------|------|
| GPT-SoVITS | TTS | 9880 |
| DiP (WSL2) | 动作生成 | 5002 |
| OpenClaw | 对话 | 18789 |

---

## 快速开始

```bash
npm install
npm run dev
```

---

## License

MIT