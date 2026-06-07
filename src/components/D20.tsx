"use client";

import { useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

const D20_NUMBERS = [20, 2, 14, 8, 6, 16, 18, 4, 12, 10, 1, 19, 7, 13, 3, 17, 11, 5, 15, 9];

function makeNumSprite(num: number): THREE.Texture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;
  const isMax = num === 20;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = isMax ? "rgba(255,215,0,0.85)" : "rgba(147,197,253,0.8)";
  ctx.font = `bold ${size * 0.52}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = isMax ? "rgba(255,200,0,1)" : "rgba(100,180,255,1)";
  ctx.shadowBlur = 22;
  ctx.fillText(String(num), size / 2, size / 2);
  const t = new THREE.CanvasTexture(c);
  return t;
}

function RuneRing({ radius, speed, color, tiltX = 0.3 }: {
  radius: number; speed: number; color: string; tiltX?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * speed; });
  return (
    <mesh ref={ref} rotation={[tiltX, 0, 0]}>
      <torusGeometry args={[radius, 0.018, 16, 128]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
    </mesh>
  );
}

function FaceNumbers({ meshRef }: { meshRef: React.RefObject<THREE.Mesh | null> }) {
  const { camera } = useThree();
  const spritesRef = useRef<THREE.Sprite[]>([]);
  const groupRef = useRef<THREE.Group>(null);

  const faceCentroids = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.5, 0);
    const pos = geo.attributes.position;
    const centroids: THREE.Vector3[] = [];
    for (let i = 0; i < pos.count; i += 3) {
      const a = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const b = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const cc = new THREE.Vector3(pos.getX(i + 2), pos.getY(i + 2), pos.getZ(i + 2));
      const centroid = new THREE.Vector3().addVectors(a, b).add(cc).divideScalar(3);
      centroid.normalize().multiplyScalar(1.58);
      centroids.push(centroid);
    }
    geo.dispose();
    return centroids;
  }, []);

  const textures = useMemo(() => {
    if (typeof document === "undefined") return [];
    return D20_NUMBERS.map(makeNumSprite);
  }, []);

  useFrame(() => {
    if (!meshRef.current || !groupRef.current) return;
    groupRef.current.rotation.copy(meshRef.current.rotation);
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    spritesRef.current.forEach((sprite, i) => {
      const worldPos = new THREE.Vector3();
      sprite.getWorldPosition(worldPos);
      const toCamera = worldPos.clone().sub(camera.position).normalize();
      const dot = toCamera.dot(camDir);
      sprite.visible = dot > 0.1;
    });
  });

  if (textures.length === 0) return null;

  return (
    <group ref={groupRef}>
      {faceCentroids.map((pos, i) => (
        <sprite
          key={i}
          position={[pos.x, pos.y, pos.z]}
          ref={(el) => { if (el) spritesRef.current[i] = el; }}
          scale={[0.55, 0.55, 0.55]}
        >
          <spriteMaterial map={textures[i % textures.length]} transparent alphaTest={0.01} depthTest={false} />
        </sprite>
      ))}
    </group>
  );
}

function Die20({ isRolling, onRollEnd }: { isRolling: boolean; onRollEnd: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const state = useRef({ spd: 0, stopping: false });
  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.5, 0), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    if (isRolling) {
      state.current.stopping = false;
      state.current.spd = Math.min(state.current.spd + dt * 12, 16);
    } else {
      state.current.spd = Math.max(state.current.spd - dt * 6, 0);
      if (state.current.spd === 0 && !state.current.stopping) {
        state.current.stopping = true;
        onRollEnd();
      }
    }
    const s = state.current.spd;
    if (s > 0) {
      mesh.current.rotation.x += dt * s * 0.7;
      mesh.current.rotation.y += dt * s;
      mesh.current.rotation.z += dt * s * 0.4;
    } else {
      mesh.current.rotation.y += dt * 0.35;
      mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, 0.3, dt * 0.8);
    }
    if (edges.current) edges.current.rotation.copy(mesh.current.rotation);
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geo}>
        <meshStandardMaterial
          color={new THREE.Color(0x0b1a45)}
          metalness={0.75}
          roughness={0.18}
          emissive={new THREE.Color(0x061230)}
          emissiveIntensity={0.5}
          envMapIntensity={2.2}
        />
      </mesh>
      <lineSegments ref={edges} geometry={edgeGeo}>
        <lineBasicMaterial color="#c8962a" linewidth={2} />
      </lineSegments>
      <FaceNumbers meshRef={mesh} />
    </group>
  );
}

function Scene({ isRolling, onRollEnd, onClick }: {
  isRolling: boolean; onRollEnd: () => void; onClick: () => void;
}) {
  return (
    <>
      <Environment preset="night" />
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 6, 4]} intensity={14} color="#93c5fd" decay={2} />
      <pointLight position={[-4, 1, 3]} intensity={9} color="#6366f1" decay={2} />
      <pointLight position={[4, -2, 3]} intensity={7} color="#3b82f6" decay={2} />
      <pointLight position={[0, -4, 2]} intensity={5} color="#8b5cf6" decay={2} />
      <RuneRing radius={2.55} speed={0.18} color="#3b82f6" tiltX={0.2} />
      <RuneRing radius={2.85} speed={-0.1} color="#6366f1" tiltX={-0.55} />
      <RuneRing radius={2.25} speed={0.32} color="#60a5fa" tiltX={1.1} />
      <Die20 isRolling={isRolling} onRollEnd={onRollEnd} />
      <mesh onClick={onClick}>
        <sphereGeometry args={[1.8, 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}

export default function D20({ onRoll, currentValue }: {
  onRoll: (v: number) => void; currentValue: number | null;
}) {
  const [isRolling, setIsRolling] = useState(false);
  const pending = useRef(20);

  const handleClick = useCallback(() => {
    if (isRolling) return;
    pending.current = Math.floor(Math.random() * 20) + 1;
    setIsRolling(true);
  }, [isRolling]);

  const handleEnd = useCallback(() => {
    setIsRolling(false);
    onRoll(pending.current);
  }, [onRoll]);

  return (
    <div
      className="flex flex-col items-center shrink-0 relative cursor-pointer"
      onClick={handleClick}
      title="Click to roll"
      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,3,20,0.95))" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 55%, rgba(29,78,216,0.45) 0%, rgba(79,70,229,0.2) 45%, transparent 72%)"
      }} />
      <div className="relative" style={{ width: 220, height: 220 }}>
        <Canvas
          camera={{ position: [0, 0, 6.5], fov: 42 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.7 }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <Scene isRolling={isRolling} onRollEnd={handleEnd} onClick={handleClick} />
          </Suspense>
        </Canvas>
      </div>
      <div className="text-center pb-3 relative z-10 -mt-2">
        <p className="text-[0.5rem] uppercase tracking-[0.35em] font-cinzel" style={{ color: "rgba(147,197,253,0.35)" }}>
          Würfel-Verlauf
        </p>
        {currentValue !== null ? (
          <p className="text-[0.62rem] mt-0.5" style={{ color: "#93c5fd" }}>
            Letzter Wurf: <span style={{ color: "#d4af37", fontWeight: 900 }}>{currentValue}</span>
          </p>
        ) : (
          <p className="text-[0.58rem] mt-0.5" style={{ color: "rgba(100,116,139,0.45)" }}>▽</p>
        )}
      </div>
    </div>
  );
}
