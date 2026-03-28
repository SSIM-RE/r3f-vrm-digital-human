# 问题记录

## 未解决问题
- [ ] (已解决) 参考音频路径不一致
- [ ] (已解决) 前端 Agent 调用方式
- [ ] (已解决) WebSocket 实现

## 已解决问题
### [RESOLVED-001] TTS 与 AI 表情口型叠加
- 解决时间: 2026-03-02
- 问题描述: 原始代码直接覆盖口型，TTS 结束后口型不恢复
- 解决方案: 实现加权叠加逻辑
  - TTS 播放中: `final = aiMouth * (1 - aiMouthWeight) + ttsMouth * aiMouthWeight`
  - TTS 停止: 只使用 AI 表情的嘴巴
  - 使用 `aiMouthWeight` 参数控制叠加比例（0-1）
- ⚠️ **修正**: 此方案有误，VRM 的叠加是通过 `morphTargetInfluences +=` 自动累加实现的，不需要手动计算

### [RESOLVED-002] 理解 VRM 表情叠加机制
- 解决时间: 2026-03-02
- 问题描述: 误以为需要手动计算表情叠加，导致错误修改
- 根本原因:
  1. 没有注意到 `VRMExpressionMorphTargetBind.applyWeight` 使用 `+=` 累加
  2. 没有理解 VRM 每帧的执行流程：清零 → 计算 multiplier → 累加
  3. 没有信任用户说"之前的写法是对的"
  4. 急于修改，没有先分析现有代码的工作原理
- 正确理解:
  ```javascript
  // VRM 每帧自动执行：
  // 1. 清零所有 morphTargetInfluences
  expression.clearAppliedWeight();
  
  // 2. 计算每个表情的 multiplier（用于 override）
  const multiplier = 1 - sum(expression.overrideMouthAmount);
  
  // 3. 依次累加每个表情
  expression.applyWeight({ multiplier });
  // → mesh.morphTargetInfluences += weight × multiplier
  ```
  - VRM 会**自动累加**多个表情的 `morphTargetInfluences`
  - 用户只需要 `setValue`，不需要手动计算叠加
  - 直接设置 `happy=0.9` 和 `aa=0.5`，VRM 会自动累加
- 经验教训:
  1. **遇到问题先理解再修改**：仔细阅读源码，理解框架设计哲学
  2. **重视用户反馈**：用户说"之前的写法是对的"时，先分析原因
  3. **注意细节**：`+=` 和 `=` 的区别是关键
  4. **理解框架设计哲学**：VRM 是"自动处理叠加"，不是"手动计算混合比例"

### [RESOLVED-003] TTS 播放中误判停止
- 解决时间: 2026-03-02
- 问题描述: 使用 `hasTtsData`（检查口型值）判断 TTS 是否播放
  - TTS 播放中有静音时，口型值低于 0.01
  - `hasTtsData = false`，误判为停止，切换到 neutral
- 根本原因:
  - 使用口型值判断播放状态不准确
  - 静音时不等于 TTS 停止
  - `useTTS.js` 的 `onended` 会设置 `isSpeaking = false`，但 `lipSyncExpressions` 没有清零
- 正确做法:
  ```javascript
  // 使用 isSpeaking 判断 TTS 播放状态（而不是 hasTtsData）
  const { isSpeaking } = useVRMControl();
  
  if (isSpeaking) {
    // TTS 播放：AI 表情 + TTS 口型叠加
  } else {
    // TTS 停止：切换到 neutral
    setTargetExpressions({ neutral: 1 });
  }
  ```
- 关键点:
  - `isSpeaking` 由 `useTTS.js` 的 `onended` 准确设置
  - 不依赖口型值，避免静音误判
- 经验教训:
  1. **状态管理要准确**：用明确的布尔值判断，不要依赖计算值
  2. **边界情况要考虑**：静音、停顿不等于停止
  3. **数据源要选对**：用正确的状态变量（`isSpeaking`），不是推导值（`hasTtsData`）

### [RESOLVED-004] DiP 动作左右方向反向
- 解决时间: 2026-03-18
- 问题描述: AI 动作的面向方向与默认动作方向相反
- 症状: VRM 手臂挥动方向错误
- 根本原因: HML 骨骼数据的左右手臂映射与 VRM 相反
  - HML 中 `rightUpperArm` 和 `leftUpperArm` 都指向下方
  - VRM 中 `rightUpperArm` 向右 (-X)，`leftUpperArm` 向左 (+X)
- 解决方案: 交换 VRM_TO_HML 映射中的左右手臂索引
- 经验教训: HML 和 VRM 的骨骼坐标系可能存在左右镜像关系

## 风险清单
## 风险清单
### [RISK-001] TTS 服务依赖
- 风险等级: 中
- 描述: GPT-SoVITS TTS 服务需要手动启动，如果服务未启动会导致功能不可用
- 应对策略:
  - 添加服务健康检查
  - 提供友好的错误提示
  - 在文档中说明启动步骤

### [RISK-002] 音频同步精度
- 风险等级: 中
- 描述: 口型动画与语音同步可能存在延迟，影响体验
- 应对策略:
  - 使用高精度音频分析
  - 实现缓冲机制
  - 考虑使用 Web Audio API

## 已知限制
- TTS 服务必须在本地运行（http://127.0.0.1:9880）
- 参考音频路径是硬编码的
- 当前仅支持中文语音合成
