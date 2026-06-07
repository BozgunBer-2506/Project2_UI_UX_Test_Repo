"use client";

import { useRef, useState, useCallback, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Html } from "@react-three/drei";
import * as THREE from "three";

const D20_NUMS = [20, 2, 14, 8, 6, 16, 18, 4, 12, 10, 1, 19, 7, 13, 3, 17, 11, 5, 15, 9];

/* Gold tube material shared across all edge cylinders */
const goldMat = new THREE.MeshStandardMaterial({
  color: new THREE.Color("#c8920a"),
  emissive: new THREE.Color("#d4a520"),
  emissiveIntensity: 1.2,
  metalness: 0.9,
  roughness: 0.1,
});

/* Build 30 edge-tube meshes from icosahedron edges */
function EdgeTubes({ parentRef }: { parentRef: React.RefObject<THREE.Group | null> }) {
  const tubes = useMemo(() => {
    const base = new THREE.IcosahedronGeometry(1.5, 0);
    const eGeo = new THREE.EdgesGeometry(base);
    const pos = eGeo.attributes.position;
    const meshes: { position: THREE.Vector3; quaternion: THREE.Quaternion; length: number }[] = [];

    for (let i = 0; i < pos.count; i += 2) {
      const v0 = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
      const v1 = new THREE.Vector3(pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1));
      const mid = v0.clone().add(v1).multiplyScalar(0.5);
      const length = v0.distanceTo(v1);
      const dir = v1.clone().sub(v0).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      meshes.push({ position: mid, quaternion: q, length });
    }
    base.dispose(); eGeo.dispose();
    return meshes;
  }, []);

  useFrame(() => {
    if (parentRef.current) {
      // tubes group rotation is handled by parent ref sync in Die20
    }
  });

  return (
    <>
      {tubes.map((t, i) => (
        <mesh key={i} position={t.position} quaternion={t.quaternion}>
          <cylinderGeometry args={[0.038, 0.038, t.length, 8]} />
          <primitive object={goldMat} />
        </mesh>
      ))}
    </>
  );
}

/* Rune circle on the floor */
function RuneFloor() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * 0.07; });

  const tex = useMemo(() => {
    if (typeof document === "undefined") return null;
    const S = 512; const c = document.createElement("canvas");
    c.width = S; c.height = S;
    const ctx = c.getContext("2d")!;
    const cx = S / 2, cy = S / 2;
    [[230, 0.55], [198, 0.4], [162, 0.3], [125, 0.22]].forEach(([r, a]) => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56,189,248,${a})`; ctx.lineWidth = 2; ctx.stroke();
    });
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 128, cy + Math.sin(a) * 128);
      ctx.lineTo(cx + Math.cos(a) * 228, cy + Math.sin(a) * 228);
      ctx.strokeStyle = "rgba(56,189,248,0.28)"; ctx.lineWidth = 1; ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 140);
    g.addColorStop(0, "rgba(29,120,216,0.4)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, 140, 0, Math.PI * 2); ctx.fill();
    return new THREE.CanvasTexture(c);
  }, []);

  if (!tex) return null;
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.95, 0]}>
      <circleGeometry args={[2.7, 64]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.01} depthWrite={false} />
    </mesh>
  );
}

/* Orbiting ring */
function Ring({ r, speed, color, tilt }: { r: number; speed: number; color: string; tilt: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * speed; });
  return (
    <mesh ref={ref} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[r, 0.018, 16, 128]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} toneMapped={false} />
    </mesh>
  );
}

/* Face number HTML overlays - positioned at each face centroid in 3D space */
function FaceNumbers({ meshGroupRef }: { meshGroupRef: React.RefObject<THREE.Group | null> }) {
  const { camera } = useThree();
  const [visibleFaces, setVisibleFaces] = useState<{ num: number; pos: THREE.Vector3; opacity: number }[]>([]);

  const centroids = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1.5, 0);
    const pos = g.attributes.position;
    const result: THREE.Vector3[] = [];
    for (let i = 0; i < 20; i++) {
      const a = new THREE.Vector3(pos.getX(i * 3), pos.getY(i * 3), pos.getZ(i * 3));
      const b = new THREE.Vector3(pos.getX(i * 3 + 1), pos.getY(i * 3 + 1), pos.getZ(i * 3 + 1));
      const cc = new THREE.Vector3(pos.getX(i * 3 + 2), pos.getY(i * 3 + 2), pos.getZ(i * 3 + 2));
      result.push(a.add(b).add(cc).divideScalar(3).normalize().multiplyScalar(1.55));
    }
    g.dispose();
    return result;
  }, []);

  useFrame(() => {
    if (!meshGroupRef.current) return;
    const mat = meshGroupRef.current.matrixWorld;
    const camPos = camera.position;

    const faces = centroids.map((c, i) => {
      const wp = c.clone().applyMatrix4(mat);
      const normal = wp.clone().normalize();
      const toCam = camPos.clone().sub(wp);
      const dot = toCam.normalize().dot(normal);
      return { num: D20_NUMS[i], pos: wp, dot };
    })
      .filter(f => f.dot > 0.1)
      .sort((a, b) => b.dot - a.dot)
      .slice(0, 5) // show max 5 front-facing faces
      .map(f => ({ num: f.num, pos: f.pos, opacity: Math.min(1, (f.dot - 0.1) / 0.5) }));

    setVisibleFaces(faces);
  });

  return (
    <>
      {visibleFaces.map((f, i) => (
        <Html key={`${f.num}-${i}`} position={[f.pos.x, f.pos.y, f.pos.z]} center zIndexRange={[0, 0]}>
          <span style={{
            fontFamily: "'Georgia', serif",
            fontWeight: 900,
            fontSize: f.num === 20 ? "18px" : "14px",
            color: f.num === 20 ? "#ffe066" : "#93c5fd",
            textShadow: f.num === 20
              ? "0 0 12px rgba(255,210,0,1), 0 0 24px rgba(255,180,0,0.7)"
              : "0 0 8px rgba(100,180,255,0.9)",
            opacity: f.opacity,
            pointerEvents: "none",
            userSelect: "none",
            display: "block",
            lineHeight: 1,
          }}>
            {f.num}
          </span>
        </Html>
      ))}
    </>
  );
}

/* Main die group */
function Die20({ isRolling, onRollEnd }: { isRolling: boolean; onRollEnd: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const state = useRef({ spd: 0, stopping: false });

  const geo = useMemo(() => new THREE.IcosahedronGeometry(1.5, 0), []);

  useFrame((_, dt) => {
    if (!groupRef.current) return;
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
      groupRef.current.rotation.x += dt * s * 0.7;
      groupRef.current.rotation.y += dt * s;
      groupRef.current.rotation.z += dt * s * 0.4;
    } else {
      groupRef.current.rotation.y += dt * 0.28;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0.3, dt * 0.8);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Die face - crystal blue glowing */}
      <mesh geometry={geo}>
        <meshPhysicalMaterial
          color={new THREE.Color("#1a4a9f")}
          emissive={new THREE.Color("#3b82f6")}
          emissiveIntensity={0.9}
          metalness={0.05}
          roughness={0.05}
          transmission={0.45}
          ior={1.6}
          thickness={0.5}
          transparent
          opacity={0.88}
          envMapIntensity={1.5}
        />
      </mesh>
      {/* Gold edge tubes */}
      <EdgeTubes parentRef={groupRef} />
      {/* Face number HTML overlays */}
      <FaceNumbers meshGroupRef={groupRef} />
    </group>
  );
}

function Scene({ isRolling, onRollEnd, onClick }: {
  isRolling: boolean; onRollEnd: () => void; onClick: () => void;
}) {
  return (
    <>
      <Environment preset="city" />
      <ambientLight intensity={0.3} />
      {/* Blue inner glow lights */}
      <pointLight position={[0, 0, 3]}  intensity={20} color="#60a5fa" decay={2} />
      <pointLight position={[0, 3, 2]}  intensity={12} color="#38bdf8" decay={2} />
      <pointLight position={[-3, 0, 2]} intensity={10} color="#818cf8" decay={2} />
      <pointLight position={[3, -1, 2]} intensity={8}  color="#3b82f6" decay={2} />
      {/* Gold warm light from above */}
      <pointLight position={[0, 5, 3]}  intensity={8}  color="#fbbf24" decay={2} />

      <Ring r={2.6}  speed={0.18}  color="#22d3ee" tilt={0.2}  />
      <Ring r={2.9}  speed={-0.1}  color="#818cf8" tilt={-0.55}/>
      <Ring r={2.25} speed={0.32}  color="#38bdf8" tilt={1.1}  />

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
        background: "radial-gradient(ellipse at 50% 50%, rgba(29,78,216,0.55) 0%, rgba(56,189,248,0.18) 45%, transparent 70%)"
      }} />
      <div className="relative" style={{ width: 230, height: 230 }}>
        <Canvas
          camera={{ position: [0, 0.3, 6.0], fov: 42 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.6 }}
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
