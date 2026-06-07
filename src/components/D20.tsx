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
      <torusGeometry args={[radius, 0.022, 16, 128]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
    </mesh>
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
      mesh.current.rotation.y += dt * 0.4;
      mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, 0.25, dt * 0.8);
    }
    if (edges.current) edges.current.rotation.copy(mesh.current.rotation);
  });

  return (
    <group>
      <mesh ref={mesh} geometry={geo}>
        <meshStandardMaterial
          color={new THREE.Color(0x112255)}
          metalness={0.6}
          roughness={0.25}
          emissive={new THREE.Color(0x091640)}
          emissiveIntensity={0.5}
          envMapIntensity={1.5}
        />
      </mesh>
      <lineSegments ref={edges} geometry={edgeGeo}>
        <lineBasicMaterial color="#d4a017" linewidth={1.5} />
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
      <ambientLight intensity={0.6} />
      <pointLight position={[0, 5, 4]} intensity={12} color="#93c5fd" decay={2} />
      <pointLight position={[-4, 1, 3]} intensity={8} color="#6366f1" decay={2} />
      <pointLight position={[4, -2, 3]} intensity={6} color="#3b82f6" decay={2} />
      <pointLight position={[0, -4, 2]} intensity={4} color="#8b5cf6" decay={2} />

      <RuneRing radius={2.5} speed={0.2} color="#3b82f6" tiltX={0.2} />
      <RuneRing radius={2.8} speed={-0.12} color="#6366f1" tiltX={-0.5} />
      <RuneRing radius={2.2} speed={0.35} color="#60a5fa" tiltX={1.1} />

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
    <div className="flex flex-col items-center shrink-0 relative" style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,3,15,0.9))" }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at 50% 55%, rgba(29,78,216,0.35) 0%, rgba(79,70,229,0.15) 40%, transparent 70%)"
      }} />
      <div className="cursor-pointer relative" style={{ width: 200, height: 200 }} title="Click to roll">
        <Canvas
          camera={{ position: [0, 0, 6.5], fov: 42 }}
          gl={{ alpha: true, antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.6 }}
          style={{ background: "transparent" }}
        >
          <Suspense fallback={null}>
            <Scene isRolling={isRolling} onRollEnd={handleEnd} onClick={handleClick} />
          </Suspense>
        </Canvas>
        {currentValue !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span style={{
              fontSize: "2.2rem", fontWeight: 900,
              color: "#dbeafe",
              textShadow: "0 0 20px rgba(147,197,253,0.9), 0 0 40px rgba(59,130,246,0.6)",
              fontFamily: "var(--font-cinzel), Georgia, serif"
            }}>
              {currentValue}
            </span>
          </div>
        )}
      </div>
      <div className="text-center pb-2 relative z-10">
        <p className="text-[0.52rem] uppercase tracking-[0.3em] font-cinzel" style={{ color: "rgba(147,197,253,0.4)" }}>
          Würfel-Verlauf
        </p>
        {currentValue !== null ? (
          <p className="text-[0.6rem]" style={{ color: "#93c5fd" }}>
            Letzter Wurf: <span style={{ color: "#d4af37", fontWeight: 900 }}>{currentValue}</span>
          </p>
        ) : (
          <p className="text-[0.58rem] cursor-pointer hover:opacity-80" style={{ color: "rgba(100,116,139,0.5)" }} onClick={handleClick}>
            Klicken zum Würfeln
          </p>
        )}
      </div>
    </div>
  );
}
