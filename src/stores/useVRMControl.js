import { create } from 'zustand';

// 动作持续时间配置（毫秒）
const ACTION_DURATION = {
  // 基础待机
  idle: 0,           // 持续播放
  sitting_idle: 0,
  warrior_idle: 0,

  // 互动手势
  wave: 4000,
  pointing: 2000,
  thumbs_up: 3000,
  clap: 4000,
  shrug: 3000,

  // 头部动作
  nod: 4000,
  think: 4000,
  talking: 3000,

  // 移动
  walk: 3000,
  running: 3000,
  walk_turn: 2000,
  jog_backwards: 3000,

  // 舞蹈
  dance: 5000,
  rumba: 5000,
  swing: 5000,
  bboy: 5000,
  robot: 5000,
  silly: 5000,
  thriller: 8000,

  // 运动/战斗
  jump: 3000,
  punch: 3000,
  kick: 3000,
  shoot: 3000,
  zombie: 4000,

  // 其他
  entry: 3000,
  typing: 4000,

  // 兼容旧名称
  shake: 3000,
  point: 2000,
  greet: 2500,

  default: 3000,
};

// 恢复默认表情
const DEFAULT_EXPRESSIONS = {
  happy: 0,
  sad: 0,
  angry: 0,
  surprised: 0,
  neutral: 1,
  relaxed: 0,
  aa: 0, ih: 0, ee: 0, oh: 0, ou: 0,  // 口型
  blinkLeft: 0, blinkRight: 0,
};

// VRM 控制状态
export const useVRMControl = create((set, get) => ({
  // 表情控制
  expressions: { ...DEFAULT_EXPRESSIONS },
  
  // 目标表情（用于渐变过渡）
  targetExpressions: { ...DEFAULT_EXPRESSIONS },
  
  // 当前动作
  currentAction: null,
  
  // 动作定时器
  actionTimer: null,
  
  // TTS 是否在播放
  isSpeaking: false,
  
  // 渐变速度（每秒变化量）
  transitionSpeed: 3,
  
  // 动作切换淡入淡出时间（秒）
  animationFadeTime: 1.5,
  
  // 口型同步缩放
  lipSyncScale: 0.25,
  
  // 口型平滑因子 (0-1，越小越平滑)
  lipSyncSmooth: 0.2,
  
  // 表情幅度限制 (0-1)
  maxEmotionScale: 1.0,
  
  // AI 表情口型权重 (0-1，越小 AI 表情对口型影响越小)
  aiMouthWeight: 0.3,
  
  // 口型同步值（平滑后的值）
  
  // 动作控制
  animation: null,
  
  // TTS 口型数据
  lipSyncExpressions: { aa: 0, ih: 0, ee: 0, oh: 0, ou: 0 },
  
  // 交互控制
  lookAtMouse: false,
  lookAtCamera: true,
  
  // 位置控制
  position: { x: 0, y: -1.25, z: 0 },
  
  // 动作到动画的映射（英文名称）
  actionAnimationMap: {
    // 基础待机
    idle: 'Breathing Idle',
    sitting_idle: 'Sitting Idle',
    warrior_idle: 'Warrior Idle',

    // 互动手势
    wave: 'Waving',
    pointing: 'Pointing',
    point: 'Pointing',  // 兼容旧名称
    thumbs_up: 'Standing Thumbs Up',
    clap: 'Clapping',
    shrug: 'Shrugging',
    shake: 'Shrugging',  // 兼容旧名称
    
    // 头部动作
    nod: 'Lengthy Head Nod',
    think: 'Thinking',
    thinking: 'Thinking',  // 兼容
    nodding: 'Lengthy Head Nod',  // 兼容
    talking: 'Talking',

    // 移动
    walk: 'Walking',
    running: 'Running',
    walk_turn: 'Walking Turn 180',
    jog_backwards: 'Slow Jog Backwards',

    // 舞蹈
    dance: 'Hip Hop Dancing',
    rumba: 'Rumba Dancing',
    swing: 'Swing Dancing',
    bboy: 'Bboy Hip Hop Move',
    robot: 'Robot Hip Hop Dance',
    silly: 'Silly Dancing',
    thriller: 'Thriller Part 2',

    // 运动/战斗
    jump: 'Jumping',
    punch: 'Punching Bag',
    kick: 'Hurricane Kick',
    shoot: 'Shooting Arrow',
    zombie: 'Zombie Stand Up',

    // 其他
    entry: 'Entry',
    typing: 'Typing',
    none: null,
  },
  
  // 设置单个表情
  setExpression: (name, value) => set((state) => ({
    expressions: { ...state.expressions, [name]: value }
  })),
  
  // 批量设置表情
  setExpressions: (expressions) => set((state) => ({
    expressions: { ...state.expressions, ...expressions }
  })),
  
  // 重置所有表情
  resetExpressions: () => set((state) => ({
    expressions: Object.keys(state.expressions).reduce((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {}),
    expressions: { ...state.expressions, neutral: 1 }
  })),
  
  // 设置目标表情（用于渐变过渡）
  setTargetExpressions: (expressions) => set({ 
    targetExpressions: { ...DEFAULT_EXPRESSIONS, ...expressions }
  }),
  
  // 设置口型同步（直接应用）
  setLipSyncExpressions: (expressions) => set({ lipSyncExpressions: expressions }),
  
  // 设置 TTS 播放状态
  setIsSpeaking: (speaking) => set({ isSpeaking: speaking }),
  
  // 渐变更新（每帧调用）
  updateExpressions: (deltaTime) => {
    const { expressions, targetExpressions, transitionSpeed, lipSyncExpressions } = get();
    const speed = transitionSpeed * deltaTime;
    
    let changed = false;
    const newExpressions = { ...expressions };
    
    // 嘴巴控制完全由 VRMAvatar.jsx 处理（TTS 口型 vs AI 表情）
    // 这里不做任何处理，让 mouthKeys 跳过
    const mouthKeys = ['aa', 'ih', 'ee', 'oh', 'ou'];
    const eyeKeys = ['blinkLeft', 'blinkRight'];
    
    for (const key in newExpressions) {
      if (mouthKeys.includes(key)) {
        // 跳过嘴巴，由 VRMAvatar.jsx 处理
        continue;
      } else if (eyeKeys.includes(key)) {
        // 眼睛保持不变
      } else {
        // 表情渐变过渡
        if (key in targetExpressions) {
          const current = newExpressions[key];
          const target = targetExpressions[key];
          const diff = target - current;
          
          if (Math.abs(diff) > 0.01) {
            newExpressions[key] = current + diff * speed;
            changed = true;
          } else {
            newExpressions[key] = target;
          }
        }
      }
    }
    
    if (changed) {
      set({ expressions: newExpressions });
    }
  },
  
  // 执行动作（带持续时间和自动恢复）
  executeAction: (actionName, expressions = null, customDuration = null) => {
    const { actionTimer, animation, actionAnimationMap, currentAction } = get();
    
    console.log('[executeAction] called:', actionName, 'currentAction:', currentAction);
    
    // 清除之前的定时器
    if (actionTimer) {
      console.log('[executeAction] clearing old timer');
      clearTimeout(actionTimer);
    }
    
    // 获取动作持续时间
    const duration = customDuration || ACTION_DURATION[actionName] || ACTION_DURATION.default;
    
    // 获取对应的动画名称
    const animName = actionAnimationMap[actionName] || actionName;
    
    // 设置动画（使用映射后的名称）
    console.log('[executeAction] setting animation:', actionName === 'none' ? null : animName, 'currentAction:', actionName);
    set({ 
      animation: actionName === 'none' ? null : animName,
      currentAction: actionName,
    });
    
    // 设置目标表情
    if (expressions) {
      set({ targetExpressions: { ...DEFAULT_EXPRESSIONS, ...expressions } });
    }
    
    // 设置定时器，定时结束后切换到 Idle 动画（不管 TTS 是否结束）
    const timer = setTimeout(() => {
      const { currentAction } = get();
      console.log('[executeAction TIMER] triggered, switching to Idle');
      // 切换到 Idle 动画，而不是设为 null
      set({ 
        animation: "Breathing Idle",
        currentAction: null,
      });
    }, duration);
    
    console.log('[executeAction] timer set for', duration, 'ms');
    set({ actionTimer: timer });
    return true;
  },
  
  // 播放动画
  playAnimation: (animName) => { console.log('[playAnimation]', animName); set({ animation: animName }); },
  
  // 停止动画
  stopAnimation: () => { console.log('[stopAnimation] - animation:null'); set({ animation: null }); },
  
  // 启用/禁用鼠标注视
  setLookAtMouse: (enabled) => set({ lookAtMouse: enabled }),
  
  // 设置口型同步缩放
  setLipSyncScale: (scale) => set({ lipSyncScale: scale }),
  
  // 设置 AI 表情口型权重
  setAiMouthWeight: (weight) => set({ aiMouthWeight: weight }),
  
  // 设置表情幅度限制
  setMaxEmotionScale: (scale) => set({ maxEmotionScale: scale }),
  
  // 设置表情过渡速度
  setTransitionSpeed: (speed) => set({ transitionSpeed: speed }),
  
  // 设置动作切换淡入淡出时间
  setAnimationFadeTime: (time) => set({ animationFadeTime: time }),
  
  // 设置位置
  setPosition: (pos) => set({ position: pos }),
  
  // 自然语言解析执行
  executeCommand: (command) => {
    const cmd = command.toLowerCase();
    const { setExpression, setLookAtMouse, setTargetExpressions, executeAction } = get();
    
    // 表情关键词
    const expressionMap = {
      '笑': () => setTargetExpressions({ happy: 1 }),
      '开心': () => setTargetExpressions({ happy: 1 }),
      '高兴': () => setTargetExpressions({ happy: 1 }),
      '哭': () => setTargetExpressions({ sad: 1 }),
      '难过': () => setTargetExpressions({ sad: 1 }),
      '伤心': () => setTargetExpressions({ sad: 1 }),
      '生气': () => setTargetExpressions({ angry: 1 }),
      '愤怒': () => setTargetExpressions({ angry: 1 }),
      '惊讶': () => setTargetExpressions({ surprised: 1 }),
      '吃惊': () => setTargetExpressions({ surprised: 1 }),
      '淡定': () => setExpression('neutral', 1),
      '放松': () => setExpression('relaxed', 1),
    };
    
    // 动作关键词
    const actionMap = {
      '打招呼': () => executeAction('greet'),
      '挥手': () => executeAction('wave'),
      '跳舞': () => executeAction('dance'),
      '思考': () => executeAction('think'),
    };
    
    // 交互关键词
    const interactionMap = {
      '看过来': () => setLookAtMouse(true),
      '看我': () => setLookAtMouse(true),
      '别看': () => setLookAtMouse(false),
    };
    
    // 执行匹配的命令
    for (const [key, action] of [...Object.entries(expressionMap), ...Object.entries(actionMap), ...Object.entries(interactionMap)]) {
      if (cmd.includes(key)) {
        action();
        return { success: true, action: key };
      }
    }
    
    return { success: false, message: '未识别的命令' };
  }
}));
