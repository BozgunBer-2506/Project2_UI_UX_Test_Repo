"use client";

import { useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";

const D20_NUMBERS = [20, 2, 14, 8, 6, 16, 18, 4, 12, 10, 1, 19, 7, 13, 3, 17, 11, 5, 15, 9];
const COLS = 4;
const ROWS = 5;

/** Per-face UV atlas: each face gets its own cell in a 4×5 grid */
function buildGeometryWithFaceUV(): THREE.BufferGeometry {
  const base = new THREE.IcosahedronGeometry(1.5, 0);
  const cellW = 1 / COLS;
  const cellH = 1 / ROWS;
  const m = 0.06;
  const uvArr = new Float32Array(20 * 3 * 2);

  for (let f = 0; f < 20; f++) {
    const col = f % COLS;
    const row = Math.floor(f / COLS);
    const x = col * cellW;
    const y = row * cellH;
    const i = f * 6;
    // bottom-left, bottom-right, top-center – matches triangle winding
    uvArr[i + 0] = x + m;             uvArr[i + 1] = y + cellH - m;
    uvArr[i + 2] = x + cellW - m;     uvArr[i + 3] = y + cellH - m;
    uvArr[i + 4] = x + cellW / 2;     uvArr[i + 5] = y + m;
  }
  base.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  return base;
}

/** Texture atlas: 4×5 grid, each cell = one die face with number */
function buildFaceAtlas(): THREE.CanvasTexture {
  const SIZE = 2048;
  const cW = SIZE / COLS;
  const cH = SIZE / ROWS;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#07102a";
  ctx.fillRect(0, 0, SIZE, SIZE);

  for (let f = 0; f < 20; f++) {
    const col = f % COLS;
    const row = Math.floor(f / COLS);
    const ox = col * cW;
    const oy = row * cH;
    const m = 28;

    // Triangle vertices in canvas coords (matching UV layout)
    const bL = { x: ox + m,        y: oy + cH - m };
    const bR = { x: ox + cW - m,   y: oy + cH - m };
    const tp = { x: ox + cW / 2,   y: oy + m };

    // Face fill
    ctx.beginPath();
    ctx.moveTo(bL.x, bL.y);
    ctx.lineTo(bR.x, bR.y);
    ctx.lineTo(tp.x, tp.y);
    ctx.closePath();

    const num = D20_NUMBERS[f];
    const isMax = num === 20;

    // Inner glow fill
    const grad = ctx.createLinearGradient(ox, oy + cH, ox, oy);
    grad.addColorStop(0, "rgba(10,28,80,0.95)");
    grad.addColorStop(1, "rgba(6,18,55,0.95)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Gold edge
    ctx.strokeStyle = isMax ? "rgba(220,170,40,0.9)" : "rgba(180,135,30,0.7)";
    ctx.lineWidth = isMax ? 5 : 3.5;
    ctx.stroke();

    // Number
    const cx = ox + cW / 2;
    const cy = oy + cH * 0.58;
    ctx.font = `900 ${cW * 0.28}px 'Georgia', serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = isMax ? "rgba(255,210,0,1)" : "rgba(120,180,255,0.9)";
    ctx.shadowBlur = isMax ? 40 : 24;
    ctx.fillStyle = isMax ? "#ffe066" : "#c7e0ff";
    ctx.fillText(String(num), cx, cy);

    // Underline for 6 and 9
    if (num === 6 || num === 9) {
      ctx.beginPath();
      ctx.moveTo(cx - 10, cy + cW * 0.15);
      ctx.lineTo(cx + 10, cy + cW * 0.15);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  const t = new THREE.CanvasTexture(canvas);
  t.needsUpdate = true;
  return t;
}

/** Rotating rune floor circle */
function buildRuneTex(): THREE.CanvasTexture {
  const S = 512;
  const canvas = document.createElement("canvas");
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const cx = S / 2, cy = S / 2;

  [[230,0.4],[200,0.3],[165,0.25],[130,0.18]].forEach(([r, a]: number[]) => {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59,130,246,${a})`; ctx.lineWidth = 1.5; ctx.stroke();
  });
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 132, cy + Math.sin(a) * 132);
    ctx.lineTo(cx + Math.cos(a) * 228, cy + Math.sin(a) * 228);
    ctx.strokeStyle = "rgba(59,130,246,0.22)"; ctx.lineWidth = 1; ctx.stroke();
  }
  const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140);
  grd.addColorStop(0, "rgba(29,78,216,0.35)");
  grd.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grd; ctx.beginPath(); ctx.arc(cx, cy, 140, 0, Math.PI * 2); ctx.fill();
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
  const tex = useMemo(() => (typeof document !== "undefined" ? buildRuneTex() : null), []);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.07; });
  if (!tex) return null;
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.9, 0]}>
      <circleGeometry args={[2.6, 64]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

function Die20({ isRolling, onRollEnd }: { isRolling: boolean; onRollEnd: () => void }) {
  const mesh = useRef<THREE.Mesh>(null);
  const edgeMesh = useRef<THREE.LineSegments>(null);
  const state = useRef({ spd: 0, stopping: false });

  const geo  = useMemo(buildGeometryWithFaceUV, []);
  const eGeo = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  const tex  = useMemo(() => (typeof document !== "undefined" ? buildFaceAtlas() : null), []);

  useFrame((_, dt) => {
    if (!mesh.current) return;
    if (isRolling) {
      state.current.stopping = false;
      state.current.spd = Math.min(state.current.spd + dt * 12, 16);
    } else {
      state.current.spd = Math.max(state.current.spd - dt * 6, 0);
      if (state.current.spd === 0 && !state.current.stopping) {
        state.current.stopping = true; onRollEnd();
      }
    }
    const s = state.current.spd;
    if (s > 0) {
      mesh.current.rotation.x += dt * s * 0.7;
      mesh.current.rotation.y += dt * s;
      mesh.current.rotation.z += dt * s * 0.4;
    } else {
      mesh.current.rotation.y += dt * 0.28;
      mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, 0.3, dt * 0.8);
    }
    if (edgeMesh.current) edgeMesh.current.rotation.copy(mesh.current.rotation);
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geo}>
        <meshPhysicalMaterial
          map={tex ?? undefined}
          metalness={0.8}
          roughness={0.12}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive={new THREE.Color(0x050e30)}
          emissiveIntensity={0.5}
          envMapIntensity={2.5}
        />
      </mesh>
      <lineSegments ref={edgeMesh} geometry={eGeo}>
        <lineBasicMaterial color="#c8a028" linewidth={2} />
      </lineSegments>
      {/* subtle gold outline glow */}
      <mesh geometry={geo} scale={1.015}>
        <meshBasicMaterial color="#b8860b" transparent opacity={0.06} side={THREE.BackSide} />
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
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 5, 5]}  intensity={18} color="#93c5fd" decay={2} />
      <pointLight position={[-4, 2, 3]} intensity={12} color="#4f46e5" decay={2} />
      <pointLight position={[4, -2, 3]} intensity={9}  color="#3b82f6" decay={2} />
      <pointLight position={[0, -3, 2]} intensity={6}  color="#7c3aed" decay={2} />
      <pointLight position={[0, 4, 1]}  intensity={6}  color="#fbbf24" decay={2} />

      <RuneRing radius={2.55} speed={0.17}  color="#3b82f6" tiltX={0.2}  />
      <RuneRing radius={2.88} speed={-0.09} color="#6366f1" tiltX={-0.55}/>
      <RuneRing radius={2.22} speed={0.3}   color="#60a5fa" tiltX={1.1}  />
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
      title="Klicken zum Würfeln"
      style={{ background: "linear-gradient(to bottom, transparent, rgba(0,3,20,0.97))" }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 52%, rgba(29,78,216,0.5) 0%, rgba(79,70,229,0.22) 48%, transparent 72%)"
      }} />
      <div className="relative" style={{ width: 230, height: 230 }}>
        <Canvas
          camera={{ position: [0, 0.4, 6.2], fov: 42 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.9 }}
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
