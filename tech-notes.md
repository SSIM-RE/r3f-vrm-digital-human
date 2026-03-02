# 技术笔记

## React Three Fiber (R3F)

### 核心概念
- R3F 是 Three.js 的 React 封装，提供声明式 3D 场景构建方式
- 使用 React 组件树来描述 3D 场景
- 自动的渲染循环和状态管理

### 关键组件
- `<Canvas>`: 3D 场景的容器组件
- `<mesh>`: 3D 网格对象
- `<useFrame>`: 每帧执行的 hook（相当于动画循环）

### 最佳实践
- 使用 `useFrame` 进行动画更新
- 使用 `useThree` 访问 Three.js 核心（renderer, camera 等）
- 使用 `@react-three/drei` 的工具组件简化开发

## VRM (@pixiv/three-vrm)

### 核心概念
- VRM 是虚拟人模型格式，专为 3D 虚拟形象设计
- 支持骨骼动画、表情、材质变换等

### 关键 API
- `VRMLoaderPlugin`: 加载 VRM 模型
- `VRMAnimation`: VRM 动画数据
- `VRMExpression`: 表情控制
- `VRMHumanoid`: 人体骨骼控制

### 使用流程
```javascript
// 1. 创建加载器
const loader = new GLTFLoader();
loader.register((parser) => new VRMLoaderPlugin(parser));

// 2. 加载模型
const gltf = await loader.loadAsync('/model.vrm');
const vrm = gltf.userData.vrm;

// 3. 添加到场景
scene.add(vrm.scene);

// 4. 更新动画
vrm.update(deltaTime);
```

## TTS 集成 (GPT-SoVITS)

### API 端点
- `POST http://127.0.0.1:9880/tts`

### 请求参数
```json
{
  "text": "要合成的文本",
  "text_lang": "zh",
  "ref_audio_path": "D:\\AI\\OpenClaw\\GPT-SoVITS-v2pro-20250604\\koli_ref.wav",
  "prompt_text": "",
  "prompt_lang": "zh"
}
```

### 响应格式
- 返回音频文件（WAV 格式）

### 注意事项
- 服务需要手动启动
- 参考音频路径必须存在
- 当前仅支持中文

## Zustand 状态管理

### 核心概念
- 简单的 Hook 式状态管理
- 无需 Provider 包裹
- 支持 TypeScript

### 创建 Store
```javascript
import { create } from 'zustand';

const useStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

### 最佳实践
- 将相关状态放在同一个 store
- 使用 immer 处理嵌套状态
- 支持中间件（persist, devtools 等）

## 问题与解决

### 问题: VRM 模型加载后不显示
- 原因: 模型路径错误或灯光不足
- 解决: 检查模型路径，添加环境光和方向光

### 问题: 动画不流畅
- 原因: 没有调用 `vrm.update(deltaTime)`
- 解决: 在 `useFrame` 中每帧更新

### 问题: TTS 服务无响应
- 原因: 服务未启动或端口被占用
- 解决: 检查服务状态，确保端口 9880 可用

### 问题: TTS 与 AI 表情口型切换
- 原因: 原始代码直接覆盖口型，没有叠加
- 解决: 使用 VRM 的自动累加机制
- 关键机制: `morphTargetInfluences += weight × multiplier`

### 问题: TTS 停止后表情切换不自然
- 原因: 直接切换表情，没有过渡
- 解决: 使用 `setTargetExpressions({ neutral: 1 })` 触发自动渐变
- 关键参数: `transitionSpeed` 控制渐变速度（每秒变化量）
