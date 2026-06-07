"use client";

import { useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

function RuneRing({ radius, speed, color, tiltX = 0.3 }: {
  radius: number; speed: number; color: string; tiltX?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });
  return (
    <mesh ref={ref} rotation={[tiltX, 0, 0]}>
      <torusGeometry args={[radius, 0.018, 16, 128]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} toneMapped={false} />
    </mesh>
  );
}

function createFaceTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0a1535";
  ctx.fillRect(0, 0, size, size);

  const d20Numbers = [
    20, 2, 14, 8, 6, 16, 18, 4, 12, 10,
    1, 19, 7, 13, 3, 17, 11, 5, 15, 9,
  ];
  const cols = 4;
  const rows = 5;
  const cellW = size / cols;
  const cellH = size / rows;

  d20Numbers.forEach((num, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2;

    ctx.save();
    ctx.fillStyle = "rgba(16, 38, 80, 0.9)";
    ctx.beginPath();
    ctx.arc(cx, cy, cellW * 0.38, 0, Math.PI * 2);
    ctx.fill();

    const glowSize = cellW * 0.42;
    const grd = ctx.createRadialGradient(cx, cy, glowSize * 0.1, cx, cy, glowSize);
    grd.addColorStop(0, "rgba(99,158,255,0.15)");
    grd.addColorStop(1, "rgba(99,158,255,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, glowSize, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = num === 20 ? "#ffd700" : "#dbeafe";
    ctx.font = `bold ${cellW * 0.32}px 'Georgia', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = num === 20 ? "rgba(255,200,0,0.8)" : "rgba(147,197,253,0.7)";
    ctx.shadowBlur = 14;
    ctx.fillText(String(num), cx, cy);
    ctx.restore();
  });

  return new THREE.CanvasTexture(canvas);
}

function Die20({ isRolling, onRollEnd }: { isRolling: boolean; onRollEnd: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const state = useRef({ spd: 0, stopping: false });

  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.5, 0), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const texture = useMemo(() => (typeof document !== "undefined" ? createFaceTexture() : null), []);

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
          map={texture ?? undefined}
          color={new THREE.Color(0x0d1f4a)}
          metalness={0.7}
          roughness={0.2}
          emissive={new THREE.Color(0x091640)}
          emissiveIntensity={0.4}
          envMapIntensity={2}
        />
      </mesh>
      <lineSegments ref={edges} geometry={edgeGeo}>
        <lineBasicMaterial color="#c8962a" linewidth={2} />
      </lineSegments>
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
      <pointLight position={[0, 0, 5]} intensity={4} color="#bfdbfe" decay={2} />

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
      style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.05), rgba(0,3,20,0.95))" }}
      title="Click to roll"
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 55%, rgba(29,78,216,0.45) 0%, rgba(79,70,229,0.2) 45%, transparent 72%)"
      }} />
      <div className="absolute inset-x-0 bottom-12 h-20 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.25) 0%, transparent 70%)"
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
        {currentValue !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span style={{
              fontSize: "2.4rem", fontWeight: 900,
              color: "#fef3c7",
              textShadow: "0 0 18px rgba(255,215,0,0.95), 0 0 40px rgba(59,130,246,0.7), 0 0 60px rgba(59,130,246,0.4)",
              fontFamily: "var(--font-cinzel), Georgia, serif",
            }}>
              {currentValue}
            </span>
          </div>
        )}
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
          <p className="text-[0.58rem] mt-0.5" style={{ color: "rgba(100,116,139,0.45)" }}>
            ▽
          </p>
        )}
      </div>
    </div>
  );
}
