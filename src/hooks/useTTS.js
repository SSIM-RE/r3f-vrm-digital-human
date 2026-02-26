import { useState, useCallback, useRef } from 'react';
import { useVRMControl } from '../stores/useVRMControl';

const API_URL = '/tts';
const REF_AUDIO = 'D:\\ref_v2.wav';

export function useTTS() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);
  const audioRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const lipSyncCallbackRef = useRef(null);
  const animationFrameRef = useRef(null);
  
  // 平滑处理 - 保存上一帧值
  const prevLipSyncRef = useRef({ aa: 0, ih: 0, ee: 0, oh: 0, ou: 0 });

  const initModel = useCallback(async () => {
    try {
      const response = await fetch(API_URL, { method: 'GET', signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch (err) {
      return false;
    }
  }, []);

  const setLipSyncCallback = useCallback((callback) => {
    lipSyncCallbackRef.current = callback;
  }, []);

  /**
   * 改进的口型同步 - 频谱分析
   * 原理：不同元音的频率分布不同
   * - aa (啊): 低频为主，宽带元音
   * - ih (一): 中频为主
   * - ee (诶): 中高频为主
   * - oh (哦): 低频为主，圆唇元音
   * - ou (哦): 高频为主，圆唇元音
   */
  const analyzeAudio = useCallback(() => {
    if (!analyserRef.current || !lipSyncCallbackRef.current) {
      return;
    }
    
    // 获取频域数据
    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);
    
    // 获取时域数据（用于检测音量和清音/浊音）
    const timeDataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteTimeDomainData(timeDataArray);
    
    // 计算音量 (RMS)
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = (timeDataArray[i] - 128) / 128;
      sum += v * v;
    }
    const volume = Math.sqrt(sum / bufferLength);
    
    // 最小音量阈值
    const minVolume = 0.01;
    if (volume < minVolume) {
      // 音量太小时不更新 lipSyncExpressions，保持当前值
      if (audioRef.current && !audioRef.current.paused) {
        animationFrameRef.current = requestAnimationFrame(analyzeAudio);
      }
      return;
    }
    
    // 频段划分 (根据 fftSize=512, 44100Hz 采样率)
    // 每个 bin = 44100 / 512 ≈ 86 Hz
    const lowEnd = Math.floor(bufferLength * 0.15);   // 0-1300Hz 低频
    const midEnd = Math.floor(bufferLength * 0.5);    // 1300-4300Hz 中频  
    // 4300+Hz 高频
    
    // 计算各频段能量
    let lowSum = 0, midSum = 0, highSum = 0;
    for (let i = 0; i < lowEnd; i++) lowSum += dataArray[i];
    for (let i = lowEnd; i < midEnd; i++) midSum += dataArray[i];
    for (let i = midEnd; i < bufferLength; i++) highSum += dataArray[i];
    
    const lowAvg = lowSum / lowEnd / 255;
    const midAvg = midSum / (midEnd - lowEnd) / 255;
    const highAvg = highSum / (bufferLength - midEnd) / 255;
    
    // 优化后的映射算法
    // 降低整体幅度，增加各元音区分度
    
    // 计算各频段相对强度
    const total = lowAvg + midAvg + highAvg + 0.001;
    const lowRatio = lowAvg / total;
    const midRatio = midAvg / total;
    const highRatio = highAvg / total;
    
    // 归一化音量 (0-1)
    const normalizedVolume = Math.min(1, volume * 3);
    
    // 简化版口型同步：直接用音量驱动 aa
    // 原因：频率映射对中文效果不佳，简化为 RMS 驱动 aa
    const lipSyncScale = useVRMControl.getState().lipSyncScale || 0.5;
    
    const aa = normalizedVolume > 0.05 
      ? Math.min(1, normalizedVolume * lipSyncScale * 2)
      : 0;
    
    // 其他元音保持简化
    const ih = 0;
    const ee = 0;
    const oh = 0;
    const ou = 0;
    
    // 直接发送（不做平滑，由 VRM 端处理）
    lipSyncCallbackRef.current({ aa, ih, ee, oh, ou });

    if (audioRef.current && !audioRef.current.paused) {
      animationFrameRef.current = requestAnimationFrame(analyzeAudio);
    }
  }, []);

  const initAudioAnalyzer = useCallback((audioElement) => {
    try {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 1024;  // 提高到 1024 获取更精细的频谱
      analyserRef.current.smoothingTimeConstant = 0.9;  // 提高平滑度
      const source = audioContextRef.current.createMediaElementSource(audioElement);
      source.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    } catch (err) {
      console.warn('Audio analyzer init failed:', err);
    }
  }, []);

  const speak = useCallback(async (text, onPlay) => {
    if (!text || isSpeaking) return;
    
    const cleanText = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s,.!?，。！？、…—]/g, '');
    
    setIsSpeaking(true);
    setError(null);
    
    try {
      // 先设置模型权重（可选，如果服务已设置则跳过）
      try {
        await fetch('/set_gpt_weights?weights_path=GPT_weights_v2Pro/可莉_ZH-e10.ckpt', { 
          signal: AbortSignal.timeout(10000) 
        });
        console.log('🎤 模型已设置');
      } catch (e) {
        console.log('🎤 模型设置跳过或已存在');
      }
      
      // api_v2.py 参数
      const params = new URLSearchParams({
        text: cleanText, 
        text_lang: 'zh', 
        ref_audio_path: REF_AUDIO,
        prompt_text: '玩得太开心忘忘在脑后', 
        prompt_lang: 'zh',
        speed_factor: 1.0,
      });
      
      console.log('🎤 TTS 请求:', Object.fromEntries(params));
      
      // 请求 /tts 端点
      const response = await fetch(`/tts?${params}`, { signal: AbortSignal.timeout(120000) });
      if (!response.ok) throw new Error(`TTS failed: ${response.status}`);
      
      const audioBlob = await response.blob();
      console.log('🎤 TTS 响应:', audioBlob.size, 'bytes');
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) audioRef.current.pause();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      
      audioRef.current = new Audio(audioUrl);
      
      // 确保 AudioContext 和 Analyser 存在
      if (!audioContextRef.current) {
        initAudioAnalyzer(audioRef.current);
      } else if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      
      // 重新连接音频源到分析器（每次播放都需要）
      if (audioContextRef.current && analyserRef.current) {
        try {
          // 检查是否已经连接（防止重复连接错误）
          // 如果需要，可以断开旧连接
          const source = audioContextRef.current.createMediaElementSource(audioRef.current);
          source.connect(analyserRef.current);
          analyserRef.current.connect(audioContextRef.current.destination);
          console.log('🔊 音频分析器已连接');
        } catch (e) {
          // 可能因为 AudioElementSource 已经连接（浏览器限制）
          console.log('🔊 音频源已存在，跳过连接');
        }
      } else {
        console.warn('⚠️ AudioContext 或 Analyser 未就绪');
      }
      
      audioRef.current.onplay = () => {
        if (audioContextRef.current?.state === 'suspended') audioContextRef.current.resume();
        if (onPlay) onPlay();
        if (lipSyncCallbackRef.current && analyserRef.current) {
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = requestAnimationFrame(analyzeAudio);
        }
      };
      
      audioRef.current.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        // TTS 结束时不做任何处理，让 VRMAvatar 判断 hasTtsData
        // 触发表情恢复（通过全局事件）
        window.dispatchEvent(new CustomEvent('ttsEnded'));
      };
      
      audioRef.current.onerror = () => {
        setIsSpeaking(false);
        setError('Playback failed');
        URL.revokeObjectURL(audioUrl);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };
      
      await audioRef.current.play();
    } catch (err) {
      setError(err.message);
      setIsSpeaking(false);
    }
  }, [isSpeaking, initAudioAnalyzer, analyzeAudio]);

  const stop = useCallback(() => {
    if (audioRef.current) audioRef.current.pause();
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    if (lipSyncCallbackRef.current) lipSyncCallbackRef.current({ aa: 0, ih: 0, ee: 0, oh: 0, ou: 0 });
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking, setIsSpeaking, error, initModel, setLipSyncCallback };
}
