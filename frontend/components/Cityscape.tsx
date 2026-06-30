"use client";

import { useEffect, useRef } from "react";

/** An animated night cityscape: a perspective highway with streaming vehicle
 * light-trails over a glowing skyline. Pure canvas, themed to Engram. */
export function Cityscape() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let W = 0;
    let H = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      const r = canvas!.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      build();
    }

    type Car = { lane: number; z: number; speed: number; out: boolean; col: string };
    const LANES = 7;
    let cars: Car[] = [];
    // Deterministic skyline so it doesn't reshuffle each frame.
    let skyline: { x: number; w: number; h: number; lit: boolean[] }[] = [];

    function rnd(seed: number) {
      const x = Math.sin(seed * 99.13) * 43758.5453;
      return x - Math.floor(x);
    }

    function build() {
      cars = [];
      for (let i = 0; i < 120; i++) {
        const out = i % 2 === 0;
        cars.push({
          lane: Math.floor(rnd(i) * LANES),
          z: rnd(i * 1.7),
          speed: 0.0016 + rnd(i * 2.3) * 0.0042,
          out,
          col: out ? (rnd(i) > 0.5 ? "#ff5a7a" : "#a06bff") : (rnd(i) > 0.5 ? "#7cf3ff" : "#eef2ff"),
        });
      }
      skyline = [];
      let x = 0;
      let n = 0;
      while (x < W) {
        const w = 24 + rnd(n) * 46;
        const h = 30 + rnd(n * 1.3) * 120;
        const lit = Array.from({ length: 10 }, (_, k) => rnd(n * 7 + k) > 0.45);
        skyline.push({ x, w, h, lit });
        x += w + 6 + rnd(n * 2) * 10;
        n++;
      }
    }

    const horizonY = () => H * 0.42;
    const vanishX = () => W * 0.5;

    // road edges: from wide bottom to a point at the horizon
    function laneX(lane: number, z: number) {
      const t = z; // 0 = horizon, 1 = foreground
      const roadHalfBottom = W * 0.62;
      const roadHalfTop = W * 0.02;
      const half = roadHalfTop + (roadHalfBottom - roadHalfTop) * t;
      const frac = (lane + 0.5) / LANES - 0.5;
      return vanishX() + frac * half * 2;
    }
    function roadY(z: number) {
      return horizonY() + (H - horizonY()) * z;
    }

    function frame() {
      const hY = horizonY();
      // sky
      const g = ctx!.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a0d1a");
      g.addColorStop(0.42, "#141029");
      g.addColorStop(0.43, "#0c0a16");
      g.addColorStop(1, "#06060c");
      ctx!.fillStyle = g;
      ctx!.fillRect(0, 0, W, H);

      // skyline silhouette + window lights
      for (const b of skyline) {
        ctx!.fillStyle = "#0e1330";
        ctx!.fillRect(b.x, hY - b.h, b.w, b.h);
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 3; c++) {
            if (b.lit[(r * 3 + c) % b.lit.length]) {
              ctx!.fillStyle = r % 2 ? "rgba(124,92,255,0.5)" : "rgba(56,232,208,0.45)";
              ctx!.fillRect(b.x + 5 + c * (b.w / 3), hY - b.h + 6 + r * 13, 3, 5);
            }
          }
        }
      }

      // road surface
      ctx!.beginPath();
      ctx!.moveTo(vanishX() - W * 0.02, hY);
      ctx!.lineTo(vanishX() + W * 0.02, hY);
      ctx!.lineTo(vanishX() + W * 0.62, H);
      ctx!.lineTo(vanishX() - W * 0.62, H);
      ctx!.closePath();
      ctx!.fillStyle = "#0a0a12";
      ctx!.fill();

      // vehicles as light-trails
      for (const car of cars) {
        car.z += car.speed;
        if (car.z >= 1.05) {
          car.z = -0.05 + rnd(car.lane + car.z) * 0.02;
          car.lane = Math.floor(Math.random() * LANES);
        }
        const z = car.z;
        if (z < 0) continue;
        const x = laneX(car.lane, z);
        const y = roadY(z);
        const tailZ = Math.max(0, z - 0.06);
        const xt = laneX(car.lane, tailZ);
        const yt = roadY(tailZ);
        const size = 0.6 + z * z * 5.5;
        const grad = ctx!.createLinearGradient(xt, yt, x, y);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, car.col);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = size;
        ctx!.lineCap = "round";
        ctx!.globalAlpha = 0.25 + z * 0.6;
        ctx!.beginPath();
        ctx!.moveTo(xt, yt);
        ctx!.lineTo(x, y);
        ctx!.stroke();
        // glow head
        ctx!.globalAlpha = 0.5 + z * 0.5;
        ctx!.fillStyle = car.col;
        ctx!.beginPath();
        ctx!.arc(x, y, Math.max(0.5, size * 0.6), 0, Math.PI * 2);
        ctx!.fill();
      }
      ctx!.globalAlpha = 1;

      // faint reflective center glow on the road
      const rg = ctx!.createRadialGradient(vanishX(), hY, 4, vanishX(), hY, W * 0.5);
      rg.addColorStop(0, "rgba(124,92,255,0.10)");
      rg.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = rg;
      ctx!.fillRect(0, 0, W, H);

      raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
