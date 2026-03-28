import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useTTS } from "../hooks/useTTS";
import { useDipMotion } from "../hooks/useDipMotion";
import { useVRMControl } from "../stores/useVRMControl";
import { applyDipFrame, initStandardTPose, vrmTPoseDirs } from "../utils/dipAnimator";

// 加载本地 NPY 文件（与 vrm-bone-test 相同）
const loadLocalMotion = async (filename) => {
  try {
    const response = await fetch(`/models/${filename}`)
    const data = await response.json()
    
    // 只翻转 Z 轴（与 vrm-bone-test 一致）
    const flippedData = data.map(frame => {
      return frame.map(joint => {
        const [x, y, z] = joint
        return [x, y, -z]
      })
    })
    
    console.log('[UI] Loaded local motion:', filename, '- frames:', flippedData.length)
    return flippedData
  } catch (err) {
    console.error('[UI] Load error:', err)
    return null
  }
}

// 快捷短语
const quickPhrases = [
  { text: "今天天气怎么样？", icon: "🌤️" },
  { text: "帮我安排一下日程", icon: "📅" },
  { text: "播放一首音乐", icon: "🎵" },
  { text: "有什么新闻吗？", icon: "📰" },
  { text: "打开摄像头", icon: "📷" },
  { text: "记录今天的开销", icon: "💰" },
];

// 模拟待办事项
const defaultTodos = [
  { id: 1, text: "准备面试作品集", done: false, urgent: true },
  { id: 2, text: "学习 Three.js", done: true, urgent: false },
  { id: 3, text: "更新博客", done: false, urgent: false },
  { id: 4, text: "健身 30 分钟", done: false, urgent: true },
];

// 解析 Mico VRM 的回复（支持 JSON 或纯文本）
const parseMicoResponse = (responseText) => {
  let cleanText = responseText.trim();
  // 移除 ```json 或 ``` 包裹
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    const parsed = JSON.parse(cleanText);
    // 兼容旧版 action 和新版 actions
    let actions = parsed.actions || [];
    // 如果没有 actions 字段但有 action 字段，转换为数组
    if (actions.length === 0 && parsed.action && parsed.action !== 'none') {
      actions = [parsed.action];
    }
    return {
      voiceText: parsed.voiceText || parsed.text || parsed.message || '',  // 语音说的
      text: parsed.text || '',  // 详细文本展示
      actions: actions,  // 新版：动作数组
      action: parsed.action || 'none',  // 旧版：单个动作（兼容）
      emotion: parsed.emotion || null,
      expressions: parsed.expressions || null
    };
  } catch (e) {
    // 纯文本 fallback
    return { voiceText: responseText, text: responseText, actions: [], action: 'none', emotion: null, expressions: null };
  }
};

export const UI = () => {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState({ temp: 18, condition: "☀️", humidity: 65, wind: 12 });
  
  // AI 回复
  const [aiReply, setAiReply] = useState("");  // 简短回复（voiceText）
  const [aiReplyDetail, setAiReplyDetail] = useState("");  // 详细回复（text）
  
  // 录音功能
  const { isRecording, audioBlob, startRecording, stopRecording } = useAudioRecorder();
  const [transcript, setTranscript] = useState(""); // 转写文本
  
  // 文本输入功能
  const [textInput, setTextInput] = useState("");
  
  // 会话上下文 - 用于保持对话历史
  const [sessionKey, setSessionKey] = useState(() => `session-${Date.now()}`);
  
  // TTS 功能
  const { speak: ttsSpeak, isSpeaking, initModel: initTTS, setIsSpeaking: setTtsSpeaking, setLipSyncCallback } = useTTS();
  const { setLipSyncExpressions, executeAction, setTargetExpressions, setIsSpeaking } = useVRMControl();
  
  // DiP 动作生成功能
  const { 
    isGenerating: isDipGenerating, 
    generateByAction: dipGenerateByAction,
    play: dipPlay,
    stop: dipStop,
  } = useDipMotion();
  
  // 测试 DiP 动作（从本地文件加载）- 完全按照 vrm-bone-test 的方式
  const [dipPlaying, setDipPlaying] = useState(false)
  const dipFrameRef = useRef(0)
  const dipIntervalRef = useRef(null)
  const dipMotionDataRef = useRef(null)
  
  // 测试 DiP 动作生成
  const testDipAction = async (actionName) => {
    console.log('[UI] Testing DiP action:', actionName)
    try {
      const motion = await dipGenerateByAction(actionName)
      console.log('[UI] DiP motion.motion[0][0]:', motion?.motion?.[0]?.[0])
      if (motion && motion.motion) {
        dipMotionDataRef.current = motion.motion
        dipFrameRef.current = 0
        setDipPlaying(true)
      }
    } catch (err) {
      console.error('[UI] DiP test error:', err)
    }
  }
  
  // 存储上一次的动作序列（用于连续过渡）
  const lastActionsRef = useRef([])
  
  // 测试 DiP 连续动作序列生成
  const testDipSequence = async (prompts) => {
    console.log('[UI] Testing DiP sequence:', prompts)
    console.log('[UI] Last actions:', lastActionsRef.current)
    
    const finalPrompts = prompts
    
    console.log('[UI] Final prompts:', finalPrompts)
    
    try {
      const response = await fetch('/api/generate_sequence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompts: finalPrompts
        })
      })
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[UI] DiP sequence result:', {
        frames: data.frames,
        segments: data.segments,
        firstFrame: data.motion?.[0]?.[0]
      })
      
      if (data.motion) {
        // 保存 lastActionsRef 供调试用
        lastActionsRef.current = prompts
        
        dipMotionDataRef.current = data.motion
        dipFrameRef.current = 0
        setDipPlaying(true)
      }
    } catch (err) {
      console.error('[UI] DiP sequence test error:', err)
    }
  }
  
  // 播放 DiP 动画（使用 useEffect + setInterval，与 vrm-bone-test 完全一致）
  useEffect(() => {
    if (dipPlaying && dipMotionDataRef.current && window.vrmInstance) {
      console.log('[UI] Starting DiP playback via useEffect, total frames:', dipMotionDataRef.current.length)
      console.log('[UI] VRM Instance:', !!window.vrmInstance)
      console.log('[UI] VRM humanoid:', !!window.vrmInstance.humanoid)
      console.log('[UI] First frame sample:', dipMotionDataRef.current[0]?.[0])
      
      // 设置标志
      window.vrmForDipPlaying = true
      
      dipIntervalRef.current = setInterval(() => {
        const f = dipFrameRef.current
        const totalFrames = dipMotionDataRef.current.length
        
        if (f % 20 === 0) {
          console.log('[UI] Playing frame:', f)
        }
        
        // 与 vrm-bone-test 完全一致的调用方式
        if (window.vrmInstance) {
          applyDipFrame(dipMotionDataRef.current[f], window.vrmInstance)
        }
        
        // 推进到下一帧
        dipFrameRef.current = f + 1
        
        // 播放完成所有帧后停止（而不是循环）
        if (dipFrameRef.current >= totalFrames) {
          console.log('[UI] DiP playback complete, frames:', totalFrames)
          window.vrmForDipPlaying = false
          setDipPlaying(false)
          if (dipIntervalRef.current) {
            clearInterval(dipIntervalRef.current)
            dipIntervalRef.current = null
          }
        }
      }, 50) // 20fps = 50ms
    }
    
    return () => {
      if (dipIntervalRef.current) {
        clearInterval(dipIntervalRef.current)
      }
    }
  }, [dipPlaying])
  
  // 加载本地动作并开始播放
  const testLocalMotion = async (filename) => {
    console.log('[UI] testLocalMotion:', filename)
    
    // 等待 VRM 和 hmlToVrm 准备好
    if (!window.vrmInstance || !window.hmlToVrm) {
      console.log('[UI] VRM not ready')
      return
    }
    
    // 等待 1.5 秒确保准备好
    await new Promise(r => setTimeout(r, 1500))
    
    // 加载动作数据
    const motionData = await loadLocalMotion(filename)
    if (!motionData) {
      console.log('[UI] Failed to load motion')
      return
    }
    
    console.log('[UI] Motion loaded:', motionData.length, 'frames')
    
    // 保存到 ref
    dipMotionDataRef.current = motionData
    dipFrameRef.current = 0
    
    // 开始播放
    setDipPlaying(true)
  }
  
  // 初始化 TTS 模型
  useEffect(() => {
    initTTS().then(ok => {
      if (ok) console.log('🎤 TTS 已就绪');
    });
    
    // 设置口型同步回调 - 将 TTS 的口型数据传给 VRM 控制
    setLipSyncCallback((lipSyncValues) => {
      setLipSyncExpressions(lipSyncValues);
    });
  }, []);
  
  // 同步 TTS 播放状态到 VRM
  useEffect(() => {
    setIsSpeaking(isSpeaking);
  }, [isSpeaking]);
  
  // 处理文本发送
  const handleTextSubmit = () => {
    if (!textInput.trim() || voiceStatus === "processing") return;
    
    const text = textInput.trim();
    console.log('📝 文本输入:', text);
    setTextInput("");
    setVoiceStatus("processing");
    
    // 清空之前的回复
    setAiReply("");
    setAiReplyDetail("");
    
    // 通过代理发送到 Mico VRM Agent
    const requestBody = {
      model: "openclaw:mico-vrm",
      input: text,
      user: sessionKey  // 保持会话上下文
    };
    
    fetch('/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer bbdc90f999420b51a92a6526a44087037c8aa8e529b52be8'
      },
      body: JSON.stringify(requestBody)
    })
    .then(res => res.json())
    .then(agentData => {
      console.log('🤖 AI 响应:', agentData);
      
      // 解析 Mico VRM 的 JSON 回复
      const responseText = agentData.output?.[0]?.content?.[0]?.text || '';
      
      // 使用解析函数处理 JSON 或纯文本
      const micoResponse = parseMicoResponse(responseText);
      
      console.log('🔍 AI 原始返回:', responseText);
      console.log('🔍 解析后:', micoResponse);
      
      // voiceText 用于语音+简短展示，text 用于详细展示
      const voiceText = micoResponse.voiceText;
      const detailText = micoResponse.text;  // 详细文本
      
      console.log('🔍 voiceText:', voiceText);
      console.log('🔍 detailText:', detailText);
      
      // 显示文本回复
      if (voiceText) {
        console.log('📝 Mico 简短回复:', voiceText);
        console.log('📋 Mico 详细回复:', detailText);
        setAiReply(voiceText);  // 简短显示
        // 只有当 detailText 与 voiceText 不同时才显示详细信息
        setAiReplyDetail(detailText && detailText !== voiceText ? detailText : "");
        
        // 构建表情对象
        const expressions = {};
        if (micoResponse.emotion) {
          expressions[micoResponse.emotion] = 1;
        }
        if (micoResponse.expressions) {
          Object.assign(expressions, micoResponse.expressions);
        }
        
        // 执行动作和表情的函数（延迟到音频播放时执行）
        const executeOnPlay = async () => {
          const actions = micoResponse.actions || [];
          
          // 设置表情
          setTargetExpressions(expressions);
          
          // 如果有动作，执行动作
          if (actions.length > 0) {
            console.log('🎬 执行动作序列:', actions);
            try {
              await testDipSequence(actions);
            } catch (err) {
              console.error('❌ 动作执行失败:', err);
            }
          } else if (micoResponse.action && micoResponse.action !== 'none') {
            // 兼容旧版：单个动作
            console.log('🎬 执行单个动作:', micoResponse.action);
            executeAction(micoResponse.action, expressions);
          }
        };
        
        // 1. 先发起 TTS 请求（等待音频生成）
        // 2. 音频开始播放时，执行动作和表情
        if (voiceText) {
          ttsSpeak(voiceText, executeOnPlay);  // 传入回调，播放时触发
        } else {
          // 没有语音，直接执行动作和表情
          executeOnPlay();
        }
      }
    })
    .catch(err => {
      console.error('发送消息失败:', err);
    })
    .finally(() => {
      setVoiceStatus("idle");
    });
  };
  
  // 处理录音数据
  useEffect(() => {
    if (audioBlob) {
      console.log('📦 收到录音数据:', audioBlob.size, 'bytes');
      
      // 发送到 Whisper 进行转写
      setVoiceStatus("processing");
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      fetch('http://localhost:5000/transcribe', {
        method: 'POST',
        body: formData
      })
      .then(res => res.json())
      .then(data => {
        console.log('📝 转写结果:', data.text);
        const text = data.text || '（未能识别）';
        setTranscript(text);
        
        // 发送新消息时清空之前的回复
        setAiReply("");
        setAiReplyDetail("");
        
        // 通过代理发送到 Mico VRM Agent
        const requestBody = {
          model: "openclaw:mico-vrm",
          input: text,
          user: sessionKey  // 保持会话上下文
        };
        
        fetch('/v1/responses', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer bbdc90f999420b51a92a6526a44087037c8aa8e529b52be8'
          },
          body: JSON.stringify(requestBody)
        })
        .then(res => res.json())
        .then(agentData => {
          console.log('🤖 AI 响应:', agentData);
          
          // 解析 Mico VRM 的 JSON 回复
          const responseText = agentData.output?.[0]?.content?.[0]?.text || '';
          
          try {
            // 尝试解析 JSON 格式
            const micoResponse = JSON.parse(responseText);
            
            // 显示文本回复（兼容旧格式）
            const voiceText = micoResponse.voiceText || micoResponse.text || '';
            const detailText = micoResponse.text || '';
            
            if (voiceText) {
              console.log('📝 Mico 回复:', voiceText);
              setAiReply(voiceText);
              setAiReplyDetail(detailText && detailText !== voiceText ? detailText : "");
            }
            
            // 执行动作
            if (micoResponse.action && micoResponse.action !== 'none') {
              executeAction(micoResponse.action, micoResponse.expressions);
            } else if (micoResponse.expressions) {
              // 没有动作但有表情
              setTargetExpressions(micoResponse.expressions);
            }
          } catch (e) {
            // 如果不是 JSON，直接显示文本
            setAiReply(responseText);
            setAiReplyDetail("");
          }
        })
        .catch(err => {
          console.error('发送消息失败:', err);
        });
        
        console.log('📤 已发送到 OpenClaw (HTTP API)');
        setVoiceStatus("idle");
      })
      .catch(err => {
        console.error('转写失败:', err);
        setTranscript('（转写失败）');
        setVoiceStatus("idle");
      });
    }
  }, [audioBlob]);

  // 语音状态
  const [voiceStatus, setVoiceStatus] = useState("idle"); // idle, recording, processing
  const [notifications, setNotifications] = useState([
    { id: 1, text: "收到新邮件", time: "2分钟前", unread: true }
  ]);
  const [music, setMusic] = useState({ 
    playing: false, 
    title: "未播放", 
    artist: "",
    progress: 0 
  });
  const [todos, setTodos] = useState(defaultTodos);
  const [showTodos, setShowTodos] = useState(false);
  const [showPanel, setShowPanel] = useState("none");
  const [showWeather, setShowWeather] = useState(false);
  const [systemStats, setSystemStats] = useState({ cpu: 23, memory: 8.2, battery: 87 });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    // 模拟系统状态变化
    const statsTimer = setInterval(() => {
      setSystemStats(s => ({
        cpu: Math.floor(15 + Math.random() * 20),
        memory: +(7 + Math.random() * 3).toFixed(1),
        battery: s.battery > 5 ? s.battery - 0.1 : 100
      }));
    }, 3000);

    return () => {
      clearInterval(timer);
      clearInterval(statsTimer);
    };
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const addTodo = (text) => {
    setTodos([...todos, { id: Date.now(), text, done: false, urgent: false }]);
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(t => t.id !== id));
  };

  const handleQuickPhrase = (phrase) => {
    console.log("发送短语:", phrase);
    setVoiceStatus("processing");
    setShowPanel("none");
    
    // 添加系统通知
    setNotifications(n => [{ 
      id: Date.now(), 
      text: `已发送: "${phrase}"`, 
      time: "刚刚",
      unread: false 
    }, ...n]);
    
    setTimeout(() => setVoiceStatus("idle"), 1500);
  };

  const toggleMusic = () => {
    if (!music.playing) {
      setMusic({ 
        playing: true, 
        title: "夜空中最亮的星", 
        artist: "逃跑计划",
        progress: 0 
      });
    } else {
      setMusic(m => ({ ...m, playing: false }));
    }
  };

  const todoProgress = `${todos.filter(t => t.done).length}/${todos.length}`;
  const urgentCount = todos.filter(t => t.urgent && !t.done).length;

  return (
    <section className="fixed inset-0 z-10 flex items-center justify-center pointer-events-none">
      {/* 左上角 - Mico 头像 */}
      <div className="absolute top-4 left-4 flex items-center gap-3 pointer-events-auto group">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-2xl shadow-lg shadow-cyan-500/20 hover:scale-110 transition-transform cursor-pointer">
          🤖
        </div>
        <div className="flex flex-col">
          <span className="text-white font-medium text-lg">Mico</span>
          <span className="text-cyan-400/80 text-xs">私人助理</span>
        </div>
        
        {/* DiP 测试按钮 */}
        <div className="ml-4 flex gap-2">
          <button
            onClick={() => testDipAction('wave')}
            disabled={isDipGenerating}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            {isDipGenerating ? '生成中...' : '单动作'}
          </button>
          <button
            onClick={() => testDipSequence(['wave', 'nod'])}
            disabled={isDipGenerating}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            {isDipGenerating ? '生成中...' : '连续2动作'}
          </button>
          <button
            onClick={() => testDipSequence(['wave', 'nod', 'shake'])}
            disabled={isDipGenerating}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
          >
            连续3动作
          </button>
          <button
            onClick={() => {
              setDipPlaying(false)
              window.vrmForDipPlaying = false
            }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
          >
            停止
          </button>
        </div>
      </div>

      {/* 右上角 - 时间 + 天气 */}
      <div 
        className="absolute top-4 right-4 flex flex-col items-end pointer-events-auto cursor-pointer"
        onClick={() => setShowWeather(!showWeather)}
      >
        <div className="flex items-center gap-3">
          <span className="text-white font-light text-3xl tracking-wider">{formatTime(time)}</span>
          <div className="flex items-center gap-1 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition-colors">
            <span className="text-2xl">{weather.condition}</span>
            <div className="flex flex-col">
              <span className="text-white font-medium text-sm">{weather.temp}°C</span>
            </div>
          </div>
        </div>
        <span className="text-white/40 text-sm mt-1">{formatDate(time)}</span>
        
        {/* 天气详情 */}
        {showWeather && (
          <div className="mt-3 bg-black/80 backdrop-blur-md p-4 rounded-xl border border-white/10 animate-fade-in">
            <div className="flex items-center gap-4 mb-3">
              <span className="text-4xl">{weather.condition}</span>
              <div>
                <div className="text-white text-2xl font-light">{weather.temp}°C</div>
                <div className="text-white/50 text-sm">晴</div>
              </div>
            </div>
            <div className="flex gap-4 text-white/60 text-sm">
              <span>💧 湿度 {weather.humidity}%</span>
              <span>💨 风速 {weather.wind}km/h</span>
            </div>
          </div>
        )}
      </div>

      {/* 左侧 - 工具栏 */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 pointer-events-auto">
        
        {/* 本地动作测试 */}
        <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 hover:border-white/20 transition-colors">
          <div className="text-white/80 text-xs mb-1">🎬 动作测试</div>
          <button
            onClick={() => testLocalMotion('tpose_all.json')}
            className="px-3 py-2 bg-cyan-500/80 hover:bg-cyan-500 text-white text-xs rounded-lg transition-colors"
          >
            加载 tpose
          </button>
          <button
            onClick={() => testLocalMotion('walks_from_npy.json')}
            className="px-3 py-2 bg-blue-500/80 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors"
          >
            加载 walks(npy)
          </button>
          
          {/* DiP 动作生成输入 */}
          <input
            type="text"
            id="dipPrompt"
            placeholder="输入动作描述..."
            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs placeholder-white/40 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const prompt = e.target.value.trim()
                if (prompt) {
                  testDipAction(prompt)
                  e.target.value = ''
                }
              }
            }}
          />
          <button
            onClick={() => {
              const input = document.getElementById('dipPrompt')
              const prompt = input?.value?.trim()
              if (prompt) {
                testDipAction(prompt)
                input.value = ''
              }
            }}
            className="px-3 py-2 bg-purple-500/80 hover:bg-purple-500 text-white text-xs rounded-lg transition-colors w-full"
          >
            生成单动作
          </button>
          
          {/* 连续动作输入 */}
          <div className="mt-2 pt-2 border-t border-white/10">
            <input
              type="text"
              id="dipSequencePrompt"
              placeholder="动作1,动作2..."
              className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white text-xs placeholder-white/40 focus:outline-none focus:border-cyan-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = e.target.value.trim()
                  if (value) {
                    const prompts = value.split(',').map(p => p.trim()).filter(p => p)
                    if (prompts.length > 0) {
                      testDipSequence(prompts)
                      e.target.value = ''
                    }
                  }
                }
              }}
            />
            <button
              onClick={() => {
                const input = document.getElementById('dipSequencePrompt')
                const value = input?.value?.trim()
                if (value) {
                  const prompts = value.split(',').map(p => p.trim()).filter(p => p)
                  if (prompts.length > 0) {
                    testDipSequence(prompts)
                    input.value = ''
                  }
                }
              }}
              className="px-3 py-2 bg-green-500/80 hover:bg-green-500 text-white text-xs rounded-lg transition-colors w-full mt-1"
            >
              生成连续动作
            </button>
          </div>
          
          {isDipGenerating && <span className="text-yellow-400 text-xs">生成中...</span>}
        </div>
        {/* 语音状态 */}
        <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 hover:border-white/20 transition-colors group">
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 ${
              voiceStatus === "recording" ? "bg-red-500 animate-pulse shadow-lg shadow-red-500/50" :
              voiceStatus === "processing" ? "bg-yellow-500 animate-bounce shadow-lg shadow-yellow-500/50" :
              "bg-cyan-500 hover:bg-cyan-400 shadow-lg shadow-cyan-500/30"
            }`}
            onClick={() => {
              if (voiceStatus === "idle") {
                startRecording();
                setVoiceStatus("recording");
              } else if (voiceStatus === "recording") {
                stopRecording();
              }
            }}
          >
            {voiceStatus === "recording" ? "⏺️" : "🎤"}
          </div>
          <span className="text-white/60 text-xs">
            {voiceStatus === "recording" ? "录音中..." :
             voiceStatus === "processing" ? "识别中..." : "点击说话"}
          </span>
          
          {/* 录音时的波形效果 */}
          {voiceStatus === "recording" && (
            <div className="absolute -right-2 flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className="w-1 bg-red-500 rounded-full animate-pulse"
                  style={{ height: `${Math.random() * 12 + 4}px`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 音乐控制 */}
        <div className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 hover:border-white/20 transition-colors">
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform ${
              music.playing ? "bg-green-500 shadow-lg shadow-green-500/50" : "bg-white/10 hover:bg-white/20"
            }`}
            onClick={toggleMusic}
          >
            {music.playing ? "⏸️" : "▶️"}
          </div>
          <div className="text-center">
            <div className="text-white/80 text-xs truncate max-w-[70px]">{music.title}</div>
            {music.playing && (
              <div className="text-white/30 text-[10px]">{music.artist}</div>
            )}
          </div>
          {/* 播放进度条 */}
          {music.playing && (
            <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: "35%" }} />
            </div>
          )}
        </div>

        {/* 待办事项 */}
        <div 
          className={`flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border transition-colors cursor-pointer hover:bg-black/60 ${
            urgentCount > 0 ? "border-red-500/50" : "border-white/5 hover:border-white/20"
          }`}
          onClick={() => setShowPanel(showPanel === "todos" ? "none" : "todos")}
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center">
              📝
            </div>
            {urgentCount > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                {urgentCount}
              </div>
            )}
          </div>
          <span className="text-white/60 text-xs">待办</span>
        </div>

        {/* 快捷短语 */}
        <div 
          className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 hover:border-white/20 transition-colors cursor-pointer hover:bg-black/60"
          onClick={() => setShowPanel(showPanel === "shortcuts" ? "none" : "shortcuts")}
        >
          <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center">
            💬
          </div>
          <span className="text-white/60 text-xs">快捷</span>
        </div>

        {/* 通知 */}
        <div 
          className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 hover:border-white/20 transition-colors cursor-pointer hover:bg-black/60"
          onClick={() => setNotifications(n => n.map(x => ({ ...x, unread: false })))}
        >
          <div className="relative">
            <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
              🔔
            </div>
            {notifications.filter(n => n.unread).length > 0 && (
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-xs text-white font-bold">
                {notifications.filter(n => n.unread).length}
              </div>
            )}
          </div>
          <span className="text-white/60 text-xs">消息</span>
        </div>

        {/* 展开/收起 */}
        <div 
          className="flex flex-col items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-3 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/60 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <div className={`w-12 h-12 rounded-full bg-white/10 flex items-center justify-center transition-transform ${expanded ? "rotate-180" : ""}`}>
            ☰
          </div>
          <span className="text-white/40 text-xs">更多</span>
        </div>
      </div>

      {/* 底部中间 - AI 回复 + 文本输入 */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 pointer-events-none">
        {/* AI 回复显示 */}
        {aiReply && (
          <div className="pointer-events-auto">
            <div className="relative bg-gradient-to-r from-cyan-500/20 to-purple-500/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-cyan-500/30 shadow-lg shadow-cyan-500/20 max-w-md animate-fade-in">
              {/* 装饰线条 */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 rounded-tl-lg"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-purple-400 rounded-br-lg"></div>
              
              {/* 头像和名称 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center text-xs">🤖</div>
                <span className="text-cyan-400 text-xs font-medium">Mico</span>
                <span className="text-white/30 text-[10px]">· just now</span>
              </div>
              
              {/* 回复内容 - Markdown 渲染 */}
              <div className="text-white/90 text-sm leading-relaxed font-light">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {aiReply}
                </ReactMarkdown>
              </div>
              
              {/* TTS 播放按钮 */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => ttsSpeak(aiReply)}
                  disabled={isSpeaking}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    isSpeaking 
                      ? 'bg-purple-500/50 text-white/50' 
                      : 'bg-cyan-500/30 hover:bg-cyan-500/50 text-cyan-300'
                  } transition-colors`}
                >
                  {isSpeaking ? '🔊 播放中...' : '🔈 播放语音'}
                </button>
              </div>
              
              {/* 详细回复 - 仅当有详细文本时显示 */}
              {aiReplyDetail && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="text-purple-400 text-xs mb-1">📋 详细信息</div>
                  <div className="text-white/70 text-sm leading-relaxed font-light">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {aiReplyDetail}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              
              {/* 底部装饰 */}
              <div className="mt-2 flex items-center gap-1">
                <div className="h-0.5 flex-1 bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
              </div>
            </div>
          </div>
        )}
        
        {/* 文本输入框 */}
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-3 rounded-full border border-white/20 hover:border-white/40 transition-colors">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
              placeholder="和 Mico 聊天..."
              disabled={voiceStatus === "processing"}
              className="bg-transparent border-none outline-none text-white text-sm w-64 placeholder-white/40"
            />
            <button
              onClick={handleTextSubmit}
              disabled={!textInput.trim() || voiceStatus === "processing"}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                textInput.trim() && voiceStatus !== "processing"
                  ? "bg-cyan-500 hover:bg-cyan-400 text-white" 
                  : "bg-white/10 text-white/30 cursor-not-allowed"
              }`}
            >
              ➤
            </button>
          </div>
        </div>
      </div>

      {/* 待办事项面板 */}
      {showPanel === "todos" && (
        <div className="absolute left-20 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 pointer-events-auto w-72 animate-slide-in-right">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-medium text-lg">📝 今日待办</h3>
            <span className="text-cyan-400 text-sm">{todoProgress}</span>
          </div>
          
          {/* 进度条 */}
          <div className="h-2 bg-white/10 rounded-full mb-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full transition-all"
              style={{ width: `${(todos.filter(t => t.done).length / todos.length) * 100}%` }}
            />
          </div>
          
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {todos.map(todo => (
              <div 
                key={todo.id} 
                className={`flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 group ${
                  todo.urgent ? "border-l-2 border-red-500 pl-3" : ""
                }`}
              >
                <input 
                  type="checkbox" 
                  checked={todo.done} 
                  onChange={() => toggleTodo(todo.id)}
                  className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
                />
                <span className={`flex-1 text-sm ${
                  todo.done ? "text-white/40 line-through" : "text-white/80"
                }`}>
                  {todo.text}
                </span>
                {todo.urgent && !todo.done && (
                  <span className="text-red-400 text-xs">紧急</span>
                )}
                <button 
                  onClick={() => deleteTodo(todo.id)}
                  className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          
          {/* 添加新待办 */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <input 
              type="text"
              placeholder="+ 添加新待办..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white/70 text-sm focus:outline-none focus:border-cyan-500"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.target.value) {
                  addTodo(e.target.value);
                  e.target.value = "";
                }
              }}
            />
          </div>
        </div>
      )}

      {/* 快捷短语面板 */}
      {showPanel === "shortcuts" && (
        <div className="absolute left-20 top-1/2 -translate-y-1/2 bg-black/90 backdrop-blur-xl p-5 rounded-2xl border border-white/10 pointer-events-auto w-72 animate-slide-in-right">
          <h3 className="text-white font-medium text-lg mb-4">💬 快捷短语</h3>
          <div className="space-y-2">
            {quickPhrases.map((phrase, i) => (
              <button 
                key={i}
                onClick={() => handleQuickPhrase(phrase.text)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-white/80 text-sm transition-all hover:translate-x-1"
              >
                <span className="text-lg">{phrase.icon}</span>
                <span>{phrase.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 通知面板 */}
      {notifications.length > 0 && (
        <div className="absolute top-32 right-4 flex flex-col gap-2 pointer-events-auto max-w-xs">
          {notifications.slice(0, 3).map(n => (
            <div 
              key={n.id}
              className={`flex items-center gap-3 px-4 py-2 rounded-xl border animate-slide-in-right ${
                n.unread 
                  ? "bg-red-500/20 border-red-500/30" 
                  : "bg-black/60 border-white/10"
              }`}
            >
              <span className={n.unread ? "text-red-400" : "text-white/60"}>
                {n.unread ? "🔔" : "✓"}
              </span>
              <span className="text-white/80 text-sm flex-1">{n.text}</span>
              <span className="text-white/30 text-xs">{n.time}</span>
            </div>
          ))}
        </div>
      )}

      {/* 底部 - 操作提示 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none">
        <p className="text-white/20 text-xs">🖱️ 右键旋转 · 滚轮缩放 · 左键平移</p>
      </div>

      {/* 状态栏 - 底部 */}
      <div className="absolute bottom-0 left-0 right-0 h-7 bg-black/60 backdrop-blur-sm flex items-center justify-center gap-8 pointer-events-none border-t border-white/5">
        <span className="text-white/30 text-xs flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500"></span>
          ⚡ CPU {systemStats.cpu}%
        </span>
        <span className="text-white/30 text-xs flex items-center gap-1">
          💾 {systemStats.memory}GB
        </span>
        <span className="text-white/30 text-xs flex items-center gap-1">
          🔋 {Math.floor(systemStats.battery)}%
        </span>
        <span className="text-white/30 text-xs flex items-center gap-1">
          🌐 在线
        </span>
      </div>
    </section>
  );
};
