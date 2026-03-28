/**
 * DiP 动作生成 Hook
 * 用于调用 WSL2 DiP Server 生成动作并应用到 VRM
 */

import { useState, useCallback, useRef } from 'react'

const DIP_API_URL = '/api/generate'
const DIP_HEALTH_URL = '/api/health'

/**
 * 获取 DiP 提示词（直接返回输入）
 */
export function getDipPrompt(actionName) {
  return actionName
}

/**
 * DiP Motion Hook
 */
export function useDipMotion() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [motionData, setMotionData] = useState(null)
  const [error, setError] = useState(null)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  
  // 使用 ref 存储 motionData，避免异步问题
  const motionDataRef = useRef(null)
  
  // 播放相关
  const animationRef = useRef(null)
  const frameRef = useRef(0)
  
  /**
   * 健康检查
   */
  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(DIP_HEALTH_URL)
      return response.ok
    } catch (e) {
      console.warn('[DiP] Health check failed:', e)
      return false
    }
  }, [])

  /**
   * 停止播放
   */
  const stop = useCallback(() => {
    setIsPlaying(false)
    if (animationRef.current) {
      clearTimeout(animationRef.current)
      animationRef.current = null
    }
  }, [])

  /**
   * 生成动作
   * @param {string} prompt - DiP 提示词 (如 "wave hand")
   * @returns {Promise<Object>} - 动作数据
   */
  const generateMotion = useCallback(async (prompt) => {
    setIsGenerating(true)
    setError(null)
    
    try {
      const response = await fetch(DIP_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      })
      
      if (!response.ok) {
        throw new Error(`DiP API error: ${response.status}`)
      }
      
      const data = await response.json()
      
      console.log('[DiP] Response data:', data)
      
      if (data.status !== 'ok') {
        throw new Error(data.message || 'Generation failed')
      }
      
      console.log('[DiP] Generated motion:', {
        prompt: data.prompt,
        joints: data.joints,
        frames: data.frames,
        fps: data.fps,
        hasMotion: !!data.motion,
        hmlNames: data.hml_names,
        firstFrame: data.motion?.[0]?.slice(0, 3),  // 前3个关节
      })
      
      // 存储动作数据 - 不翻转 Z 轴
      const flippedMotion = data.motion
      
      const motion = {
        prompt: data.prompt,
        motion: flippedMotion, // [frames][joints][3] 位置数据（已翻转 X 和 Z）
        joints: data.joints,
        frames: data.frames,
        fps: data.fps,
        hmlNames: data.hml_names,
      }
      
      // 同时设置 state 和 ref
      setMotionData(motion)
      motionDataRef.current = motion
      setCurrentFrame(0)
      
      console.log('[DiP] Motion data set, ready to play')
      
      return motion
      
    } catch (err) {
      console.error('[DiP] Generate error:', err)
      setError(err.message)
      throw err
    } finally {
      setIsGenerating(false)
    }
  }, [])

  /**
   * 生成动作 (通过动作名称)
   * @param {string} actionName - 动作名称 (如 "wave", "nod")
   */
  const generateByAction = useCallback(async (actionName) => {
    const prompt = getDipPrompt(actionName)
    console.log('[DiP] Generating action:', actionName, '-> prompt:', prompt)
    return generateMotion(prompt)
  }, [generateMotion])

  /**
   * 开始播放动作
   * @param {Function} onFrame - 每帧回调，参数为 (frameIndex, motionFrame)
   * @param {Function} onComplete - 播放完成回调
   */
  const play = useCallback((onFrame, onComplete) => {
    // 使用 ref 获取最新的 motionData
    const data = motionDataRef.current || motionData
    if (!data || !data.motion) {
      console.warn('[DiP] No motion data to play', { ref: !!motionDataRef.current, state: !!motionData })
      return
    }
    
    console.log('[DiP] Starting playback, isPlaying:', isPlaying)
    
    // 停止之前的播放
    if (isPlaying) {
      console.log('[DiP] Stopping previous playback')
      if (animationRef.current) {
        clearTimeout(animationRef.current)
        animationRef.current = null
      }
    }
    
    setIsPlaying(true)
    frameRef.current = 0
    
    const fps = data.fps
    const frameInterval = 1000 / fps
    console.log('[DiP] FPS:', fps, 'Interval:', frameInterval)
    
    const playFrame = () => {
      const frame = frameRef.current
      
      console.log('[DiP] Playing frame:', frame, '/', data.frames, 'motion length:', data.motion?.length)
      
      if (frame >= data.frames) {
        // 播放完成
        console.log('[DiP] Playback completed')
        setIsPlaying(false)
        window.vrmForDipPlaying = false
        if (onComplete) onComplete()
        return
      }
      
      const motionFrame = data.motion[frame]
      
      // 调用帧回调
      if (onFrame) {
        onFrame(frame, motionFrame)
      }
      
      setCurrentFrame(frame)
      
      frameRef.current++
      
      // 下一帧
      animationRef.current = setTimeout(playFrame, frameInterval)
    }
    
    playFrame()
    
  }, []) // 移除依赖，让函数始终是最新的

  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    stop()
    setMotionData(null)
    motionDataRef.current = null
    setCurrentFrame(0)
    setError(null)
  }, [stop])

  return {
    // 状态
    isGenerating,
    motionData,
    error,
    currentFrame,
    isPlaying,
    frames: motionData?.frames || 0,
    fps: motionData?.fps || 20,
    
    // 方法
    checkHealth,
    generateMotion,
    generateByAction,
    play,
    stop,
    reset,
  }
}
