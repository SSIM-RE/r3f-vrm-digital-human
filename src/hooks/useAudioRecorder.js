import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * 麦克风录音 Hook - 带 VAD 自动截断
 * 用途：录制用户语音，检测静音后自动发送
 */
export const useAudioRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  
  // VAD 相关
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const vadTimerRef = useRef(null);
  const silenceTimeRef = useRef(0);
  
  // VAD 参数
  const VAD_THRESHOLD = 15;      // 音量阈值
  const VAD_INTERVAL = 50;       // 检测间隔 (ms)
  const SILENCE_THRESHOLD = 800; // 静音阈值 (ms)

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      // 1. 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true 
      });
      streamRef.current = stream;

      // 2. 创建录音机
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // 3. 收集音频数据
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // 4. 录音结束时处理
      mediaRecorder.onstop = () => {
        // 停止 VAD 检测
        if (vadTimerRef.current) {
          clearInterval(vadTimerRef.current);
          vadTimerRef.current = null;
        }
        
        // 停止 AudioContext
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        
        // 生成音频 Blob
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        
        // 保存到全局，方便测试
        window.lastAudioBlob = blob;
        
        setIsRecording(false);
        
        console.log('✅ 录音已停止, Blob大小:', blob.size);
      };

      // 5. 设置 VAD 分析
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      
      // 重置静音计时器
      silenceTimeRef.current = 0;

      // 6. 启动 VAD 检测循环
      vadTimerRef.current = setInterval(() => {
        if (!analyserRef.current || !mediaRecorderRef.current) return;
        
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // 计算平均音量
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        
        // 打印音量调试信息
        console.log('🔊 音量:', average.toFixed(1), '| 静音:', silenceTimeRef.current, 'ms');
        
        if (average > VAD_THRESHOLD) {
          // 有声音，重置计时器
          silenceTimeRef.current = 0;
        } else {
          // 静音，累计时间
          silenceTimeRef.current += VAD_INTERVAL;
          
          // 超过阈值，自动停止
          if (silenceTimeRef.current >= SILENCE_THRESHOLD) {
            console.log('🔇 检测到', SILENCE_THRESHOLD, 'ms 静音，准备停止...');
            
            // 清除定时器
            if (vadTimerRef.current) {
              clearInterval(vadTimerRef.current);
              vadTimerRef.current = null;
            }
            
            // 停止录音
            mediaRecorderRef.current.stop();
            console.log('📍 已调用 stop()');
          }
        }
      }, VAD_INTERVAL);

      // 7. 开始录音
      mediaRecorder.start(100);
      setIsRecording(true);
      
      console.log('🎙️ 开始录音 (VAD已启用)');
    } catch (error) {
      console.error('录音失败:', error);
    }
  }, []);

  // 停止录音（手动）
  const stopRecording = useCallback(() => {
    console.log('🛑 手动停止录音');
    
    // 停止 VAD
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
      vadTimerRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    // 停止麦克风
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
  }, []);

  // 释放资源
  const release = useCallback(() => {
    if (vadTimerRef.current) {
      clearInterval(vadTimerRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setAudioBlob(null);
    chunksRef.current = [];
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      release();
    };
  }, [release]);

  return {
    isRecording,
    audioBlob,
    startRecording,
    stopRecording,
    release
  };
};
