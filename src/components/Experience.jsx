import { CameraControls, Grid } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useRef, useState, useEffect } from "react";
import { VRMAvatar } from "./VRMAvatar";

// 默认值
const DEFAULT_HEIGHT = -1.25;

export const Experience = () => {
  const controls = useRef();
  const [avatar, setAvatar] = useState("3859814441197244330.vrm");
  const [animation, setAnimation] = useState("Breathing Idle");
  const [avatarHeight, setAvatarHeight] = useState(DEFAULT_HEIGHT);
  
  // 监听来自 UI.jsx 控制面板的设置更新
  useEffect(() => {
    const handleSettingsUpdate = (e) => {
      if (e.detail.avatar !== undefined) setAvatar(e.detail.avatar);
      if (e.detail.animation !== undefined) setAnimation(e.detail.animation);
      if (e.detail.height !== undefined) setAvatarHeight(e.detail.height);
    };
    
    // 初始化
    const stored = localStorage.getItem('vrmSettings');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed.avatar) setAvatar(parsed.avatar);
        if (parsed.animation) setAnimation(parsed.animation);
      } catch (e) {}
    }
    
    const height = localStorage.getItem('vrmAvatarHeight');
    if (height) setAvatarHeight(parseFloat(height));
    
    window.addEventListener('vrmSettingsUpdate', handleSettingsUpdate);
    return () => window.removeEventListener('vrmSettingsUpdate', handleSettingsUpdate);
  }, []);

  return (
    <>
      <CameraControls
        ref={controls}
        maxPolarAngle={Math.PI / 2}
        minDistance={1}
        maxDistance={10}
      />
      
      {/* 环境光 */}
      <ambientLight intensity={0.6} color="#1a1a2e" />
      
      {/* 主光源 */}
      <directionalLight intensity={1.8} position={[5, 8, 5]} color="#cce0ff" castShadow />
      
      {/* 补光 */}
      <directionalLight intensity={0.72} position={[-5, 5, -5]} color="#4488ff" />
      
      {/* 环形光 */}
      <pointLight intensity={1.5} position={[0, 2, 3]} color="#9966ff" />
      <pointLight intensity={1.2} position={[0, 2, -3]} color="#ff6699" />
      
      {/* 底部补光 */}
      <pointLight intensity={0.5} position={[0, -1, 2]} color="#00ccff" />
      
      {/* 网格地面 */}
      <Grid
        position={[0, -0.98, 0]}
        args={[30, 30]}
        cellSize={0.5}
        cellThickness={0.5}
        cellColor="#1a1a2e"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#2a2a4e"
        fadeDistance={25}
        fadeStrength={0.5}
        infiniteGrid={true}
      />
      
      {/* 黑色背景 */}
      <color attach="background" args={["#000000"]} />
      
      {/* 后处理效果 */}
      <EffectComposer>
        <Bloom 
          intensity={0.4}
          luminanceThreshold={0.8}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      </EffectComposer>
      
      {/* VRM Avatar */}
      <group position-y={avatarHeight}>
        <VRMAvatar key={avatar} avatar={avatar} animation={animation} />
      </group>
    </>
  );
};