import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { CameraWidget } from "./components/CameraWidget";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
function App() {
  return (
    <>
      <UI />
      <CameraWidget />
      <Loader />
      <Canvas shadows camera={{ position: [0.25, 0.25, 2], fov: 30 }}>
        <color attach="background" args={["#000000"]} />
        {/* <Stats /> */}
        <Suspense>
          <Experience />
        </Suspense>
      </Canvas>
    </>
  );
}

export default App;
