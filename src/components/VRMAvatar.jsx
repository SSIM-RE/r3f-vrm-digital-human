import { VRMLoaderPlugin, VRMUtils } from "@pixiv/three-vrm";
import { useAnimations, useFBX, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Face, Hand, Pose } from "kalidokit";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Euler, Object3D, Quaternion, Vector3 } from "three";
import { lerp } from "three/src/math/MathUtils.js";
import { useVideoRecognition } from "../hooks/useVideoRecognition";
import { remapMixamoAnimationToVrm } from "../utils/remapMixamoAnimationToVrm";
import { useVRMControl } from "../stores/useVRMControl";

// 默认设置
const DEFAULT_SETTINGS = {
  lookAtMouse: false,
  lipSyncScale: 0.5,
  aiMouthWeight: 0.3,
  animationFadeTime: 1.5,
};

const tmpVec3 = new Vector3();
const tmpQuat = new Quaternion();
const tmpEuler = new Euler();

export const VRMAvatar = ({ avatar, animation, ...props }) => {
  // 过滤无效模型
  const safeAvatar = avatar === 'model.vroid' ? '3859814441197244330.vrm' : avatar;
  
  // 使用 useState 来触发更新
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  
  // 监听来自 UI.jsx 控制面板的设置更新
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      setSettings(prev => ({ ...prev, ...e.detail }));
    };
    
    // 初始化
    const stored = localStorage.getItem('vrmSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      } catch (e) {}
    }
    
    window.addEventListener('vrmSettingsUpdate', handleSettingsUpdate);
    return () => window.removeEventListener('vrmSettingsUpdate', handleSettingsUpdate);
  }, []);
  
  const { scene, userData } = useGLTF(
    `models/${safeAvatar}`,
    undefined,
    undefined,
    (loader) => {
      loader.register((parser) => {
        return new VRMLoaderPlugin(parser);
      });
    }
  );

  // 动画文件列表（包含常用的 AI 动作）
  // 需要先定义 effectiveAnimation 来决定加载哪个动画

  // 获取 AI 控制状态
  const { expressions, targetExpressions, lipSyncExpressions, isSpeaking, lookAtMouse: aiLookAtMouse, executeCommand, executeAction, setTargetExpressions, updateExpressions, animation: aiAnimation } = useVRMControl();

  // AI 动作优先
  const effectiveAnimation = aiAnimation ? aiAnimation : animation;

  // 检查当前需要的动画是否在 Leva 选择的动画中
  const neededAnim = effectiveAnimation && effectiveAnimation !== "None" ? effectiveAnimation : null;
  const levAnim = animation && animation !== "None" ? animation : null;

  // 构建动画路径（同时加载 Leva 选择的和 AI 需要的）
  const animPath = levAnim ? `models/animations/${levAnim}.fbx` : null;
  const aiAnimPath = (neededAnim && neededAnim !== levAnim) ? `models/animations/${neededAnim}.fbx` : null;

  // 加载 Leva 动画
  const asset = animPath ? useFBX(animPath) : null;
  // 加载 AI 动画
  const aiAsset = aiAnimPath ? useFBX(aiAnimPath) : null;
  // 加载 Idle 动画（始终需要）
  const idleAsset = useFBX("models/animations/Breathing Idle.fbx");

  const currentVrm = userData.vrm;

  // 创建 Leva 动画 clip
  const animationClip = useMemo(() => {
    if (!asset || !currentVrm || !animation || animation === "None") return null;
    const clip = remapMixamoAnimationToVrm(currentVrm, asset);
    clip.name = animation;
    return clip;
  }, [asset, currentVrm, animation]);

  // 创建 AI 动画 clip
  const aiAnimationClip = useMemo(() => {
    if (!aiAsset || !currentVrm || !effectiveAnimation || effectiveAnimation === "None") return null;
    // 如果 AI 动画等于 Leva 动画，不需要重复创建
    if (effectiveAnimation === animation) return null;
    const clip = remapMixamoAnimationToVrm(currentVrm, aiAsset);
    clip.name = effectiveAnimation;
    return clip;
  }, [aiAsset, currentVrm, effectiveAnimation, animation]);

  // 创建 Idle 动画 clip（始终需要）
  const idleAnimationClip = useMemo(() => {
    if (!idleAsset || !currentVrm) return null;
    const clip = remapMixamoAnimationToVrm(currentVrm, idleAsset);
    clip.name = "Breathing Idle";
    return clip;
  }, [idleAsset, currentVrm]);

  // 合并所有动画 clip（使用 useMemo 缓存，避免不必要的重新创建）
  const allClips = useMemo(() =>
    [animationClip, aiAnimationClip, idleAnimationClip].filter(Boolean),
    [animationClip, aiAnimationClip, idleAnimationClip]
  );

  const { actions } = useAnimations(
    allClips,
    currentVrm?.scene
  );

  useEffect(() => {
    const vrm = userData.vrm;
    console.log("VRM loaded:", vrm);
    console.log("VRM version:", vrm.meta?.metaVersion);

    VRMUtils.removeUnnecessaryVertices(scene);
    VRMUtils.combineSkeletons(scene);
    VRMUtils.combineMorphs(vrm);

    vrm.scene.traverse((obj) => {
      obj.frustumCulled = false;
    });
  }, [scene]);

  const setResultsCallback = useVideoRecognition(
    (state) => state.setResultsCallback
  );
  const videoElement = useVideoRecognition((state) => state.videoElement);
  const riggedFace = useRef();
  const riggedPose = useRef();
  const riggedLeftHand = useRef();
  const riggedRightHand = useRef();

  // 随机眨眼计时器
  const blinkTimer = useRef(0);
  const nextBlinkTime = useRef(Math.random() * 3 + 3); // 3-6秒后眨眼
  const isBlinking = useRef(false);

  const resultsCallback = useCallback(
    (results) => {
      if (!videoElement || !currentVrm) {
        return;
      }
      if (results.faceLandmarks) {
        riggedFace.current = Face.solve(results.faceLandmarks, {
          runtime: "mediapipe",
          video: videoElement,
          imageSize: { width: 640, height: 480 },
          smoothBlink: false,
          blinkSettings: [0.25, 0.75],
        });
      }
      if (results.za && results.poseLandmarks) {
        riggedPose.current = Pose.solve(results.za, results.poseLandmarks, {
          runtime: "mediapipe",
          video: videoElement,
        });
      }

      // Switched left and right (Mirror effect)
      if (results.leftHandLandmarks) {
        riggedRightHand.current = Hand.solve(results.leftHandLandmarks, "Right");
      }
      if (results.rightHandLandmarks) {
        riggedLeftHand.current = Hand.solve(results.rightHandLandmarks, "Left");
      }
    },
    [videoElement, currentVrm]
  );

  useEffect(() => {
    setResultsCallback(resultsCallback);
  }, [resultsCallback]);
  
  // 使用 settings 状态或默认值
  const lookAtMouse = settings.lookAtMouse ?? DEFAULT_SETTINGS.lookAtMouse;
  const lipSyncScale = settings.lipSyncScale ?? DEFAULT_SETTINGS.lipSyncScale;
  const aiMouthWeight = settings.aiMouthWeight ?? DEFAULT_SETTINGS.aiMouthWeight;
  const animationFadeTime = settings.animationFadeTime ?? DEFAULT_SETTINGS.animationFadeTime;
  
  // 使用默认值
  const aa = 0, ih = 0, ee = 0, oh = 0, ou = 0;
  const blinkLeft = 0, blinkRight = 0;
  const angry = 0, sad = 0, happy = 0, surprised = 0, neutral = 1, relaxed = 0;
  // 表情幅度：播放语音时动态变化
  const getMaxEmotionScale = () => {
    if (!isSpeaking) return aiMouthWeight;
    // 使用正弦波动态变化，周期约2秒
    const time = Date.now() / 1000;
    const wave = Math.sin(time * Math.PI) * 0.5 + 0.5; // 0-1 波动
    return aiMouthWeight * (0.5 + wave * 1.5); // 在 0.5x ~ 2x 之间波动
  };
  const transitionSpeed = 3;
  
  // 表情控制（应用幅度限制）
  const emotionKeys = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'relaxed'];
  const limitedExpressions = {};
  for (const key in expressions) {
    if (emotionKeys.includes(key)) {
      limitedExpressions[key] = Math.min(expressions[key], getMaxEmotionScale());
    } else {
      limitedExpressions[key] = expressions[key];
    }
  }
  const limitedTarget = {};
  for (const key in targetExpressions) {
    if (emotionKeys.includes(key)) {
      limitedTarget[key] = Math.min(targetExpressions[key], getMaxEmotionScale());
    } else {
      limitedTarget[key] = targetExpressions[key];
    }
  }
  const aiExpressions = {
    ...limitedExpressions,
    ...limitedTarget,
  };

  // 嘴巴直接使用 VRM 端处理后的 expressions
  const mouthExpressions = expressions;

  // 合并注视鼠标状态（Leva 优先）
  const isLookAtMouse = lookAtMouse || aiLookAtMouse;

  // 暴露 executeCommand 给全局
  useEffect(() => {
    window.vrmExecuteCommand = executeCommand;
    window.vrmExecuteAction = executeAction;
    window.vrmSetExpression = (emotion, value) => {
      setTargetExpressions({ [emotion]: value });
    };

    // 监听 TTS 结束事件
    // TTS 结束后，VRMAvatar.jsx 会自动处理：
    // - hasTtsData = false 时，口型设为 0
    // - AI 表情（happy=0.9）已在 targetExpressions，VRM 自动应用其嘴巴映射
    const handleTtsEnded = () => {
      // 不需要做任何处理，口型会在渲染时自动恢复
    };
    window.addEventListener('ttsEnded', handleTtsEnded);

    // 监听来自 OpenClaw 的消息 (BroadcastChannel)
    const channel = new BroadcastChannel('vrm-control');
    channel.onmessage = (event) => {
      console.log('收到 VRM 控制命令:', event.data);
      const result = executeCommand(event.data);
      // 回复结果
      channel.postMessage({ success: result.success, action: result.action });
    };

    return () => {
      delete window.vrmExecuteCommand;
      delete window.vrmExecuteAction;
      delete window.vrmSetExpression;
      window.removeEventListener('ttsEnded', handleTtsEnded);
      channel.close();
    };
  }, [executeCommand, executeAction, setTargetExpressions]);

  // 始终播放的 Idle 动画（后台循环）
  const idleAnimation = "Breathing Idle";
  const idleAction = actions?.[idleAnimation];

  // 使用 ref 跟踪当前动画状态
  const animationStateRef = useRef({
    currentAction: null,
    lastAnimation: null
  });

  // Play selected animation - simplified
  useEffect(() => {
    if (!actions || !idleAction || videoElement) return;

    // ALWAYS ensure Idle is running in background
    if (!idleAction.isRunning()) {
      idleAction.reset().play();
      idleAction.time = 0.05; // Skip T-pose
    }

    // Get target animation
    const targetAnimation = effectiveAnimation;


    // Skip if same as before
    if (animationStateRef.current.lastAnimation === targetAnimation) return;
    animationStateRef.current.lastAnimation = targetAnimation;

    // If targeting Idle or None, ensure Idle continues running
    if (!targetAnimation || targetAnimation === 'None' || targetAnimation === idleAnimation) {

      // Fade out current action (if any)
      if (animationStateRef.current.currentAction) {
        animationStateRef.current.currentAction.fadeOut(animationFadeTime).play();
        animationStateRef.current.currentAction = null;
      }

      // Fade in Idle
      const idleDuration = idleAction.getClip().duration;
      idleAction.reset().fadeIn(animationFadeTime).play();
      idleAction.time = Math.min(0.05, idleDuration * 0.01);
      return;
    }

    // Play AI action
    const action = actions[targetAnimation];

    if (action) {
      // Fade out previous action
      if (animationStateRef.current.currentAction) {
        animationStateRef.current.currentAction.fadeOut(animationFadeTime).play();
      }

      // Crossfade from Idle (keep Idle running, just reduce weight)
      idleAction.fadeOut(animationFadeTime).play();

      // Skip first frame and play
      const clipDuration = action.getClip().duration;
      const startTime = Math.min(0.05, clipDuration * 0.01);
      action.reset().fadeIn(animationFadeTime);
      action.time = startTime;
      action.play();

      animationStateRef.current.currentAction = action;
    }
  }, [actions, effectiveAnimation, videoElement, idleAction, idleAnimation]);

  const lerpExpression = (name, value, lerpFactor) => {
    userData.vrm.expressionManager.setValue(
      name,
      lerp(userData.vrm.expressionManager.getValue(name), value, lerpFactor)
    );
  };

  const rotateBone = (boneName, value, slerpFactor, flip = { x: 1, y: 1, z: 1 }) => {
    const bone = userData.vrm.humanoid.getNormalizedBoneNode(boneName);
    if (!bone) return;

    // VRM 1 需要特殊处理
    const isVRM1 = userData.vrm.meta?.metaVersion === "1";

    let finalFlip = flip;
    if (isVRM1) {
      // VRM 1: 翻转 X 和 Z 轴
      finalFlip = { x: -flip.x, y: flip.y, z: -flip.z };
    }

    tmpEuler.set(value.x * finalFlip.x, value.y * finalFlip.y, value.z * finalFlip.z);
    tmpQuat.setFromEuler(tmpEuler);
    bone.quaternion.slerp(tmpQuat, slerpFactor);
  };

  useFrame((_, delta) => {
    if (!userData.vrm) return;

    // ========== 随机眨眼逻辑 ==========
    blinkTimer.current += delta;
    if (!isBlinking.current && blinkTimer.current >= nextBlinkTime.current) {
      // 开始眨眼
      isBlinking.current = true;
      blinkTimer.current = 0;
    }
    if (isBlinking.current) {
      // 眨眼中 (0.15秒)
      if (blinkTimer.current < 0.15) {
        // 闭眼
        lerpExpression('blinkLeft', 1, delta * 30);
        lerpExpression('blinkRight', 1, delta * 30);
      } else {
        // 睁眼
        lerpExpression('blinkLeft', 0, delta * 30);
        lerpExpression('blinkRight', 0, delta * 30);
        if (blinkTimer.current > 0.3) {
          // 眨眼结束，重置
          isBlinking.current = false;
          blinkTimer.current = 0;
          nextBlinkTime.current = Math.random() * 3 + 3; // 3-6秒后下次眨眼
        }
      }
    }
    // ========== 随机眨眼结束 ==========

    // 更新表情渐变
    updateExpressions(delta);

    // 鼠标注视功能
    if (isLookAtMouse && !videoElement && userData.vrm.lookAt) {
      // 使用 three 的 unproject 将鼠标位置转换为 3D 坐标
      const mouse = state.pointer;
      const vector = new Vector3(mouse.x, mouse.y, 0);
      vector.unproject(state.camera);

      // 创建一个 Object3D 作为目标点
      if (!lookAtMouseTarget.current) {
        lookAtMouseTarget.current = new Object3D();
        state.scene.add(lookAtMouseTarget.current);
      }

      // 让目标点跟随鼠标（在相机前方一定距离）
      const targetPos = new Vector3(mouse.x * 5, mouse.y * 5 + 1, 3);
      lookAtMouseTarget.current.position.copy(targetPos);
      lookAtMouseTarget.current.updateMatrixWorld();

      // 设置注视目标
      userData.vrm.lookAt.target = lookAtMouseTarget.current;
    }

    // 根据 VRM 版本设置表情（只使用 AI 表情，不含口型）
    const getExpressionValue = (name) => {
      // AI 控制的值优先
      if (aiExpressions[name] !== undefined && aiExpressions[name] > 0) {
        return aiExpressions[name];
      }
      // 否则使用 Leva 控制的值
      return eval(name);
    };

    if (isVRM1) {
      // VRM 1.0 表情
      userData.vrm.expressionManager.setValue("neutral", getExpressionValue("neutral"));
      userData.vrm.expressionManager.setValue("happy", getExpressionValue("happy"));
      userData.vrm.expressionManager.setValue("sad", getExpressionValue("sad"));
      userData.vrm.expressionManager.setValue("angry", getExpressionValue("angry"));
      userData.vrm.expressionManager.setValue("surprised", getExpressionValue("surprised"));
      userData.vrm.expressionManager.setValue("relaxed", getExpressionValue("relaxed"));
    } else {
      // VRM 0.x 表情
      userData.vrm.expressionManager.setValue("angry", getExpressionValue("angry"));
      userData.vrm.expressionManager.setValue("sad", getExpressionValue("sad"));
      userData.vrm.expressionManager.setValue("happy", getExpressionValue("happy"));
      userData.vrm.expressionManager.setValue("Surprised", getExpressionValue("surprised"));
      userData.vrm.expressionManager.setValue("neutral", getExpressionValue("neutral"));
      userData.vrm.expressionManager.setValue("relaxed", getExpressionValue("relaxed"));
    }

    // 嘴型和眨眼
    if (!videoElement) {
      // TTS 口型控制
      if (isSpeaking) {
        // TTS 播放：AI 表情 + TTS 口型叠加
        const mouthShapes = [
          { name: "aa", source: lipSyncExpressions.aa || 0 },
          { name: "ih", source: lipSyncExpressions.ih || 0 },
          { name: "ee", source: lipSyncExpressions.ee || 0 },
          { name: "oh", source: lipSyncExpressions.oh || 0 },
          { name: "ou", source: lipSyncExpressions.ou || 0 },
        ];

        mouthShapes.forEach(item => {
          // TTS 幅度控制
          const scaledSource = item.source * lipSyncScale;
          lerpExpression(item.name, scaledSource, delta * 30);
        });
      } else {
        // TTS 停止：切换到 neutral（使用 setTargetExpressions 触发渐变过渡）
        setTargetExpressions({ neutral: 1 });
      }
    } else {
      if (riggedFace.current) {
        [{ name: "aa", value: riggedFace.current.mouth.shape.A },
         { name: "ih", value: riggedFace.current.mouth.shape.I },
         { name: "ee", value: riggedFace.current.mouth.shape.E },
         { name: "oh", value: riggedFace.current.mouth.shape.O },
         { name: "ou", value: riggedFace.current.mouth.shape.U },
         { name: "blinkLeft", value: 1 - riggedFace.current.eye.l },
         { name: "blinkRight", value: 1 - riggedFace.current.eye.r }].forEach(item => {
          lerpExpression(item.name, item.value, delta * 12);
        });

        if (lookAtTarget.current) {
          userData.vrm.lookAt.target = lookAtTarget.current;
          lookAtDestination.current.set(-2 * riggedFace.current.pupil.x, 2 * riggedFace.current.pupil.y, 0);
          lookAtTarget.current.position.lerp(lookAtDestination.current, delta * 5);
        }

        rotateBone("neck", riggedFace.current.head, delta * 5, { x: 0.7, y: 0.7, z: 0.7 });
      }

      if (riggedPose.current) {
        const pose = riggedPose.current;

        rotateBone("chest", pose.Spine, delta * 5, { x: 0.3, y: 0.3, z: 0.3 });
        rotateBone("spine", pose.Spine, delta * 5, { x: 0.3, y: 0.3, z: 0.3 });
        rotateBone("hips", pose.Hips.rotation, delta * 5, { x: 0.7, y: 0.7, z: 0.7 });

        rotateBone("leftUpperArm", pose.LeftUpperArm, delta * 5);
        rotateBone("leftLowerArm", pose.LeftLowerArm, delta * 5);
        rotateBone("rightUpperArm", pose.RightUpperArm, delta * 5);
        rotateBone("rightLowerArm", pose.RightLowerArm, delta * 5);

        if (riggedLeftHand.current) {
          const h = riggedLeftHand.current;
          rotateBone("leftHand", { z: pose.LeftHand.z, y: h.LeftWrist.y, x: h.LeftWrist.x }, delta * 12);
          rotateBone("leftRingProximal", h.LeftRingProximal, delta * 12);
          rotateBone("leftRingIntermediate", h.LeftRingIntermediate, delta * 12);
          rotateBone("leftRingDistal", h.LeftRingDistal, delta * 12);
          rotateBone("leftIndexProximal", h.LeftIndexProximal, delta * 12);
          rotateBone("leftIndexIntermediate", h.LeftIndexIntermediate, delta * 12);
          rotateBone("leftIndexDistal", h.LeftIndexDistal, delta * 12);
          rotateBone("leftMiddleProximal", h.LeftMiddleProximal, delta * 12);
          rotateBone("leftMiddleIntermediate", h.LeftMiddleIntermediate, delta * 12);
          rotateBone("leftMiddleDistal", h.LeftMiddleDistal, delta * 12);
          rotateBone("leftThumbProximal", h.LeftThumbProximal, delta * 12);
          rotateBone("leftThumbMetacarpal", h.LeftThumbIntermediate, delta * 12);
          rotateBone("leftThumbDistal", h.LeftThumbDistal, delta * 12);
          rotateBone("leftLittleProximal", h.LeftLittleProximal, delta * 12);
          rotateBone("leftLittleIntermediate", h.LeftLittleIntermediate, delta * 12);
          rotateBone("leftLittleDistal", h.LeftLittleDistal, delta * 12);
        }
        if (riggedRightHand.current) {
          const h = riggedRightHand.current;
          rotateBone("rightHand", { z: pose.RightHand.z, y: h.RightWrist.y, x: h.RightWrist.x }, delta * 12);
          rotateBone("rightRingProximal", h.RightRingProximal, delta * 12);
          rotateBone("rightRingIntermediate", h.RightRingIntermediate, delta * 12);
          rotateBone("rightRingDistal", h.RightRingDistal, delta * 12);
          rotateBone("rightIndexProximal", h.RightIndexProximal, delta * 12);
          rotateBone("rightIndexIntermediate", h.RightIndexIntermediate, delta * 12);
          rotateBone("rightIndexDistal", h.RightIndexDistal, delta * 12);
          rotateBone("rightMiddleProximal", h.RightMiddleProximal, delta * 12);
          rotateBone("rightMiddleIntermediate", h.RightMiddleIntermediate, delta * 12);
          rotateBone("rightMiddleDistal", h.RightMiddleDistal, delta * 12);
          rotateBone("rightThumbProximal", h.RightThumbProximal, delta * 12);
          rotateBone("rightThumbMetacarpal", h.RightThumbIntermediate, delta * 12);
          rotateBone("rightThumbDistal", h.RightThumbDistal, delta * 12);
          rotateBone("rightLittleProximal", h.RightLittleProximal, delta * 12);
          rotateBone("rightLittleIntermediate", h.RightLittleIntermediate, delta * 12);
          rotateBone("rightLittleDistal", h.RightLittleDistal, delta * 12);
        }
      }
    }

    userData.vrm.update(delta);
  });

  const lookAtDestination = useRef(new Vector3(0, 0, 0));
  const lookAtMouseTarget = useRef(null);
  const camera = useThree((state) => state.camera);
  const state = useThree();
  const lookAtTarget = useRef();
  useEffect(() => {
    lookAtTarget.current = new Object3D();
    camera.add(lookAtTarget.current);
  }, [camera]);

  // 检测 VRM 版本
  const isVRM1 = userData.vrm?.meta?.metaVersion === "1";

  // VRM 1.0 模型朝向处理
  const getRotationY = () => {
    if (isVRM1) {
      // VRM 1.0 默认面向前
      return 0;
    }
    // VRM 0.x 需要翻转
    return avatar === "3636451243928341470.vrm" ? 0 : Math.PI;
  };

  return (
    <group {...props}>
      <primitive
        object={scene}
        rotation-y={getRotationY()}
      />
    </group>
  );
};
