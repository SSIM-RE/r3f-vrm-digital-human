# M5 - 动画系统优化 总体方案

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VRM 数字人系统架构                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐ │
│  │    AI       │────→│  前端        │────→│  Flask API  │────→│    DiP      │ │
│  │  (动作序列)  │     │  (缓冲播放)  │     │  (生成服务)  │     │  (动作生成)  │ │
│  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘ │
│       │                   │                   │                   │          │
│       │  actions:         │                   │                   │          │
│       │  ["wave",         │                   │                   │          │
│       │   "nod",          │                   │                   │          │
│       │   "idle", ...]    │                   │                   │          │
│       │                   │                   │                   │          │
│       ▼                   ▼                   ▼                   ▼          │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         动作缓冲区 (Queue Size = 6)                      │   │
│  │                                                                          │   │
│  │   待生成队列          已生成缓冲区              当前播放                   │   │
│  │   ┌─────────┐        ┌─────────┐          ┌─────────┐                 │   │
│  │   │ nod     │────生成→│ nod     │────出队→│ wave    │                 │   │
│  │   │ happy   │        │ idle    │          │ (播放中) │                 │   │
│  │   │ idle    │        │ idle    │          └─────────┘                 │   │
│  │   │ idle    │        │ idle    │                │                      │   │
│  │   └─────────┘        │ idle    │                ▼                      │   │
│  │                       │ idle    │          播放 nod                     │   │
│  │   (可覆盖)           └─────────┘                │                      │   │
│  │                              ↑                   ▼                      │   │
│  │                              │             播放 idle                    │   │
│  │                              └──────────────────────                    │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 工作流程

### 2.1 完整流程

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              动作生成与播放流程                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. AI 返回响应                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ { text: "你好！", actions: ["wave", "nod", "idle", "idle", "idle"] }  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  2. 动作入队 + 覆盖待生成队列                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ pendingQueue = ["wave", "nod", "idle", "idle", "idle"]  (覆盖)        │   │
│  │ generatedBuffer = []  (保持不变)                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  3. 检测缓冲区 < 6，触发生成                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ if (generatedBuffer.length < 6 && !isGenerating) {                    │   │
│  │   const prompt = pendingQueue.shift();                                │   │
│  │   generateMotion(prompt, lastFrame);                                  │   │
│  │ }                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  4. DiP 生成动作 (Flask API)                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ POST /api/generate-motion                                              │   │
│  │ { prompt: "wave hand", context: lastFrame }                          │   │
│  │                                                                       │   │
│  │ DiP autoregressive 模式:                                               │   │
│  │ - 使用 context (上一动作最后20帧) 自动衔接                             │   │
│  │ - 返回 npy 数据 (40帧 = 2秒)                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  5. 转换 + 入缓冲区                                                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ - npy → VRM 骨骼动画                                                   │   │
│  │ - 保存最后20帧 (用于下一次衔接)                                         │   │
│  │ - generatedBuffer.push(motion)                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                    │                                           │
│                                    ▼                                           │
│  6. 播放循环                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │ while (true) {                                                         │   │
│  │   if (generatedBuffer.length > 0) {                                   │   │
│  │     motion = generatedBuffer.shift();                                 │   │
│  │     playAnimation(motion);                                            │   │
│  │     await sleep(motion.duration);                                     │   │
│  │   } else {                                                             │   │
│  │     playIdle();  // 缓冲区为空，播放 idle                            │   │
│  │   }                                                                    │   │
│  │   checkAndGenerate();  // 同时检测是否需要生成                         │   │
│  │ }                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 动作覆盖场景

```
场景：正在播放 "wave"，新 AI 返回

时间线：
────────────────────────────────────────────────────────────────────────────────→

t=0:  当前: wave (播放中)    缓冲区: [nod, idle, idle, idle, idle, idle]
      待生成: [idle, idle]

t=0:  AI 新返回: "今天天气不错" + ["nod", "happy", "idle", "idle", "idle"]

t=0:  覆盖后:
      pendingQueue = ["nod", "happy", "idle", "idle", "idle"]  ← 完全替换
      generatedBuffer = [nod, idle, idle, idle, idle, idle]    ← 保持不变
      currentMotion = "wave" ← 继续播放完成

t=2:  wave 播放完成，继续播放 nod, happy, idle, ... (新序列)
```

---

## 3. 数据结构

### 3.1 动作项

```javascript
// 单个动作项
motionItem = {
  name: 'wave',           // 动作名称
  prompt: 'wave hand',    // DiP 提示词
  duration: 2000,         // 持续时间 (ms)
  npyData: Float32Array,  // VRM 动画数据 (22 bones × 3 × 40 frames)
  lastFrames: number[],   // 最后20帧 (用于动作衔接)
};
```

### 3.2 状态管理

```javascript
// useMotionControl store
const useMotionControl = create((set, get) => ({
  // 待生成队列 (来自 AI，可覆盖)
  pendingQueue: [],
  
  // 已生成缓冲区 (固定6个)
  generatedBuffer: [],
  
  // 当前播放动作
  currentMotion: null,
  
  // 上一动作最后20帧 (用于 DiP 衔接)
  lastMotionFrames: null,
  
  // 上一动作名称
  lastActionName: null,
  
  // DiP 是否正在生成
  isGenerating: false,
  
  // 缓冲区大小
  BUFFER_SIZE: 6,
  
  // 动作时长 (ms)
  MOTION_DURATION: 2000,
})));
```

---

## 4. API 设计

### 4.1 Flask API 端点

```python
# server/dip_api.py

@app.route('/api/generate-motion', methods=['POST'])
def generate_motion():
    """
    生成动作
    
    请求:
    {
        "prompt": "wave hand",           # 动作提示词
        "context": [0.1, 0.2, ...],      # 可选：上一动作最后20帧 (263维/帧)
        "num_steps": 10,                 # 可选：扩散步数 (默认10)
        "guidance": 7.5                  # 可选：引导参数 (默认7.5)
    }
    
    响应:
    {
        "success": true,
        "name": "wave",
        "npy_data": [...],               # VRM 动画数据
        "last_frames": [...],             # 最后20帧 (用于衔接)
        "duration": 2000,                # 时长 (ms)
        "fps": 20
    }
    """
    pass
```

### 4.2 DiP 命令行

```bash
# 实际调用方式
python -m sample.generate \
  --model_path save/target_10steps_context20_predict40/model000200000.pt \
  --autoregressive \
  --text_prompt "wave hand" \
  --context_len 20 \
  --pred_len 40 \
  --motion_length 2 \
  --guidance_param 7.5 \
  --num_samples 1
```

---

## 5. npy 数据格式

### 5.1 DiP 输出格式

```
Shape: (batch, joints, features, frames)
     = (1, 22, 3, 40)

- 22 joints: 人体骨架关节点
- 3: XYZ 坐标
- 40 frames: 2秒 @ 20fps
```

### 5.2 VRM 骨骼映射

```javascript
// utils/mixamoVRMRigMap.js - 已有
export const mixamoVRMRigMap = {
  Hips: 'hips',
  Spine: 'spine',
  Chest: 'chest',
  Neck: 'neck',
  Head: 'head',
  LeftShoulder: 'leftShoulder',
  LeftArm: 'leftArm',
  LeftForeArm: 'leftForeArm',
  LeftHand: 'leftHand',
  RightShoulder: 'rightShoulder',
  RightArm: 'rightArm',
  RightForeArm: 'rightForeArm',
  RightHand: 'rightHand',
  LeftUpLeg: 'leftUpLeg',
  LeftLeg: 'leftLeg',
  LeftFoot: 'leftFoot',
  RightUpLeg: 'rightUpLeg',
  RightLeg: 'rightLeg',
  RightFoot: 'rightFoot',
};
```

---

## 6. 任务分解

### 6.1 任务清单

| 任务 | 说明 | 状态 |
|------|------|------|
| 5.1 | Flask API 封装 DiP | 待开始 |
| 5.2 | npy → VRM 骨骼转换 | 待开始 |
| 5.3 | 前端动作缓冲区实现 | 待开始 |
| 5.4 | 动作播放与生成同步 | 待开始 |
| 5.5 | 动作队列覆盖机制 | 待开始 |
| 5.6 | 动作与 TTS 同步 | 待开始 |

### 6.2 优先级

1. **高优先级**
   - Flask API 封装 DiP
   - npy → VRM 转换
   - 动作缓冲区实现

2. **中优先级**
   - 动作播放与生成同步
   - 动作队列覆盖机制

3. **低优先级**
   - 动作与 TTS 同步

---

## 7. 动作提示词映射

### 7.1 AI 动作 → DiP 提示词

```javascript
const actionToPrompt = {
  'wave': 'wave hand',
  'nod': 'nod head',
  'shake': 'shake head',
  'happy': 'jump',
  'think': 'think',
  'point': 'point',
  'dance': 'dance',
  'greet': 'wave hand',
  'idle': 'stand still',
  'listen': 'stand still',
  'talk': 'standing',
  'greeting': 'wave hand',
};
```

---

## 8. 关键机制说明

### 8.1 缓冲区机制

- **大小**: 固定 6 个动作
- **触发条件**: 缓冲区 < 6 且不在生成中
- **填充策略**: 从待生成队列取，队列为空则生成 idle

### 8.2 动作衔接

- **机制**: DiP autoregressive 模式
- **实现**: 使用上一动作最后 20 帧作为 prefix
- **参数**: --context_len 20 --pred_len 40

### 8.3 队列覆盖

- **触发**: 新 AI 响应到达
- **覆盖**: 待生成队列完全替换
- **保持**: 已生成缓冲区、当前播放动作不变

---

## 9. 注意事项

1. **首次生成**: DiP 从数据集采样初始姿态
2. **动作时长**: 每段 2 秒 (40帧 @ 20fps)
3. **生成时间**: 约 2-4 秒/动作
4. **缓冲区**: 6 个动作 ≈ 12 秒，可覆盖生成时间
5. **错误处理**: DiP 生成失败时使用 idle

---

## 10. 参考文档

- DiP: `D:\AI\motion-diffusion-model\DiP.md`
- MDM: `D:\AI\motion-diffusion-model\README.md`
- 生成代码: `D:\AI\motion-diffusion-model\sample\generate.py`
