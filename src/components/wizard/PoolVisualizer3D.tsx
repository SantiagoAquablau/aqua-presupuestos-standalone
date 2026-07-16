import { useRef, memo, useState, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface PoolVisualizerProps {
  length: number;
  width: number;
  depthMin: number;
  depthMax: number;
  hasExteriorStair: boolean;
  exteriorStairLength: number;
  exteriorStairWidth: number;
  interiorStairType: string;
  interiorStairWidth: number;
  waterproofingType: string;
}

const WALL_T = 0.20;
const COPING_W = 0.40;
const COPING_H = 0.06;

function PoolFloor({ width, length }: { width: number; length: number }) {
  return (
    <mesh position={[0, 0.10, 0]}>
      <boxGeometry args={[width, 0.20, length]} />
      <meshPhongMaterial color="#c8c0b4" />
    </mesh>
  );
}

function PoolWalls({ width, length, depth }: { width: number; length: number; depth: number }) {
  const color = '#b8b0a4';
  return (
    <group>
      {/* Front wall */}
      <mesh position={[0, depth / 2, length / 2 + WALL_T / 2]}>
        <boxGeometry args={[width + WALL_T * 2, depth, WALL_T]} />
        <meshPhongMaterial color={color} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, depth / 2, -(length / 2 + WALL_T / 2)]}>
        <boxGeometry args={[width + WALL_T * 2, depth, WALL_T]} />
        <meshPhongMaterial color={color} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-(width / 2 + WALL_T / 2), depth / 2, 0]}>
        <boxGeometry args={[WALL_T, depth, length]} />
        <meshPhongMaterial color={color} />
      </mesh>
      {/* Right wall */}
      <mesh position={[width / 2 + WALL_T / 2, depth / 2, 0]}>
        <boxGeometry args={[WALL_T, depth, length]} />
        <meshPhongMaterial color={color} />
      </mesh>
    </group>
  );
}

function PoolCoping({ width, length, depth }: { width: number; length: number; depth: number }) {
  const copingColor = '#e0d8d0';
  const y = depth + COPING_H / 2;
  return (
    <group>
      {/* Front coping */}
      <mesh position={[0, y, length / 2 + WALL_T / 2]}>
        <boxGeometry args={[width + WALL_T * 2 + COPING_W, COPING_H, COPING_W]} />
        <meshPhongMaterial color={copingColor} />
      </mesh>
      {/* Back coping */}
      <mesh position={[0, y, -(length / 2 + WALL_T / 2)]}>
        <boxGeometry args={[width + WALL_T * 2 + COPING_W, COPING_H, COPING_W]} />
        <meshPhongMaterial color={copingColor} />
      </mesh>
      {/* Left coping */}
      <mesh position={[-(width / 2 + WALL_T / 2), y, 0]}>
        <boxGeometry args={[COPING_W, COPING_H, length + COPING_W]} />
        <meshPhongMaterial color={copingColor} />
      </mesh>
      {/* Right coping */}
      <mesh position={[width / 2 + WALL_T / 2, y, 0]}>
        <boxGeometry args={[COPING_W, COPING_H, length + COPING_W]} />
        <meshPhongMaterial color={copingColor} />
      </mesh>
    </group>
  );
}

function InteriorStairs({ type, stairWidth, depth, poolWidth, poolLength, benchHeight }: {
  type: string; stairWidth: number; depth: number; poolWidth: number; poolLength: number; benchHeight: number;
}) {
  const color = '#d4ccc4';
  const stepH = 0.22;
  const effectiveWidth = type === 'tot_ample' ? poolWidth - 0.10 : Math.min(stairWidth || poolWidth * 0.6, poolWidth - 0.10);

  const steps = (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, depth - stepH * (i + 0.5), -(poolLength / 2 - 0.15 - i * 0.30)]}>
          <boxGeometry args={[effectiveWidth, stepH, 0.30]} />
          <meshPhongMaterial color={color} />
        </mesh>
      ))}
    </group>
  );

  if (type === 'sense') return null;

  return (
    <group>
      {steps}
      {type === 'plataforma' && (
        <mesh position={[0, depth - 0.075, -(poolLength / 2 - 0.60 - 0.10)]}>
          <boxGeometry args={[effectiveWidth, 0.15, 0.60]} />
          <meshPhongMaterial color={color} />
        </mesh>
      )}
      {type === 'banc' && (
        <mesh position={[-(poolWidth / 2 - 0.225), (benchHeight || 0.45) / 2 + 0.10, 0]}>
          <boxGeometry args={[0.45, benchHeight || 0.45, poolLength - 1.0]} />
          <meshPhongMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}

function ExteriorStairs({ stairWidth, depth, poolLength }: { stairWidth: number; depth: number; poolLength: number }) {
  const color = '#b8b0a4';
  const stepH = 0.20;
  const startZ = poolLength / 2 + WALL_T + COPING_W / 2 + 0.3;
  return (
    <group>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0, depth + COPING_H - stepH * i, startZ + 0.30 * i]}>
          <boxGeometry args={[stairWidth, stepH, 0.30]} />
          <meshPhongMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function PoolScene(props: PoolVisualizerProps) {
  const w = props.width || 4;
  const l = props.length || 8;
  const depthAvg = (props.depthMin + props.depthMax) / 2 || 1.5;

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[l, depthAvg * 3, w * 2]} intensity={0.9} />
      <hemisphereLight args={[0x87ceeb, 0x8b8070, 0.4]} />

      <PoolFloor width={w} length={l} />
      <PoolWalls width={w} length={l} depth={depthAvg} />
      <PoolCoping width={w} length={l} depth={depthAvg} />

      {props.interiorStairType && props.interiorStairType !== 'sense' && (
        <InteriorStairs
          type={props.interiorStairType}
          stairWidth={props.interiorStairWidth || w * 0.6}
          depth={depthAvg}
          poolWidth={w}
          poolLength={l}
          benchHeight={0.45}
        />
      )}

      {props.hasExteriorStair && props.exteriorStairWidth > 0 && (
        <ExteriorStairs stairWidth={props.exteriorStairWidth} depth={depthAvg} poolLength={l} />
      )}

      <OrbitControls
        enablePan={false}
        maxPolarAngle={Math.PI / 2.2}
        minPolarAngle={0.2}
        minDistance={3}
        maxDistance={25}
      />
    </>
  );
}

const PoolVisualizer3D = memo(function PoolVisualizer3D(props: PoolVisualizerProps) {
  const hasData = props.length > 0 || props.width > 0;
  const [hint, setHint] = useState(true);

  useEffect(() => {
    if (hint) {
      const t = setTimeout(() => setHint(false), 4000);
      return () => clearTimeout(t);
    }
  }, [hint]);

  if (!hasData) {
    return (
      <div className="bg-muted/50 rounded-xl border border-border p-8 text-center">
        <p className="text-muted-foreground text-sm">Introdueix les dimensions per veure la visualització 3D</p>
      </div>
    );
  }

  const depthAvg = (props.depthMin + props.depthMax) / 2 || 1.5;
  const w = props.width || 4;
  const l = props.length || 8;

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-border overflow-hidden bg-[#f0f4f8] relative" style={{ minHeight: 320, maxHeight: 420, width: '100%' }}>
        <Canvas
          style={{ width: '100%', height: '100%', display: 'block' }}
          camera={{
            position: [l * 0.9, depthAvg * 3.5, w * 1.8],
            fov: 45,
            near: 0.1,
            far: 100,
          }}
          onCreated={({ camera }) => {
            camera.lookAt(0, depthAvg * 0.2, 0);
          }}
          gl={{ antialias: true }}
        >
          <color attach="background" args={['#f0f4f8']} />
          <PoolScene {...props} />
        </Canvas>
        {hint && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-card/90 border border-border rounded-lg px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
            Arrossega per rotar · Pinça per fer zoom
          </div>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-muted/50 rounded-lg p-2.5 border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Prof. mitjana</p>
          <p className="text-sm font-bold text-foreground">{depthAvg.toFixed(2)} m</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Capacitat</p>
          <p className="text-sm font-bold text-foreground">{Math.round(l * w * depthAvg * 1000).toLocaleString('ca-ES')} L</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-2.5 border border-border text-center">
          <p className="text-[10px] text-muted-foreground">Superfície</p>
          <p className="text-sm font-bold text-foreground">{((l * w) + 2 * (l * depthAvg) + 2 * (w * depthAvg)).toFixed(1)} m²</p>
        </div>
      </div>
    </div>
  );
});

export default PoolVisualizer3D;
