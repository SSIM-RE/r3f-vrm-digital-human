import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useTTS } from "../hooks/useTTS";
import { useVRMControl } from "../stores/useVRMControl";

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
  { id: 1, text: "准备面试作品集", done: false, urgent: true, deadline: "2026-03-29" },
  { id: 2, text: "学习 Three.js", done: true, urgent: false, deadline: null },
  { id: 3, text: "更新博客", done: false, urgent: false, deadline: "2026-03-30" },
  { id: 4, text: "健身 30 分钟", done: false, urgent: true, deadline: "今天" },
];

// 解析 Mico VRM 的回复（支持两种动作格式）
// 格式1: action (单个动作) - 预设动画版本
// 格式2: actions (动作数组) - DiP 版本
const parseMicoResponse = (responseText) => {
  let cleanText = responseText.trim();
  
  // 尝试从文本中提取 JSON（处理多种格式）
  // 1. 移除开头的 ```json 或 ```
  if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```json?\s*/, '').replace(/\s*```$/, '');
  }
  
  // 2. 尝试找到 JSON 块（处理 "嘿呀！... ```json {...} ```" 这种情况）
  const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        voiceText: parsed.voiceText || parsed.text || parsed.message || '',
        text: parsed.text || '',
        action: parsed.action || null,
        actions: parsed.actions || null,
        emotion: parsed.emotion || null,
        expressions: parsed.expressions || null
      };
    } catch (e) {
      // JSON 解析失败，继续尝试
    }
  }
  
  // 3. 直接解析（可能已经是纯 JSON）
  try {
    const parsed = JSON.parse(cleanText);
    return {
      voiceText: parsed.voiceText || parsed.text || parsed.message || '',
      text: parsed.text || '',
      action: parsed.action || null,
      actions: parsed.actions || null,
      emotion: parsed.emotion || null,
      expressions: parsed.expressions || null
    };
  } catch (e) {
    // 纯文本 fallback
    return { 
      voiceText: responseText, 
      text: responseText, 
      action: null, 
      actions: null, 
      emotion: null, 
      expressions: null 
    };
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
        const executeOnPlay = () => {
          // 优先使用 actions 数组（DiP 版本），其次使用 action（预设版本）
          if (micoResponse.actions && micoResponse.actions.length > 0) {
            // DiP 版本：调用连续动作生成
            testDipSequence(micoResponse.actions);
          } else if (micoResponse.action && micoResponse.action !== 'none') {
            // 预设版本：执行单个动作
            executeAction(micoResponse.action, expressions);
          } else {
            // 没有动作时，只设置表情
            setTargetExpressions(expressions);
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
  
  // 处理录音数据 - 统一使用文本输入的处理逻辑
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
        
        // 清空之前的回复
        setAiReply("");
        setAiReplyDetail("");
        
        // 通过代理发送到 Mico VRM Agent
        const requestBody = {
          model: "openclaw:mico-vrm",
          input: text,
          user: sessionKey
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
          
          // 解析 Mico VRM 的 JSON 回复（使用统一解析函数）
          const responseText = agentData.output?.[0]?.content?.[0]?.text || '';
          const micoResponse = parseMicoResponse(responseText);
          
          console.log('🔍 AI 原始返回:', responseText);
          console.log('🔍 解析后:', micoResponse);
          
          const voiceText = micoResponse.voiceText;
          const detailText = micoResponse.text;
          
          if (voiceText) {
            console.log('📝 Mico 简短回复:', voiceText);
            console.log('📋 Mico 详细回复:', detailText);
            setAiReply(voiceText);
            setAiReplyDetail(detailText && detailText !== voiceText ? detailText : "");
          }
          
          // 构建表情对象
          const expressions = {};
          if (micoResponse.emotion) {
            expressions[micoResponse.emotion] = 1;
          }
          if (micoResponse.expressions) {
            Object.assign(expressions, micoResponse.expressions);
          }
          
          // 执行动作和表情（与文本输入相同的逻辑）
          const executeOnPlay = () => {
            if (micoResponse.actions && micoResponse.actions.length > 0) {
              testDipSequence(micoResponse.actions);
            } else if (micoResponse.action && micoResponse.action !== 'none') {
              executeAction(micoResponse.action, expressions);
            } else {
              setTargetExpressions(expressions);
            }
          };
          
          if (voiceText) {
            ttsSpeak(voiceText, executeOnPlay);
          } else {
            executeOnPlay();
          }
        })
        .catch(err => {
          console.error('发送消息失败:', err);
        })
        .finally(() => {
          setVoiceStatus("idle");
        });
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

  // 编辑待办（设置截止日期）
  const [editingId, setEditingId] = useState(null);
  const [editDeadline, setEditDeadline] = useState('');

  const startEditDeadline = (todo) => {
    setEditingId(todo.id);
    setEditDeadline(todo.deadline || '');
  };

  const saveDeadline = (id) => {
    const newDeadline = editDeadline.trim() || null;
    setTodos(todos.map(t => t.id === id ? { ...t, deadline: newDeadline } : t));
    setEditingId(null);
    setEditDeadline('');
  };

  // 添加待办（支持紧急程度和截止日期）
  // 格式：文本 | 紧急 @日期 或 文本 @日期
  const addTodo = (input) => {
    if (!input.trim()) return;
    
    let text = input.trim();
    let urgent = false;
    let deadline = null;
    
    // 检查紧急标记
    if (text.includes('!')) {
      urgent = true;
      text = text.replace('!', '').trim();
    }
    
    // 检查截止日期 (格式: @今天, @明天, @2026-03-30)
    if (text.includes('@')) {
      const parts = text.split('@');
      text = parts[0].trim();
      deadline = parts[1].trim() || '今天';
    }
    
    setTodos([...todos, { 
      id: Date.now(), 
      text, 
      done: false, 
      urgent, 
      deadline 
    }]);
  };
  
  // 获取截止日期颜色（越近越红）
  const getDeadlineColor = (deadline) => {
    if (!deadline) return 'text-white/40';
    
    // 解析日期时间
    const now = new Date();
    let deadlineDate;
    
    if (deadline === '今天') {
      deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59);
    } else if (deadline === '明天') {
      deadlineDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59);
    } else if (deadline.includes('月')) {
      // 格式: 3月28日 18:00
      const match = deadline.match(/(\d+)月(\d+)日\s*(\d+)?:(\d+)?/);
      if (match) {
        const month = parseInt(match[1]);
        const day = parseInt(match[2]);
        const hour = match[3] ? parseInt(match[3]) : 23;
        const minute = match[4] ? parseInt(match[4]) : 59;
        deadlineDate = new Date(now.getFullYear(), month - 1, day, hour, minute);
      }
    } else {
      deadlineDate = new Date(deadline);
    }
    
    if (!deadlineDate || isNaN(deadlineDate)) return 'text-white/40';
    
    const diffHours = (deadlineDate - now) / (1000 * 60 * 60);
    
    if (diffHours < 0) return 'text-red-500'; // 已过期
    if (diffHours < 24) return 'text-orange-400'; // 今天内
    if (diffHours < 48) return 'text-yellow-400'; // 明天内
    return 'text-white/50'; // 未来
  };
  
  // 格式化截止日期显示
  const formatDeadline = (deadline) => {
    if (!deadline) return '+截止日期';
    return deadline;
  };
  
  // 按紧急程度和截止日期排序
  const sortedTodos = [...todos].sort((a, b) => {
    // 已完成放最后
    if (a.done !== b.done) return a.done ? 1 : -1;
    // 紧急的排前面
    if (a.urgent !== b.urgent) return a.urgent ? -1 : 1;
    // 按截止日期排序（越近越前）
    if (a.deadline && b.deadline) {
      const today = new Date().toLocaleDateString('zh-CN');
      const aDays = a.deadline === '今天' ? 0 : a.deadline === '明天' ? 1 : 
        a.deadline ? (new Date(a.deadline) - new Date(today)) / (1000*60*60*24) : 999;
      const bDays = b.deadline === '今天' ? 0 : b.deadline === '明天' ? 1 : 
        b.deadline ? (new Date(b.deadline) - new Date(today)) / (1000*60*60*24) : 999;
      return aDays - bDays;
    }
    // 有截止日期的排前面
    if (a.deadline && !b.deadline) return -1;
    if (!a.deadline && b.deadline) return 1;
    return 0;
  });

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
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-300 to-purple-400 flex items-center justify-center text-2xl shadow-lg shadow-pink-500/20 hover:scale-110 transition-transform cursor-pointer overflow-hidden">
          <img src="/models/Mico_V2.vrm" alt="Mico" className="w-full h-full object-cover" onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex';}} />
          <span className="hidden">🎀</span>
        </div>
        <div className="flex flex-col">
          <span className="text-white font-medium text-lg">Mico</span>
          <span className="text-pink-300/80 text-xs">私人助理</span>
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
        
        {/* 文本输入框 + 录音按钮 */}
        <div className="pointer-events-auto flex items-center gap-3">
          {/* 录音按钮 */}
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
          
          {/* 文本输入框 */}
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
        <div className="absolute left-20 top-1/2 -translate-y-1/2 bg-black/95 backdrop-blur-2xl p-6 rounded-3xl border border-white/10 pointer-events-auto w-80 animate-slide-in-right shadow-2xl">
          {/* 标题区 */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-white font-semibold text-xl">📝 待办事项</h3>
              <span className="text-white/40 text-xs">{new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full text-white text-sm font-medium">
                {todos.filter(t => t.done).length}/{todos.length}
              </span>
            </div>
          </div>
          
          {/* 进度条 */}
          <div className="h-2 bg-white/10 rounded-full mb-5 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-pink-400 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${todos.length ? (todos.filter(t => t.done).length / todos.length) * 100 : 0}%` }}
            />
          </div>
          
          {/* 待办列表 */}
          <div className="space-y-3 max-h-72 overflow-y-auto scrollbar-thin">
            {todos.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-4xl">✨</span>
                <p className="text-white/40 text-sm mt-2">暂无待办事项</p>
              </div>
            ) : (
              sortedTodos.map(todo => (
                <div 
                  key={todo.id} 
                  className={`flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 group transition-all ${todo.urgent ? "bg-red-500/10 border-l-4 border-red-500" : todo.done ? "bg-white/5" : "bg-white/5"}`}
                >
                  <button 
                    onClick={() => toggleTodo(todo.id)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${todo.done ? "bg-gradient-to-r from-pink-400 to-purple-500 border-transparent" : "border-white/30 hover:border-pink-400"}`}
                  >
                    {todo.done && <span className="text-white text-xs">✓</span>}
                  </button>
                  <div className="min-w-0">
                    <span className={`block text-sm transition-all ${todo.done ? "text-white/40 line-through" : "text-white/90"}`}>
                      {todo.text}
                    </span>
                  </div>
                  {todo.urgent && !todo.done && (
                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">紧急</span>
                  )}
                  {/* 点击截止日期进行编辑 */}
                  {editingId === todo.id ? (
                    <input
                      type="text"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      onBlur={() => saveDeadline(todo.id)}
                      onKeyDown={(e) => e.key === 'Enter' && saveDeadline(todo.id)}
                      placeholder="今天/明天/3月28日 18:00"
                      className="w-28 px-2 py-0.5 bg-white/20 border border-pink-500 rounded text-xs text-white focus:outline-none"
                      autoFocus
                    />
                  ) : (
                    <span 
                      onClick={() => startEditDeadline(todo)}
                      className={`cursor-pointer px-2 py-0.5 text-xs rounded-full hover:bg-white/10 whitespace-nowrap ${
                        todo.deadline === '今天' ? 'bg-orange-500/20' : 
                        todo.deadline === '明天' ? 'bg-yellow-500/20' :
                        'bg-white/10'
                      } ${getDeadlineColor(todo.deadline)}`}
                    >
                      {formatDeadline(todo.deadline)}
                    </span>
                  )}
                  <button 
                    onClick={() => deleteTodo(todo.id)}
                    className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-all p-1"
                  >
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
          
          {/* 添加新待办 */}
          <div className="mt-5 pt-4 border-t border-white/10">
            <div className="relative">
              <input 
                type="text"
                placeholder="添加新待办..."
                className="w-full bg-white/10 border border-white/10 rounded-xl px-4 py-3 text-white/90 text-sm placeholder-white/30 focus:outline-none focus:border-pink-500/50 focus:bg-white/15 transition-all"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.target.value.trim()) {
                    addTodo(e.target.value.trim());
                    e.target.value = "";
                  }
                }}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 text-xs">按 Enter 添加</span>
            </div>
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
