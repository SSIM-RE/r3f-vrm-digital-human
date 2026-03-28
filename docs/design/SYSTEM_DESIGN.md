# VRM 数字人系统设计文档

> 详细设计思路和技术实现说明

---

## 一、系统概述

### 1.1 目标

构建一个可交互的 VRM 虚拟数字人，实现：
- 语音/文本输入
- AI 对话理解
- TTS 语音输出 + 口型同步
- AI 动作生成 + 表情控制

### 1.2 核心挑战

| 挑战 | 描述 | 解决思路 |
|------|------|----------|
| 多模态同步 | 语音、动作、表情需要协调 | 状态机管理，按时间顺序触发 |
| 实时响应 | 用户输入后快速反馈 | 预设动画优先，AI 生成作为增强 |
| 自然动作 | AI 动作要符合人类习惯 | DiP 动作生成 + 骨骼映射 |
| VRM 兼容性 | 不同版本骨骼/表情不同 | 版本检测 + 条件分支 |

---

## 二、架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     用户输入层                           │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                  │
│  │ 麦克风  │  │ 文本输入 │  │ 快捷短语 │                  │
│  └────┬────┘  └────┬────┘  └────┬────┘                  │
└───────┼───────────┼───────────┼────────────────────────┘
        │           │           │
        ▼           ▼           ▼
┌─────────────────────────────────────────────────────────┐
│                     处理层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ Whisper     │  │ OpenClaw    │  │ 状态管理    │     │
│  │ 语音转文字   │  │ Agent 对话  │  │ Zustand     │     │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘     │
└─────────┼────────────────┼────────────────┼─────────────┘
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                     输出层                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ TTS        │  │ DiP         │  │ VRM         │     │
│  │ 语音+口型   │  │ 动作生成    │  │ 表情+动作   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
用户输入 → 转写/直接输入 → Agent 分析 → 返回 {text, emotion, action}
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
              TTS 语音合成              表情设置                    动作执行
                    │                         │                         │
                    ▼                         ▼                         ▼
              音频播放 +            setTargetExpressions      executeAction
              口型同步                (渐变过渡)                  (预设/DiP)
```

---

## 三、模块设计

### 3.1 VRM 渲染模块 (VRMAvatar.jsx)

#### 核心职责
- 加载 VRM 模型
- 应用骨骼动画
- 控制表情和口型

#### 关键设计

**1. VRM 版本检测**
```javascript
const isVRM1 = userData.vrm.meta?.metaVersion === "1";
```

**2. 骨骼获取**
```javascript
const bone = vrm.humanoid.getNormalizedBoneNode(boneName);
```

**3. 表情控制（累加机制）**
```javascript
// VRM 每帧自动执行：
// 1. 清零 morphTargetInfluences
// 2. 依次累加每个表情的权重
// 所以直接 setValue 即可，VRM 自动处理叠加
vrm.expressionManager.setValue('happy', 0.8);
vrm.expressionManager.setValue('aa', 0.5); // 自动叠加
```

**4. 动画系统**
- 预设动画（Mixamo FBX）优先
- DiP 生成作为增强
- 使用 `crossfade` 平滑过渡

#### 状态切换逻辑
```
┌──────────┐   执行动作   ┌──────────┐   动作结束   ┌──────────┐
│ Idle动画  │ ──────────→ │ 动作动画  │ ──────────→ │ Idle动画  │
└──────────┘              └──────────┘              └──────────┘
     ↑                         │
     └─────────────────────────┘
         (animationFadeTime 过渡)
```

### 3.2 状态管理模块 (useVRMControl.js)

#### Store 结构
```javascript
{
  // 表情
  expressions: { happy: 0, sad: 0, ... },
  targetExpressions: { happy: 0, ... },  // 渐变目标
  
  // 动作
  animation: null,  // 当前动画名
  actionTimer: null, // 动作定时器
  
  // TTS
  isSpeaking: false,
  lipSyncExpressions: { aa: 0, ih: 0, ... },
  
  // 控制参数
  lipSyncScale: 0.5,      // TTS 口型幅度
  maxEmotionScale: 1.0,   // 表情上限
  transitionSpeed: 3,     // 渐变速度
  animationFadeTime: 1.5  // 动画过渡时间
}
```

#### 核心方法

**表情渐变**
```javascript
updateExpressions: (deltaTime) => {
  // 每帧调用
  // current += (target - current) * speed * deltaTime
}
```

**动作执行**
```javascript
executeAction: (actionName, expressions, duration) => {
  // 1. 设置动画
  // 2. 设置目标表情
  // 3. 设置定时器，结束后切回 Idle
}
```

### 3.3 TTS 模块 (useTTS.js)

#### 设计思路

用**频谱分析**驱动口型，而非简单的音量检测：

```
音频频谱
   │
   ├── 低频 (0-1300Hz) → aa (啊)
   ├── 中频 (1300-4300Hz) → ih, ee
   └── 高频 (4300+) → oh, ou
```

#### 实现流程
```
1. AudioContext + AnalyserNode 获取频域数据
2. 分频段计算能量
3. 映射到 VRM 口型 (aa, ih, ee, oh, ou)
4. 通过 lipSyncCallback 传给 VRM 组件
```

#### 关键代码
```javascript
const analyzeAudio = () => {
  const dataArray = new Uint8Array(frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);
  
  // 计算各频段平均值
  const lowAvg = ...; // 低频能量
  const midAvg = ...; // 中频能量
  const highAvg = ...; // 高频能量
  
  // 映射到口型
  const aa = volume * lipSyncScale;
  // ...
  
  lipSyncCallback({ aa, ih, ee, oh, ou });
};
```

#### TTS 结束处理
```javascript
// 用 isSpeaking 判断，不是口型值
if (isSpeaking) {
  // TTS 播放中：AI 表情 + TTS 口型叠加
} else {
  // TTS 停止：切换到 neutral
  setTargetExpressions({ neutral: 1 });
}
```

### 3.4 DiP 动作模块 (useDipMotion.js)

#### 设计思路

DiP (Diffusion Planner) 是动作生成模型，输出格式：
- `(帧数, 22关节, 3坐标)` 位置数据
- 需要转换为 VRM 骨骼旋转

#### 数据流
```
DiP Server (WSL2)
    │
    ▼
{ motion: [[x,y,z], ...], joints: 22, frames: 200 }
    │
    ▼
骨骼映射 (dipAnimator.js)
    │
    ▼
VRM 骨骼旋转
    │
    ▼
逐帧应用 (applyDipFrame)
```

#### 骨骼映射 (HML → VRM)

HumanML3D 22 关节顺序：
```
0:Hips, 1:RightUpperLeg, 2:RightLowerLeg, 3:RightFoot,
4:LeftUpperLeg, 5:LeftLowerLeg, 6:LeftFoot,
7:Spine, 8:Chest, 9:Neck, 10:Head,
11:RightUpperArm, 12:RightLowerArm, 13:RightHand,
14:LeftUpperArm, 15:LeftLowerArm, 16:LeftHand,
17:LeftEye, 18:RightEye, 19:Jaw, 20:LeftToes, 21:RightToes
```

VRM 骨骼名称：
```javascript
const HML_TO_VRM = [
  'hips',           // 0
  'rightUpperLeg',  // 1
  'rightLowerLeg',  // 2
  'rightFoot',      // 3
  'leftUpperLeg',   // 4
  'leftLowerLeg',   // 5
  'leftFoot',       // 6
  'spine',          // 7
  'chine',          // 8 (VRM 0.x) / 'chest' (VRM 1.0)
  'neck',           // 9
  'head',           // 10
  'rightUpperArm',  // 11
  'rightLowerArm',  // 12
  'rightHand',      // 13
  'leftUpperArm',   // 14
  'leftLowerArm',   // 15
  'leftHand',       // 16
];
```

#### 关键转换

**1. 坐标系翻转**
```javascript
// HML 是 Y-up，VRM 也是 Y-up
// 但 Z 轴方向可能不同
[x, y, z] → [x, y, -z]  // 根据实际测试调整
```

**2. 位置转旋转（简化版）**
```javascript
// 用相邻关节的位置差计算方向
direction = joint[i+1] - joint[i];
quaternion.setFromUnitVectors(up, direction.normalize());
```

**3. 手掌处理**
```javascript
// 手掌骨骼设为单位四元数（无旋转）
// 由前臂决定手掌方向
hand.quaternion.set(0, 0, 0, 1);
```

#### 服务端优化
- **跳过前 40 帧**：DiP 生成的动作前几帧不稳定
- **最低 10 秒**：避免动作太短影响体验
- **序列生成**：支持连续动作无缝过渡

### 3.5 录音模块 (useAudioRecorder.js)

#### 设计思路

使用 **VAD (Voice Activity Detection)** 自动截断：

```
┌─────────────────────────────────────────┐
│           录音流程                       │
├─────────────────────────────────────────┤
│ 1. 麦克风录音 (MediaRecorder)            │
│ 2. 实时分析音量 (AudioContext + Analyser)│
│ 3. 音量 > 阈值 → 继续录音                 │
│ 4. 静音 > 800ms → 自动停止               │
│ 5. 生成 Blob → 发送到后端               │
└─────────────────────────────────────────┘
```

#### 参数配置
```javascript
VAD_THRESHOLD = 15;      // 音量阈值
VAD_INTERVAL = 50;       // 检测间隔 (ms)
SILENCE_THRESHOLD = 800; // 静音阈值 (ms)
```

---

## 四、接口设计

### 4.1 Agent 返回格式

```javascript
{
  "voiceText": "简短回复（用于 TTS）",
  "text": "详细回复（用于展示）",
  "emotion": "happy",      // 情绪
  "actions": ["wave", "nod"], // 动作数组（新版）
  "expressions": { happy: 1 } // 表情（可选）
}
```

### 4.2 动作到动画映射

```javascript
const actionAnimationMap = {
  wave: 'Waving',
  nod: 'Lengthy Head Nod',
  shake: 'Shrugging',
  think: 'Thinking',
  idle: 'Breathing Idle',
};
```

---

## 五、技术要点总结

### 5.1 VRM 表情机制
- VRM 每帧自动清零 + 累加 `morphTargetInfluences`
- 直接 `setValue` 即可，不需要手动计算

### 5.2 TTS 状态判断
- 用 `isSpeaking` 判断播放状态，不是口型值
- 静音 ≠ TTS 停止

### 5.3 动画优先级
- AI 动作 > 用户选择 > Idle 动画
- 使用 fadeIn/fadeOut 平滑过渡

### 5.4 DiP 骨骼转换
- 跳过前 40 帧避免不稳定
- 手掌设为单位四元数
- 需要根据实际测试调整翻转轴

---

## 六、扩展方向

1. **动作平滑过渡** - DiP 连续动作之间添加过渡帧
2. **口型同步算法** - 使用更精确的频谱映射
3. **表情预设系统** - 预设情绪组合
4. **多语言支持** - TTS 和动作提示词多语言

---

## 七、依赖服务

| 服务 | 作用 | 端点 |
|------|------|------|
| GPT-SoVITS | TTS 语音合成 | http://127.0.0.1:9880 |
| DiP (WSL2) | AI 动作生成 | http://localhost:5002 |
| OpenClaw | AI 对话 | http://localhost:18789 |
| Whisper (可选) | 语音转文字 | http://localhost:5000 |

---

*设计文档 - 记录核心思路和技术决策*