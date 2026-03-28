# 添加预设动作技能

> 本文档记录如何在项目中添加新的预设动作

---

## 概述

在 VRM 数字人项目中添加新的预设动画，需要修改三个文件：
1. FBX 动画文件
2. useVRMControl.js（动作映射 + 时长配置）
3. SOUL.md（可选，让 Agent 知道新动作）

---

## 步骤

### 步骤 1：添加 FBX 动画文件

1. 准备动画文件（FBX 格式）
2. 放入 `public/models/animations/` 目录
3. 文件名格式：`动作名.fbx`（首字母大写，如 `Saluting.fbx`）

### 步骤 2：修改 useVRMControl.js

打开 `src/stores/useVRMControl.js`

#### 2.1 添加动作映射

在 `actionAnimationMap` 对象中添加：

```javascript
actionAnimationMap: {
  // 现有动作...
  
  // 新动作
  新动作英文名: '动画文件名（无.fbx）',
},
```

#### 2.2 添加动作时长

在 `ACTION_DURATION` 对象中添加：

```javascript
const ACTION_DURATION = {
  // 现有动作...
  
  // 新动作（毫秒）
  新动作英文名: 3000,
},
```

#### 时长参考

| 类型 | 时长 (毫秒) |
|------|-------------|
| 简单手势 | 2000-3000 |
| 常规动作 | 3000-4000 |
| 舞蹈/复杂 | 5000-8000 |
| 待机循环 | 0（持续播放） |

### 步骤 3：更新 SOUL.md（可选）

打开 `C:\Users\Miss\.openclaw\workspace-mico-vrm\SOUL.md`

在动作列表中添加新动作：

```markdown
| 新动作英文名 | 动画文件名 | 说明 |
|-------------|------------|------|
| salute | Saluting | 敬礼 |
```

---

## 示例：添加"敬礼"动作

### 1. 添加文件
- 将 `salute.fbx` 放入 `public/models/animations/`
- 重命名为 `Saluting.fbx`

### 2. 修改 useVRMControl.js

```javascript
// 动作映射
actionAnimationMap: {
  // ...现有
  salute: 'Saluting',
}

// 动作时长
const ACTION_DURATION = {
  // ...现有
  salute: 3000,
}
```

### 3. 更新 SOUL.md

```markdown
| salute | Saluting | 敬礼 |
```

---

## 常见问题

### Q: 动画文件名怎么确定？
A: 查看 FBX 文件名，去掉 `.fbx` 后缀即可。

### Q: 动作时长设置多少合适？
A: 
- 手势类（挥手、指向）：2000-3000ms
- 身体动作（点头、跳舞）：3000-5000ms
- 舞蹈：5000-8000ms
- 待机循环：0（会一直循环播放）

### Q: 如何测试新动作？
A: 让 Agent 返回对应的 action，如设置为 `salute`，观察虚拟形象是否播放对应动画。

---

## 注意事项

1. 动作名称使用英文小写加下划线（如 `walk_turn`）
2. 动画文件名首字母大写（如 `Walking Turn 180.fbx`）
3. 添加后需要提交代码并推送