import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Small 3D bar chart for the admin dashboard summary — one extruded bar
 * per status bucket. Gently auto-rotates so it reads as "alive" without
 * needing mouse interaction. Pure three.js, no extra renderer dependency.
 *
 * @param {{label:string, value:number, color?:number}[]} data
 */
export default function ThreeStatBars({ data, height = 220 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !data || data.length === 0) return;

    const width = container.clientWidth || 320;
    const heightPx = container.clientHeight || height;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, width / heightPx, 0.1, 100);
    camera.position.set(3.4, 3.2, 5.4);
    camera.lookAt(0, 0.6, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.55);
    dirLight.position.set(4, 6, 4);
    scene.add(dirLight);

    const maxVal = Math.max(1, ...data.map((d) => d.value));
    const spacing = 1.15;
    const startX = -((data.length - 1) * spacing) / 2;

    const group = new THREE.Group();
    const disposables = [];

    data.forEach((d, i) => {
      const barHeight = 0.15 + (d.value / maxVal) * 2.1;
      const geo = new THREE.BoxGeometry(0.7, barHeight, 0.7);
      const mat = new THREE.MeshStandardMaterial({
        color: d.color ?? 0x16324f,
        roughness: 0.45,
        metalness: 0.08,
      });
      const bar = new THREE.Mesh(geo, mat);
      bar.position.set(startX + i * spacing, barHeight / 2, 0);
      group.add(bar);
      disposables.push(geo, mat);
    });
    scene.add(group);

    const baseGeo = new THREE.PlaneGeometry(data.length * spacing + 1.2, 2.2);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xe6ecee, roughness: 0.95 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.rotation.x = -Math.PI / 2;
    scene.add(base);
    disposables.push(baseGeo, baseMat);

    let frameId;
    function animate() {
      group.rotation.y = Math.sin(Date.now() * 0.00035) * 0.28;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      const w = container.clientWidth || width;
      const h = container.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [data, height]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
