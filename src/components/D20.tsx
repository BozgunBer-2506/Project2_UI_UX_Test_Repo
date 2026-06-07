"use client";

import { useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

const D20_NUMBERS = [20, 2, 14, 8, 6, 16, 18, 4, 12, 10, 1, 19, 7, 13, 3, 17, 11, 5, 15, 9];

function buildD20Texture(): THREE.CanvasTexture {
  const SIZE = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  // Dark navy background
  ctx.fillStyle = "#080f28";
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Build temp geometry to read UVs
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const uvAttr = geo.attributes.uv;
  const posAttr = geo.attributes.position;

  for (let face = 0; face < 20; face++) {
    const i = face * 3;
    const u0 = uvAttr.getX(i),   v0 = 1 - uvAttr.getY(i);
    const u1 = uvAttr.getX(i+1), v1 = 1 - uvAttr.getY(i+1);
    const u2 = uvAttr.getX(i+2), v2 = 1 - uvAttr.getY(i+2);

    const cx = ((u0 + u1 + u2) / 3) * SIZE;
    const cy = ((v0 + v1 + v2) / 3) * SIZE;

    const px0 = u0 * SIZE, py0 = v0 * SIZE;
    const px1 = u1 * SIZE, py1 = v1 * SIZE;
    const px2 = u2 * SIZE, py2 = v2 * SIZE;

    // Draw face triangle border (gold)
    ctx.beginPath();
    ctx.moveTo(px0, py0);
    ctx.lineTo(px1, py1);
    ctx.lineTo(px2, py2);
    ctx.closePath();
    ctx.strokeStyle = "rgba(200,150,42,0.55)";
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner face fill
    ctx.fillStyle = "rgba(10,20,60,0.7)";
    ctx.fill();

    const num = D20_NUMBERS[face];
    const isMax = num === 20;
    const fontSize = isMax ? SIZE * 0.038 : SIZE * 0.031;

    ctx.font = `bold ${fontSize}px 'Georgia', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = isMax ? "rgba(255,200,0,0.9)" : "rgba(147,197,253,0.8)";
    ctx.shadowBlur = isMax ? 28 : 18;
    ctx.fillStyle = isMax ? "#ffd700" : "#bfdbfe";
    ctx.fillText(String(num), cx, cy);
  }

  geo.dispose();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildRuneTexture(): THREE.CanvasTexture {
  const SIZE = 512;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, SIZE, SIZE);
  const cx = SIZE / 2, cy = SIZE / 2;

  // Outer glow circle
  const radii = [220, 195, 170, 140];
  radii.forEach((r, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59,130,246,${0.35 - idx * 0.06})`;
    ctx.lineWidth = idx === 0 ? 2.5 : 1.5;
    ctx.stroke();
  });

  // Rune segments
  const segments = 12;
  for (let s = 0; s < segments; s++) {
    const angle = (s / segments) * Math.PI * 2;
    const inner = 145, outer = 215;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * inner, cy + Math.sin(angle) * inner);
    ctx.lineTo(cx + Math.cos(angle) * outer, cy + Math.sin(angle) * outer);
    ctx.strokeStyle = "rgba(59,130,246,0.3)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Center glow
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 130);
  grd.addColorStop(0, "rgba(29,78,216,0.25)");
  grd.addColorStop(1, "rgba(29,78,216,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy, 130, 0, Math.PI * 2);
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}

function RuneRing({ radius, speed, color, tiltX = 0.3 }: {
  radius: number; speed: number; color: string; tiltX?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * speed; });
  return (
    <mesh ref={ref} rotation={[tiltX, 0, 0]}>
      <torusGeometry args={[radius, 0.016, 16, 128]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} toneMapped={false} />
    </mesh>
  );
}

function RuneFloor() {
  const ref = useRef<THREE.Mesh>(null);
  const tex = useMemo(() => (typeof document !== "undefined" ? buildRuneTexture() : null), []);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.08; });
  if (!tex) return null;
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.75, 0]}>
      <circleGeometry args={[2.4, 64]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

function Die20({ isRolling, onRollEnd }: { isRolling: boolean; onRollEnd: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const edges = useRef<THREE.LineSegments>(null);
  const state = useRef({ spd: 0, stopping: false });

  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.5, 0), []);
  const edgeGeo = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const tex = useMemo(() => (typeof document !== "undefined" ? buildD20Texture() : null), []);

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
      mesh.current.rotation.y += dt * 0.3;
      mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, 0.3, dt * 0.8);
    }
    if (edges.current) edges.current.rotation.copy(mesh.current.rotation);
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geo}>
        <meshPhysicalMaterial
          map={tex ?? undefined}
          color={new THREE.Color(0x0c1b4a)}
          metalness={0.82}
          roughness={0.15}
          clearcoat={0.8}
          clearcoatRoughness={0.1}
          emissive={new THREE.Color(0x061030)}
          emissiveIntensity={0.6}
          envMapIntensity={2.5}
        />
      </mesh>
      {/* Gold edge glow - slightly larger die */}
      <lineSegments ref={edges} geometry={edgeGeo}>
        <lineBasicMaterial color="#c8a028" linewidth={2} />
      </lineSegments>
      {/* Outer edge glow mesh */}
      <mesh geometry={geo} scale={1.02}>
        <meshBasicMaterial color="#b8860b" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function Scene({ isRolling, onRollEnd, onClick }: {
  isRolling: boolean; onRollEnd: () => void; onClick: () => void;
}) {
  return (
    <>
      <Environment preset="night" />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 5, 4]} intensity={16} color="#93c5fd" decay={2} />
      <pointLight position={[-3, 2, 3]} intensity={10} color="#4f46e5" decay={2} />
      <pointLight position={[3, -2, 3]} intensity={8} color="#3b82f6" decay={2} />
      <pointLight position={[0, -3, 2]} intensity={6} color="#7c3aed" decay={2} />
      <pointLight position={[0, 3, 0]} intensity={5} color="#fbbf24" decay={2} />

      <RuneRing radius={2.55} speed={0.17} color="#3b82f6" tiltX={0.2} />
      <RuneRing radius={2.88} speed={-0.09} color="#6366f1" tiltX={-0.55} />
      <RuneRing radius={2.22} speed={0.3} color="#60a5fa" tiltX={1.1} />
      <RuneFloor />

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
      className="flex flex-col items-center shrink-0 relative cursor-pointer select-none"
      onClick={handleClick}
      title="Click to roll"
      style={{ background: "linear-gradient(to bottom, transparent, rgba(0,3,20,0.97))" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 52%, rgba(29,78,216,0.5) 0%, rgba(79,70,229,0.22) 45%, transparent 70%)"
      }} />
      <div className="relative" style={{ width: 230, height: 230 }}>
        <Canvas
          camera={{ position: [0, 0.4, 6.2], fov: 42 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.8 }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <Scene isRolling={isRolling} onRollEnd={handleEnd} onClick={handleClick} />
          </Suspense>
        </Canvas>
      </div>
      <div className="text-center pb-3 relative z-10 -mt-3">
        <p className="text-[0.48rem] uppercase tracking-[0.38em] font-cinzel" style={{ color: "rgba(147,197,253,0.3)" }}>
          Würfel-Verlauf
        </p>
        {currentValue !== null ? (
          <p className="text-[0.6rem] mt-0.5" style={{ color: "#93c5fd" }}>
            Letzter Wurf:{" "}
            <span style={{ color: "#d4af37", fontWeight: 900 }}>{currentValue}</span>
          </p>
        ) : (
          <p className="text-[0.56rem] mt-0.5" style={{ color: "rgba(100,116,139,0.4)" }}>▽</p>
        )}
      </div>
    </div>
  );
}
