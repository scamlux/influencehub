import { useEffect, useRef } from "react";
import * as THREE from "three";
import { useReducedMotion } from "motion/react";
import { useTheme } from "@/contexts/ThemeContext";

/**
 * HeroParticles — immersive WebGL backdrop for the landing hero.
 * A brand-gradient particle sphere that slowly rotates and parallaxes toward the
 * cursor. Lazy-loaded (three.js stays off every other route) and reduced-motion
 * aware (renders a single static frame instead of animating). Purely decorative
 * and pointer-transparent so it never blocks the hero's CTAs.
 */
export default function HeroParticles() {
  const mountRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { theme } = useTheme();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || window.innerWidth;
    let height = mount.clientHeight || 600;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 100);
    camera.position.z = 15;

    // ── Particle sphere (fibonacci distribution) with a magenta→violet ramp ──
    const COUNT = 2800;
    const positions = new Float32Array(COUNT * 3);
    const colors = new Float32Array(COUNT * 3);
    const cFrom = new THREE.Color("#ff2d8b");
    const cTo = new THREE.Color("#7c3aed");
    const golden = Math.PI * (1 + Math.sqrt(5));
    for (let i = 0; i < COUNT; i++) {
      const radius = 7 + Math.random() * 2.6;
      const phi = Math.acos(1 - (2 * (i + 0.5)) / COUNT);
      const theta = golden * i;
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);
      positions.set([x, y, z], i * 3);
      const col = cFrom.clone().lerp(cTo, (y / radius) * 0.5 + 0.5);
      colors.set([col.r, col.g, col.b], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: theme === "dark" ? 0.95 : 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    // Pointer parallax (eased).
    let targetX = 0;
    let targetY = 0;
    let curX = 0;
    let curY = 0;
    const onPointer = (e: PointerEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.6;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.4;
    };
    window.addEventListener("pointermove", onPointer, { passive: true });

    const onResize = () => {
      width = mount.clientWidth || window.innerWidth;
      height = mount.clientHeight || 600;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    let raf = 0;
    let running = true;
    const renderLoop = () => {
      if (!running) return;
      const t = clock.getElapsedTime();
      curX += (targetX - curX) * 0.05;
      curY += (targetY - curY) * 0.05;
      points.rotation.y = t * 0.05 + curX;
      points.rotation.x = curY + Math.sin(t * 0.1) * 0.05;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(renderLoop);
    };

    // Pause when the tab is hidden (saves battery / main-thread).
    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        clock.getDelta();
        renderLoop();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      renderer.render(scene, camera); // single static frame
    } else {
      renderLoop();
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, [reduced, theme]);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />;
}
