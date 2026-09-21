/* eslint-disable no-unused-vars */
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

function makeCanvas(w, h, draw) {
  const cnv = document.createElement('canvas');
  cnv.width = w;
  cnv.height = h;
  const ctx = cnv.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(cnv);
  tex.needsUpdate = true;
  return tex;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function buildTextures() {
  const recycleTex = makeCanvas(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 8, 8, w - 16, h - 16, 28);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(5,150,105,0.35)';
    ctx.stroke();
    ctx.translate(w / 2, h / 2);
    ctx.strokeStyle = '#059669';
    ctx.fillStyle = '#059669';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate((i * 2 * Math.PI) / 3);
      ctx.beginPath();
      ctx.arc(0, 0, 55, -0.15, 1.0);
      ctx.stroke();
      ctx.beginPath();
      const ang = 1.0;
      const ax = Math.cos(ang) * 55;
      const ay = Math.sin(ang) * 55;
      ctx.moveTo(ax, ay);
      ctx.lineTo(ax - 16, ay - 4);
      ctx.lineTo(ax - 2, ay + 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  });

  const pcbTex = makeCanvas(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    roundRect(ctx, 6, 6, w - 12, h - 12, 18);
    ctx.fillStyle = '#0d3b2c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(94,234,212,0.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(94,234,212,0.55)';
    ctx.lineWidth = 3;
    const paths = [
      [20, 40, 120, 40, 120, 90, 200, 90],
      [20, 200, 80, 200, 80, 140, 160, 140, 160, 60, 230, 60],
      [30, 120, 30, 160, 100, 160],
    ];
    paths.forEach((p) => {
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
      ctx.stroke();
    });
    ctx.fillStyle = '#facc15';
    [[120, 40], [200, 90], [80, 200], [160, 140], [30, 160], [230, 60]].forEach(([x, y]) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#111827';
    roundRect(ctx, 96, 96, 64, 64, 6);
    ctx.fill();
    ctx.strokeStyle = '#2dd4bf';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 96, 96, 64, 64, 6);
    ctx.stroke();
  });

  function makeLabelTex(title, sub) {
    return makeCanvas(300, 200, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      roundRect(ctx, 6, 6, w - 12, h - 12, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([6, 6]);
      ctx.strokeStyle = 'rgba(5,150,105,0.3)';
      ctx.beginPath();
      ctx.moveTo(6, 40);
      ctx.lineTo(w - 6, 40);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#059669';
      ctx.font = '20px sans-serif';
      ctx.fillText('♻', 16, 30);
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#0b1512';
      ctx.fillText(title, 50, 30);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#4b6259';
      ctx.fillText(sub, 20, 62);
      let bx = 20;
      for (let i = 0; i < 40; i++) {
        const bw = 1 + Math.random() * 3;
        ctx.fillStyle = Math.random() > 0.5 ? '#0b1512' : 'transparent';
        ctx.fillRect(bx, 80, bw, 60);
        bx += bw + 2;
        if (bx > w - 20) break;
      }
      ctx.font = '11px monospace';
      ctx.fillStyle = '#4b6259';
      ctx.fillText('SL-EWASTE-' + Math.floor(1000 + Math.random() * 8999), 20, 165);
    });
  }

  function makeRamTexture() {
    return makeCanvas(320, 100, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      roundRect(ctx, 4, 4, w - 8, h - 8, 8);
      ctx.fillStyle = '#0d3b2c';
      ctx.fill();
      ctx.strokeStyle = 'rgba(94,234,212,0.5)';
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = '#111827';
        roundRect(ctx, 26 + i * 54, 18, 40, 40, 4);
        ctx.fill();
        ctx.strokeStyle = '#2dd4bf';
        ctx.lineWidth = 1;
        roundRect(ctx, 26 + i * 54, 18, 40, 40, 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#facc15';
      for (let i = 0; i < 22; i++) {
        ctx.fillRect(10 + i * 13.5, h - 14, 8, 10);
      }
    });
  }

  function makeBatteryTexture() {
    return makeCanvas(256, 128, (ctx, w, h) => {
      ctx.fillStyle = '#16241f';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#059669';
      ctx.fillRect(0, h * 0.32, w, h * 0.4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('E-WASTE', w / 2, h * 0.56);
      ctx.font = '12px monospace';
      ctx.fillText('Ni-MH  RECOVERED', w / 2, h * 0.72);
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#facc15';
      ctx.fillText('+', w * 0.12, h * 0.2);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillText('—', w * 0.88, h * 0.9);
      ctx.textAlign = 'left';
    });
  }

  function makeAluminumTexture() {
    return makeCanvas(256, 256, (ctx, w, h) => {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#e5e7eb');
      grad.addColorStop(0.5, '#9ca3af');
      grad.addColorStop(1, '#d1d5db');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 26; i++) {
        ctx.lineWidth = 1 + Math.random() * 1.5;
        ctx.beginPath();
        const x1 = Math.random() * w, y1 = Math.random() * h;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (Math.random() - 0.5) * 60, y1 + (Math.random() - 0.5) * 60);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(30,41,59,0.25)';
      for (let i = 0; i < 14; i++) {
        ctx.lineWidth = 1;
        ctx.beginPath();
        const x1 = Math.random() * w, y1 = Math.random() * h;
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 + (Math.random() - 0.5) * 40, y1 + (Math.random() - 0.5) * 40);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(5,150,105,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, w - 8, h - 8);
    });
  }

  return {
    planeTextures: [
      recycleTex, pcbTex,
      makeLabelTex('BATCH #1042', 'RECOVERED COPPER'),
      makeLabelTex('BATCH #0977', 'Li-ION — HANDLE W/ CARE'),
      makeLabelTex('EXPORT LOT', 'GRADE A — CERTIFIED'),
    ],
    ramTexture: makeRamTexture(),
    batteryTexture: makeBatteryTexture(),
    aluminumTexture: makeAluminumTexture(),
  };
}

/**
 * Animated e-waste themed 3D background: floating recycling-symbol
 * tiles, PCB/circuit-board chip tiles, batch/shipping-label tiles, a
 * battery cell, a RAM stick, and a crushed-aluminum recycling cube drift
 * and slowly rotate behind whatever content sits on top. Pauses rendering
 * entirely when scrolled out of view (IntersectionObserver) to save
 * CPU/GPU. Renders into an absolutely-positioned <canvas> that fills its
 * parent — the parent element must have `position: relative` (or similar).
 *
 * `density` lets busier screens (the app shell, which also has to render
 * data tables) ask for fewer tiles / no antialiasing than the marketing
 * landing page.
 */
export const Hero3D = ({ density = 'full' }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    const lite = density === 'lite';
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: !lite && window.innerWidth >= 768,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1 : 1.5));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    let resizeRaf = null;
    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const onResize = () => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(resize);
    };
    resize();
    window.addEventListener('resize', onResize);

    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const dir = new THREE.DirectionalLight(0x2dd4bf, 1.1);
    dir.position.set(5, 6, 8);
    scene.add(dir);
    const dir2 = new THREE.DirectionalLight(0x059669, 0.6);
    dir2.position.set(-6, -3, -4);
    scene.add(dir2);

    const group = new THREE.Group();
    scene.add(group);

    const { planeTextures, ramTexture, batteryTexture, aluminumTexture } = buildTextures();
    const meshes = [];
    const baseCount = window.innerWidth < 768 ? 8 : 12;
    const count = lite ? Math.round(baseCount * 0.6) : baseCount;

    for (let i = 0; i < count; i++) {
      let mesh;
      const kind = i % 8;
      if (kind === 5) {
        const geo = new THREE.CylinderGeometry(0.32, 0.32, 1.05, 28);
        const mat = new THREE.MeshStandardMaterial({ map: batteryTexture, roughness: 0.4, metalness: 0.3, transparent: true, opacity: lite ? 0.55 : 0.95 });
        mesh = new THREE.Mesh(geo, mat);
      } else if (kind === 6) {
        const aspect = ramTexture.image.width / ramTexture.image.height;
        const h = 1.0;
        const w = h * aspect;
        const geo = new THREE.PlaneGeometry(w, h);
        const mat = new THREE.MeshBasicMaterial({ map: ramTexture, transparent: true, opacity: lite ? 0.55 : 1, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geo, mat);
      } else if (kind === 7) {
        const geo = new THREE.BoxGeometry(0.9, 0.9, 0.9);
        const mat = new THREE.MeshStandardMaterial({ map: aluminumTexture, roughness: 0.35, metalness: 0.75, transparent: true, opacity: lite ? 0.55 : 0.95 });
        mesh = new THREE.Mesh(geo, mat);
      } else {
        const tex = planeTextures[kind % planeTextures.length];
        const aspect = tex.image.width / tex.image.height;
        const geo = new THREE.PlaneGeometry(1.6 * aspect, 1.6);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: lite ? 0.55 : 1, side: THREE.DoubleSide });
        mesh = new THREE.Mesh(geo, mat);
      }
      const radius = 5 + Math.random() * 4.5;
      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * radius, (Math.random() - 0.5) * 8, Math.sin(angle) * radius - 4);
      mesh.scale.setScalar(0.7 + Math.random() * 0.7);
      mesh.rotation.set(Math.random() * 0.6 - 0.3, Math.random() * Math.PI, Math.random() * 0.4 - 0.2);
      mesh.userData.spin = { x: (Math.random() - 0.5) * 0.004, y: (Math.random() - 0.5) * 0.006 };
      mesh.userData.floatOffset = Math.random() * Math.PI * 2;
      mesh.userData.floatSpeed = 0.35 + Math.random() * 0.45;
      mesh.userData.baseY = mesh.position.y;
      group.add(mesh);
      meshes.push(mesh);
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0x059669, transparent: true, opacity: lite ? 0.08 : 0.16 });
    const lines = [];
    if (!lite) {
      for (let i = 0; i < meshes.length - 1; i += 2) {
        const a = meshes[i].position;
        const b = meshes[(i + 3) % meshes.length].position;
        const lineGeo = new THREE.BufferGeometry().setFromPoints([a, b]);
        const line = new THREE.Line(lineGeo, lineMat);
        scene.add(line);
        lines.push(line);
      }
    }

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMouseMove);

    const clock = new THREE.Clock();
    let rafId = null;

    const animate = () => {
      rafId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      meshes.forEach((m) => {
        m.rotation.x += m.userData.spin.x;
        m.rotation.y += m.userData.spin.y;
        m.position.y = m.userData.baseY + Math.sin(t * m.userData.floatSpeed + m.userData.floatOffset) * 0.4;
      });
      group.rotation.y += lite ? 0.0004 : 0.0009;
      camera.position.x += (mouseX * (lite ? 0.6 : 1.5) - camera.position.x) * 0.02;
      camera.position.y += (-mouseY * (lite ? 0.4 : 1.0) - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && rafId === null) {
          animate();
        } else if (!entry.isIntersecting && rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      },
      { threshold: 0.01 }
    );
    visibilityObserver.observe(container);

    animate();

    return () => {
      visibilityObserver.disconnect();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.dispose();
      planeTextures.forEach((t) => t.dispose());
      ramTexture.dispose();
      batteryTexture.dispose();
      aluminumTexture.dispose();
      meshes.forEach((m) => {
        m.geometry.dispose();
        m.material.dispose();
      });
      lines.forEach((l) => {
        l.geometry.dispose();
      });
      lineMat.dispose();
    };
  }, [density]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
};

export default Hero3D;
