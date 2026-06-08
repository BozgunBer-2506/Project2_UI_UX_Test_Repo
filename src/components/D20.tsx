"use client";

import { useRef, useEffect, useCallback, useState } from "react";

const PHI = (1 + Math.sqrt(5)) / 2;
const NORM = Math.sqrt(1 + PHI * PHI);
type V3 = [number, number, number];

const VERTS: V3[] = [
  [-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],
  [0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],
  [PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1],
].map(v => [v[0]/NORM, v[1]/NORM, v[2]/NORM]);

const FACES = [
  [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
  [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
  [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
  [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
];
const NUMS = [20,2,14,8,6,16,18,4,12,10,1,19,7,13,3,17,11,5,15,9];
const LIGHT: V3 = (() => { const l: V3=[0.45,0.85,0.65]; const n=Math.sqrt(l[0]**2+l[1]**2+l[2]**2); return [l[0]/n,l[1]/n,l[2]/n]; })();

const sub   = (a:V3,b:V3):V3 => [a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross = (a:V3,b:V3):V3 => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot   = (a:V3,b:V3) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const nrm   = (v:V3):V3 => { const l=Math.sqrt(v[0]**2+v[1]**2+v[2]**2); return [v[0]/l,v[1]/l,v[2]/l]; };

type Particle = { x:number; y:number; vx:number; vy:number; life:number; maxLife:number; size:number; hue:number };

function rotate(v:V3,ry:number,rx:number):V3 {
  let [x,y,z]=v;
  const cy=Math.cos(ry),sy=Math.sin(ry); [x,z]=[x*cy+z*sy,-x*sy+z*cy];
  const cx=Math.cos(rx),sx=Math.sin(rx); [y,z]=[y*cx-z*sx,y*sx+z*cx];
  return [x,y,z];
}
function proj(v:V3,S:number,cx:number,cy:number):[number,number,number] {
  const f=5/(5+v[2]*0.22); return [cx+v[0]*S*f, cy-v[1]*S*f, v[2]];
}

export default function D20({ onRoll, currentValue }:{ onRoll:(v:number)=>void; currentValue:number|null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ ry:0, spd:0.38, rolling:false, runeA:0, pulse:0 });
  const particles = useRef<Particle[]>([]);
  const raf   = useRef<number>(0);
  const [lastRoll, setLastRoll] = useState<number|null>(currentValue);

  const spawnParticles = useCallback((cx:number, cy:number, S:number, count:number) => {
    for(let i=0;i<count;i++){
      const angle = Math.random()*Math.PI*2;
      const r = S*(0.3+Math.random()*0.5);
      particles.current.push({
        x: cx + Math.cos(angle)*r,
        y: cy + Math.sin(angle)*r,
        vx: (Math.random()-0.5)*0.8,
        vy: -(0.4+Math.random()*1.2),
        life: 1,
        maxLife: 0.6+Math.random()*0.9,
        size: 1.5+Math.random()*2.5,
        hue: Math.random()<0.6 ? 210+Math.random()*40 : 40+Math.random()*20,
      });
    }
  }, []);

  const draw = useCallback((ry:number, runeA:number, pulse:number, dt:number, rolling:boolean) => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d"); if(!ctx) return;
    const DPR = window.devicePixelRatio||1;
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const CX=W/2, CY=H/2-8, S=W*0.31, RX=0.28;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    // Outer magical aura
    const auraR = S*1.05 + Math.sin(pulse*2.1)*S*0.06;
    const aura = ctx.createRadialGradient(CX,CY,S*0.5,CX,CY,auraR*1.3);
    aura.addColorStop(0, `rgba(80,140,255,${0.06+Math.sin(pulse*1.7)*0.03})`);
    aura.addColorStop(0.6, `rgba(130,80,255,${0.04+Math.sin(pulse*2.3)*0.02})`);
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle=aura; ctx.beginPath(); ctx.arc(CX,CY,auraR*1.4,0,Math.PI*2); ctx.fill();

    // Rune ground rings — blue-purple
    const runeY=CY+S*0.80;
    ctx.save(); ctx.translate(CX,runeY); ctx.scale(1,0.22); ctx.rotate(runeA);
    [1.05,0.85,0.66,0.48].forEach((r,i)=>{
      const alpha=[0.30,0.22,0.15,0.09][i];
      const glowAlpha=[0.18,0.13,0.09,0.05][i];
      ctx.shadowBlur=8*DPR; ctx.shadowColor=`rgba(100,160,255,${glowAlpha*3})`;
      ctx.beginPath(); ctx.arc(0,0,S*r,0,Math.PI*2);
      ctx.strokeStyle=`rgba(100,160,255,${alpha})`; ctx.lineWidth=1.8*DPR; ctx.stroke();
    });
    // Rune symbols on ring
    const runeGlyphs = ['ᚠ','ᚢ','ᚦ','ᚨ','ᚱ','ᚲ','ᚷ','ᚹ'];
    ctx.shadowBlur=6*DPR; ctx.shadowColor='rgba(140,100,255,0.7)';
    ctx.fillStyle=`rgba(160,120,255,${0.45+Math.sin(pulse*1.3)*0.15})`;
    ctx.font=`${Math.round(S*0.12*DPR)}px serif`; ctx.textAlign='center'; ctx.textBaseline='middle';
    for(let i=0;i<8;i++){
      const a = runeA*1.5+i*(Math.PI*2/8);
      const rx2=S*0.92, ry2=S*0.92*0.22;
      ctx.save(); ctx.rotate(a); ctx.scale(1,1/0.22);
      ctx.fillText(runeGlyphs[i], rx2, 0); ctx.restore();
    }
    ctx.shadowBlur=0;
    ctx.restore();

    const vp=VERTS.map(v=>{ const r=rotate(v,ry,RX); return {r,p:proj(r,S,CX,CY)}; });

    const faces=FACES.map((f,i)=>{
      const [r0,r1,r2]=[vp[f[0]].r,vp[f[1]].r,vp[f[2]].r];
      const [p0,p1,p2]=[vp[f[0]].p,vp[f[1]].p,vp[f[2]].p];
      const n=nrm(cross(sub(r1,r0),sub(r2,r0)));
      const camDot=n[2], lightDot=Math.max(0,dot(n,LIGHT));
      const zMid=(p0[2]+p1[2]+p2[2])/3;
      const cxF=(p0[0]+p1[0]+p2[0])/3, cyF=(p0[1]+p1[1]+p2[1])/3;
      return {p0,p1,p2,camDot,lightDot,zMid,cxF,cyF,num:NUMS[i]};
    }).sort((a,b)=>a.zMid-b.zMid);

    for(const f of faces){
      if(f.camDot<0.02) continue;
      const {p0,p1,p2,lightDot:t,cxF,cyF,num,camDot}=f;

      // Deep metallic dark face fill with blue-tinted gradient
      const dark=0.05+t*0.20;
      const baseR=Math.round(4+dark*20), baseG=Math.round(6+dark*18), baseB=Math.round(22+dark*55);

      const g2=ctx.createRadialGradient(cxF,cyF-S*0.08,0,cxF,cyF,S*0.45);
      // Specular highlight at top
      const specular = Math.max(0, t-0.4)*1.6;
      g2.addColorStop(0,`rgba(${Math.min(255,baseR+60+Math.round(specular*80))},${Math.min(255,baseG+50+Math.round(specular*60))},${Math.min(255,baseB+60+Math.round(specular*40))},0.97)`);
      g2.addColorStop(0.5,`rgba(${baseR+10},${baseG+8},${baseB+22},0.95)`);
      g2.addColorStop(1,`rgba(${baseR},${baseG},${baseB},0.92)`);

      ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.closePath();
      ctx.fillStyle=g2; ctx.fill();

      // Edge glow — gold + blue
      const edgeBlue = 0.20+t*0.35;
      const edgeGold = 0.25+t*0.50;
      ctx.strokeStyle=`rgba(212,175,55,${edgeGold})`;
      ctx.lineWidth=1.5*DPR;
      ctx.shadowBlur=(8+t*14)*DPR; ctx.shadowColor=`rgba(100,160,255,${edgeBlue})`; ctx.stroke();
      ctx.shadowBlur=0;

      // Number
      if(camDot>0.15){
        const alpha=Math.min(1,(camDot-0.15)/0.25);
        const is20 = num===20;
        const sz = is20 ? Math.round(S*0.21*DPR) : Math.round(S*0.155*DPR);
        ctx.font=`900 ${sz}px Georgia,serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
        if(is20){
          // 20 glows in blue-white
          ctx.shadowBlur=18*DPR; ctx.shadowColor=`rgba(160,200,255,0.95)`;
          ctx.fillStyle=`rgba(220,235,255,${alpha})`;
        } else {
          ctx.shadowBlur=10*DPR; ctx.shadowColor=`rgba(212,175,55,0.85)`;
          ctx.fillStyle=`rgba(212,175,55,${alpha})`;
        }
        ctx.fillText(String(num),cxF,cyF); ctx.shadowBlur=0;
      }
    }

    // Particles
    if(rolling && Math.random()<0.35) spawnParticles(CX, CY, S, 2);
    const next: Particle[] = [];
    for(const p of particles.current){
      p.life -= dt/p.maxLife;
      if(p.life<=0) continue;
      p.x+=p.vx; p.y+=p.vy; p.vy+=0.02;
      const a = p.life * 0.9;
      const isBlue = p.hue > 100;
      ctx.shadowBlur = p.size*4*DPR;
      ctx.shadowColor = isBlue ? `rgba(100,160,255,${a*0.8})` : `rgba(212,175,55,${a*0.8})`;
      ctx.beginPath(); ctx.arc(p.x*DPR/DPR, p.y*DPR/DPR, p.size*(0.5+p.life*0.5), 0, Math.PI*2);
      ctx.fillStyle = isBlue ? `rgba(140,190,255,${a})` : `rgba(212,175,55,${a})`;
      ctx.fill();
      ctx.shadowBlur=0;
      next.push(p);
    }
    particles.current = next;

  }, [spawnParticles]);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const DPR=window.devicePixelRatio||1;
    canvas.width=220*DPR; canvas.height=230*DPR;
    canvas.getContext("2d")!.scale(DPR,DPR);
    let last=0;
    const loop=(t:number)=>{
      const dt=Math.min((t-last)/1000,0.05); last=t;
      const s=state.current;
      s.pulse+=dt;
      s.spd=s.rolling?Math.min(s.spd+dt*14,18):(s.spd>0.38?Math.max(s.spd-dt*7,0.38):0.38);
      s.ry+=dt*s.spd; s.runeA-=dt*0.11;
      draw(s.ry,s.runeA,s.pulse,dt,s.rolling);
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf.current);
  },[draw]);

  const handleClick=useCallback(()=>{
    const s=state.current; if(s.rolling) return;
    s.rolling=true;
    const canvas=canvasRef.current;
    if(canvas){
      const DPR=window.devicePixelRatio||1;
      const W=canvas.width/DPR, H=canvas.height/DPR;
      spawnParticles(W/2, H/2-8, W*0.31, 18);
    }
    const val=Math.floor(Math.random()*20)+1;
    setTimeout(()=>{ s.rolling=false; setLastRoll(val); onRoll(val); },1600);
  },[onRoll, spawnParticles]);

  return (
    <div className="flex flex-col items-center shrink-0 cursor-pointer select-none" onClick={handleClick} title="Klicken zum Würfeln">
      <canvas ref={canvasRef} style={{width:220,height:230,background:"transparent"}} />
      <div className="text-center pb-2 -mt-4">
        <p className="text-[0.44rem] uppercase tracking-[0.32em] font-cinzel" style={{color:"rgba(140,180,255,0.5)"}}>Würfel-Verlauf</p>
        {lastRoll!==null
          ? <p className="text-[0.56rem] mt-0.5 font-cinzel" style={{color:"rgba(160,200,255,0.7)"}}>Letzter Wurf: <span style={{color: lastRoll===20?"#a0c4ff":"#d4af37",fontWeight:900,textShadow:lastRoll===20?"0 0 8px rgba(100,160,255,0.8)":"none"}}>{lastRoll}</span></p>
          : <p className="text-[0.52rem] mt-0.5" style={{color:"rgba(100,160,255,0.25)"}}>▽</p>}
      </div>
    </div>
  );
}
