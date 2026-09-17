import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Decorative 3D visual for the auth screens — a rotating wireframe
 * "network" sphere with glowing nodes at each vertex, echoing the idea of
 * many scattered reports being connected into one routed system. Pure
 * three.js (no React renderer wrapper) so it has no extra dependency
 * beyond the `three` package itself.
 */
export default function ThreeHero({ height = 360 }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const heightPx = container.clientHeight || height;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / heightPx, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, heightPx);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Core wireframe icosahedron
    const geometry = new THREE.IcosahedronGeometry(2.15, 1);
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xdd8b24,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    });
    const mesh = new THREE.Mesh(geometry, wireMat);
    scene.add(mesh);

    // Glowing node at each vertex
    const nodeGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const positions = geometry.attributes.position;
    const nodesGroup = new THREE.Group();
    for (let i = 0; i < positions.count; i += 3) {
      const node = new THREE.Mesh(nodeGeo, nodeMat);
      node.position.set(positions.getX(i), positions.getY(i), positions.getZ(i));
      nodesGroup.add(node);
    }
    scene.add(nodesGroup);

    // Faint outer sphere for depth
    const outerGeo = new THREE.SphereGeometry(3.05, 24, 24);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x1d7a72,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    scene.add(outerMesh);

    let frameId;
    function animate() {
      mesh.rotation.y += 0.0025;
      mesh.rotation.x += 0.0009;
      nodesGroup.rotation.copy(mesh.rotation);
      outerMesh.rotation.y -= 0.0012;
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
      geometry.dispose();
      wireMat.dispose();
      nodeGeo.dispose();
      nodeMat.dispose();
      outerGeo.dispose();
      outerMat.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [height]);

  return <div ref={containerRef} style={{ width: '100%', height }} />;
}
