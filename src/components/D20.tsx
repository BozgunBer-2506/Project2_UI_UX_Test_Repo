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
  const state = useRef({ ry:0, spd:0.38, rolling:false, runeA:0 });
  const raf   = useRef<number>(0);
  const [lastRoll, setLastRoll] = useState<number|null>(currentValue);

  const draw = useCallback((ry:number, runeA:number) => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d"); if(!ctx) return;
    const DPR = window.devicePixelRatio||1;
    const W=canvas.width/DPR, H=canvas.height/DPR;
    const CX=W/2, CY=H/2-8, S=W*0.31, RX=0.28;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    const runeY=CY+S*0.80;
    ctx.save(); ctx.translate(CX,runeY); ctx.scale(1,0.24); ctx.rotate(runeA);
    [1.05,0.88,0.70,0.52].forEach((r,i)=>{
      ctx.beginPath(); ctx.arc(0,0,S*r,0,Math.PI*2);
      ctx.strokeStyle=`rgba(212,175,55,${[0.22,0.16,0.11,0.07][i]})`; ctx.lineWidth=1.5*DPR;
      ctx.stroke();
    });
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

      const dark=0.06+t*0.16;
      const r=Math.round(4+dark*14), g=Math.round(8+dark*16), b=Math.round(28+dark*50);
      const g2=ctx.createRadialGradient(cxF,cyF,0,cxF,cyF,S*0.42);
      g2.addColorStop(0,`rgba(${r+12},${g+10},${b+30},0.95)`);
      g2.addColorStop(1,`rgba(${r},${g},${b},0.92)`);
      ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.lineTo(p2[0],p2[1]); ctx.closePath();
      ctx.fillStyle=g2; ctx.fill();

      const eA=0.4+t*0.55;
      ctx.strokeStyle=`rgba(212,175,55,${eA})`;
      ctx.lineWidth=1.4*DPR;
      ctx.shadowBlur=(6+t*10)*DPR; ctx.shadowColor=`rgba(212,175,55,${0.5+t*0.4})`; ctx.stroke();
      ctx.shadowBlur=0;

      if(camDot>0.18){
        const alpha=Math.min(1,(camDot-0.18)/0.28);
        const sz=num===20?Math.round(S*0.19*DPR):Math.round(S*0.145*DPR);
        ctx.font=`900 ${sz}px Georgia,serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.shadowBlur=12*DPR; ctx.shadowColor="rgba(212,175,55,0.9)";
        ctx.fillStyle=`rgba(212,175,55,${alpha})`;
        ctx.fillText(String(num),cxF,cyF); ctx.shadowBlur=0;
      }
    }
  }, []);

  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const DPR=window.devicePixelRatio||1;
    canvas.width=220*DPR; canvas.height=230*DPR;
    canvas.getContext("2d")!.scale(DPR,DPR);
    let last=0;
    const loop=(t:number)=>{
      const dt=Math.min((t-last)/1000,0.05); last=t;
      const s=state.current;
      s.spd=s.rolling?Math.min(s.spd+dt*14,18):(s.spd>0.38?Math.max(s.spd-dt*7,0.38):0.38);
      s.ry+=dt*s.spd; s.runeA-=dt*0.09;
      draw(s.ry,s.runeA);
      raf.current=requestAnimationFrame(loop);
    };
    raf.current=requestAnimationFrame(loop);
    return ()=>cancelAnimationFrame(raf.current);
  },[draw]);

  const handleClick=useCallback(()=>{
    const s=state.current; if(s.rolling) return;
    s.rolling=true;
    const val=Math.floor(Math.random()*20)+1;
    setTimeout(()=>{ s.rolling=false; setLastRoll(val); onRoll(val); },1600);
  },[onRoll]);

  return (
    <div className="flex flex-col items-center shrink-0 cursor-pointer select-none" onClick={handleClick} title="Klicken zum Würfeln">
      <canvas ref={canvasRef} style={{width:220,height:230,background:"transparent"}} />
      <div className="text-center pb-2 -mt-4">
        <p className="text-[0.44rem] uppercase tracking-[0.32em] font-cinzel" style={{color:"rgba(212,175,55,0.4)"}}>Würfel-Verlauf</p>
        {lastRoll!==null
          ? <p className="text-[0.56rem] mt-0.5" style={{color:"rgba(212,175,55,0.7)"}}>Letzter Wurf: <span style={{color:"#d4af37",fontWeight:900}}>{lastRoll}</span></p>
          : <p className="text-[0.52rem] mt-0.5" style={{color:"rgba(212,175,55,0.2)"}}>▽</p>}
      </div>
    </div>
  );
}
