# r3f-vrm-final-main 进度追踪

## 项目概览
- 进度: 80% (6/8)
- 状态: 🟢 进行中
- 当前里程碑: M5 - DiP 动作集成
- 最后更新: 2026-03-18 20:51

## 今日工作 (2026-03-18) - DiP 动作集成完成
- [x] 对比 DiP API 数据与 npy 文件格式，确认格式完全一致
- [x] 决定不翻转 Z 轴（与 DiP 原始输出一致）
- [x] 去掉动作名称映射，直接使用用户输入
- [x] 简化 DiP 服务端命令参数
- [x] **修复手掌骨骼：设置为无旋转（单位四元数）**
- [x] 同步修改 vrm-bone-test 项目
- [x] **动作播放正常！**

## 经验教训
### 2026-03-18 - DiP 数据格式
- **发现**: API 返回数据和 npy 文件格式完全相同
- **结论**: 服务端只做了 transpose 转换，无坐标变换
- **决策**: 前端不翻转 Z 轴，与 DiP 原始输出一致

### 2026-03-18 - 手掌方向
- **问题**: 手掌动作不自然
- **解决**: 设置手掌骨骼为无旋转（单位四元数），由小臂决定方向

## 技术要点
### DiP 服务端命令
```bash
python -m sample.generate \
  --model_path save/dip/model.pt \
  --autoregressive \
  --guidance_param 7.5 \
  --text_prompt "动作描述" \
  --num_samples 1 \
  --output_dir /tmp/xxx
```

### 骨骼转换关键点
- 不翻转 Z 轴
- 手掌骨骼 quaternion = (0, 0, 0, 1) 单位四元数
- [x] 修复异步问题：使用 ref 存储 motionData
- [x] 修复 useCallback 依赖问题
- [x] **修复动画冲突**：添加 window.vrmForDipPlaying 标志，播放 DiP 时暂停 VRM 内置动画

## 经验教训
### 2026-03-18 下午 - DiP 方向问题诊断
- **问题**: VRM 手臂挥动方向错误
- **诊断过程**:
  1. 对比两个项目源码，发现：
     - vrm-bone-test: 只翻转 Z 轴
     - r3f-vrm-final-main: 尝试翻转 X 和 Z
     - VRM 有 rotation-y 导致方向不一致
  2. 修复:
     - 还原为只翻转 Z 轴
     - 移除 VRM rotation-y
     - 默认模型改为 Mico_V2.vrm
     - 移除调试代码
     - 添加 VRM 就绪检查

### 2026-03-18 上午
- **问题**: DiP 动作不生效
- **根因**: VRMAvatar useFrame 动画系统与 DiP 骨骼设置冲突
- **解决**: 添加 window.vrmForDipPlaying 标志跳过动画
- **问题**：DiP 动作不生效
- **根因**：VRMAvatar 的 useFrame 一直在用动画系统更新骨骼，和 DiP 的手动骨骼设置冲突
- **解决**：添加 window.vrmForDipPlaying 标志，检测到 DiP 播放时跳过动画系统
- [x] M4 TTS 语音合成集成完成并验证通过
- [x] 讨论 M5 动作生成方案
- [x] 确认动作生成与播放架构（缓冲区 + 边播边生成）
- [x] 确认队列覆盖机制
- [x] 验证 DiP autoregressive 机制（查阅官方文档）
- [x] 生成 M5 总体方案文档
- [x] 更新 decisions.md
- [x] 接管项目 r3f-vrm-final-main
- [x] 初始化项目追踪文件（progress.md, issues.md, decisions.md, tech-notes.md）
- [x] 同步设计文档（MICO_IMPLEMENTATION_PLAN.md）
- [x] 修复启动脚本路径问题
- [x] 成功启动所有服务（GPT-SoVITS, Whisper, WebSocket, Frontend）
- [x] 理解 VRM 表情叠加机制（VRM 自动累加 `morphTargetInfluences`）
- [x] 实现 TTS 与表情的完整切换逻辑
  - TTS 播放时：AI 表情 + TTS 口型叠加
  - TTS 停止时：平滑切换到 neutral
- [x] 整理经验到 issues.md 和 AGENTS.md
- [x] WSL2 Ubuntu 迁移到 D盘
- [x] MDM 环境部署完成
- [x] 成功运行 MDM 生成动作
- [x] 学习 MDM 和 DiP 技术原理
- [x] 讨论 MDM 实际应用场景和动作过渡方案

## 项目目标
开发一个集成 TTS 语音合成和动画的 VRM 数字人前端系统。

## 里程碑

### 已完成
- [x] M1: 基础架构搭建
  - React + R3F + VRM 环境配置
  - 项目结构初始化
  - 完成时间: 2026-02-24

- [x] M2: VRM 模型加载与渲染
  - VRM 模型加载
  - 基础渲染实现
  - 完成时间: 2026-02-24

- [x] M3: 基础动画系统
  - VRM 动画控制
  - 表情系统
  - 完成时间: 2026-02-24

- [x] M4: TTS 语音合成集成
  - 集成 GPT-SoVITS TTS 服务
  - 实现文本转语音 API 调用
  - 音频播放与口型同步
  - TTS 与 AI 表情切换逻辑
  - 完成时间: 2026-03-03

### 进行中
- [x] M5: DiP 动作集成
  - DiP API 集成完成
  - 骨骼转换逻辑完成
  - 动作播放正常 ✓

### 待开始
- [ ] M5: 动画系统优化
  - 动作平滑过渡
  - 连续动作生成

### 待开始
- [ ] M5: 动画系统优化
  - 嘴型动画与语音同步
  - 表情动态生成
  - 动作过渡优化

- [ ] M6: 性能优化与部署
  - 性能分析
  - 资源优化
  - 生产环境部署

## 任务清单

### M4 - TTS 语音合成集成
- [ ] 任务4.1: TTS API 集成
  - 创建 TTS 服务模块
  - 实现 API 请求封装
- [ ] 任务4.2: 音频播放系统
  - 音频加载与播放
  - 音频状态管理
- [ ] 任务4.3: 口型同步
  - 音频分析
  - 口型参数映射
  - VRM 口型控制

### M5 - 动画系统优化
- [ ] 任务5.1: 嘴型动画优化
- [ ] 任务5.2: 表情系统优化
- [ ] 任务5.3: 动作生成 (MDM/DiP)
  - [ ] 任务5.3.1: DiP 模型下载与部署
  - [ ] 任务5.3.2: Flask API 封装
  - [ ] 任务5.3.3: npy 数据转换为 VRM 骨骼
  - [ ] 任务5.3.4: 动作与 TTS 同步
  - [ ] 任务5.3.5: 连续动作过渡实现

### M6 - 性能优化与部署
- [ ] 任务6.1: 性能分析
- [ ] 任务6.2: 资源优化
- [ ] 任务6.3: 部署配置

## 关键依赖

### TTS 服务
- 服务: GPT-SoVITS v2pro
- 路径: D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604
- API 端点: http://127.0.0.1:9880
- 参考音频: D:\AI\OpenClaw\GPT-SoVITS-v2pro-20250604\koli_ref.wav

### 技术栈
- React 19.0.0
- Three.js 0.173.0
- React Three Fiber 9.0.4
- @pixiv/three-vrm 3.4.0
- Zustand 5.0.11 (状态管理)
- Vite 6.2.0 (构建工具)

## 项目结构
```
D:\projects\r3f-vrm-final-main\
├── src\
│   ├── components\    # 组件
│   ├── hooks\         # 自定义 Hooks
│   ├── stores\        # Zustand 状态管理
│   ├── utils\         # 工具函数
│   └── assets\        # 静态资源
├── public\            # 公共资源
├── server\            # 后端服务
└── docs\              # 文档
```

## 启动命令
- 前端: npm run dev
- 构建: npm run build
- 预览: npm run preview

## 待确认事项
- [ ] TTS 服务是否已启动（http://127.0.0.1:9880）
- [ ] 参考音频文件是否存在
- [ ] 项目是否有 Git 版本控制

## 下一步行动
1. 确认 TTS 服务状态
2. 开始 M4 任务的实现
3. 初始化 Git 仓库（如果需要）
