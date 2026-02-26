import { CameraControls, Grid } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { useControls } from "leva";
import { useRef } from "react";
import { VRMAvatar } from "./VRMAvatar";

// Auto-scan using Vite glob - paths are relative to this file
const vrmGlob = import.meta.glob("../../public/models/*.vrm", { query: "?url", import: "default", eager: true });
const animGlob = import.meta.glob("../../public/models/animations/*.fbx", { query: "?url", import: "default", eager: true });

const vrmOptions = Object.keys(vrmGlob).map(p => p.replace("../../public/models/", ""));
const animOptions = ["None", ...Object.keys(animGlob).map(p => p.replace("../../public/models/animations/", "").replace(".fbx", ""))];

export const Experience = () => {
  const controls = useRef();

  const { 
    avatar, animation, 
    ambientIntensity, mainLightIntensity, 
    bloomIntensity, 
    avatarHeight, groundHeight
  } = useControls("VRM", {
    avatar: {
      value: vrmOptions[0] || "3859814441197244330.vrm",
      options: vrmOptions.length > 0 ? vrmOptions : ["3859814441197244330.vrm"],
    },
    animation: {
      value: "Breathing Idle",
      options: animOptions.length > 0 ? animOptions : ["None"],
    },
    // 灯光控制
    ambientIntensity: { value: 0.6, min: 0, max: 2, step: 0.1, label: "环境光强度" },
    mainLightIntensity: { value: 1.8, min: 0, max: 5, step: 0.1, label: "主光强度" },
    // 后处理
    bloomIntensity: { value: 0.8, min: 0, max: 3, step: 0.1, label: "泛光强度" },
    // 位置调整
    avatarHeight: { value: -1.25, min: -2, max: 0, step: 0.01, label: "角色高度" },
    groundHeight: { value: -1.5, min: -2, max: 0, step: 0.01, label: "地面高度" },
  });

  return (
    <>
      <CameraControls
        ref={controls}
        maxPolarAngle={Math.PI / 2}
        minDistance={1}
        maxDistance={10}
      />
      
      {/* 环境光 - 科技感蓝紫色 */}
      <ambientLight intensity={ambientIntensity} color="#1a1a2e" />
      
      {/* 主光源 - 偏蓝白色 */}
      <directionalLight intensity={mainLightIntensity} position={[5, 8, 5]} color="#cce0ff" castShadow />
      
      {/* 补光 - 蓝色 */}
      <directionalLight intensity={mainLightIntensity * 0.4} position={[-5, 5, -5]} color="#4488ff" />
      
      {/* 背光 - 紫色轮廓 */}
      <directionalLight intensity={mainLightIntensity * 0.3} position={[0, 3, -5]} color="#8844ff" />
      
      {/* 角色正面补光 */}
      <pointLight intensity={0.6} position={[0, 2, 3]} color="#ffffff" />
      
      {/* VRM 角色 */}
      <group position-y={avatarHeight}>
        <VRMAvatar avatar={avatar} animation={animation} />
      </group>
      
      {/* 科技感地面 - 简约网格 */}
      <Grid
        position={[0, groundHeight, 0]}
        args={[30, 30]}
        cellSize={0.3}
        cellThickness={0.5}
        cellColor="#1a3a5c"
        sectionSize={2}
        sectionThickness={1}
        sectionColor="#2a5a8c"
        fadeDistance={25}
        fadeStrength={1}
        infiniteGrid
      />
      
      {/* 黑色背景 */}
      <color attach="background" args={["#000000"]} />
      
      {/* 后处理效果 */}
      <EffectComposer>
        <Bloom mipmapBlur intensity={bloomIntensity} luminanceThreshold={0.4} luminanceSmoothing={0.9} />
      </EffectComposer>
    </>
  );
};
