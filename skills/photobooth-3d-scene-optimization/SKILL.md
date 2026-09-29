---
name: photobooth-3d-scene-optimization
description: >-
  Three.js and React Three Fiber 3D asset optimization, non-PBR material pipeline, and constant
  lighting setup for event photobooth kiosks.
---

# Photobooth 3D Scene Optimization Skill

This skill guides the implementation, material tuning, and lighting configuration of 3D scenes (such as portal stargates, time-travel tunnels, particle vortexes, and 3D countdowns) in interactive photobooths using **Three.js** and **React Three Fiber (@react-three/fiber, @react-three/drei)**.

## 1. Non-PBR Material Pipeline

### The Kiosk GPU Problem:
Event kiosks often run on integrated GPUs (Intel Iris Xe, AMD Radeon Vega, or entry-level discrete GPUs). High-roughness or highly-metallic PBR materials (`MeshStandardMaterial` / `MeshPhysicalMaterial`) require high-resolution HDR environment maps (`Environment` / `cubeMap`) to look realistic. Without an HDR map, metallic surfaces produce **harsh black reflections, blown-out specular highlights, or erratic color banding**.

### The Solution: Non-PBR / Flat Diffuse Tuning
When loading textured 3D models (`.glb` / `.gltf`), traverse all scene meshes and override PBR properties:

```typescript
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import React, { useMemo } from 'react';

export const Model: React.FC<{ url: string }> = ({ url }) => {
  const { scene } = useGLTF(url);

  // Traverse and tune materials for non-PBR clarity
  useMemo(() => {
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          // Eliminate metallic specular artifacts
          mat.metalness = 0.0;
          mat.roughness = 1.0;
          // Ensure textures render in sRGB color space
          if (mat.map) {
            mat.map.colorSpace = THREE.SRGBColorSpace;
            mat.map.needsUpdate = true;
          }
        }
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
};
```

---

## 2. Constant Ambient Lighting Rule

### The Problem:
Pulsing, sine-wave, or fluctuating ambient light intensity over time causes 3D models to shift in brightness and hue between frames. In a photobooth, this produces an erratic, visually distracting background where the 3D model looks washed out at one second and dim the next.

### The Rule:
1. **100% Constant Ambient Light**: Set fixed, balanced intensity for ambient and key directional lights.
2. **Dynamic Elements in Shader or Accent Lights Only**: If dynamic lighting is desired, restrict it to localized point lights (e.g. portal core energy) or emissive materials, never the global ambient light.

```tsx
// Correct constant lighting setup:
<ambientLight intensity={1.2} color="#ffffff" />
<directionalLight position={[5, 10, 7]} intensity={1.8} color="#fff8e7" />
<directionalLight position={[-5, -5, -5]} intensity={0.6} color="#00e5ff" />
```

---

## 3. Asset Loading & Preloading

1. **Preload GLB Models on Boot**:
   ```typescript
   useGLTF.preload(getAssetUrl('assets/models/Gate-V5-Textured.glb'));
   ```
2. **Auto-Center & Scale**:
   Always wrap imported models in `<Center>` from `@react-three/drei` or normalize bounds manually to ensure models fit upright portrait kiosk screens (1080x1920) without clipping:
   ```tsx
   <Center top>
     <Model url={modelUrl} />
   </Center>
   ```
3. **Graceful WebGL Fallback**:
   Always provide a fallback 2D animated backdrop (video or CSS portal) if WebGL initialization fails or if the machine lacks hardware acceleration.
