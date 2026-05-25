// @ts-nocheck
// ??$$$ - 3D Render Canvas Viewport with physics integration
import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { stepPhysics } from '../utils/physics';

// ??$$$ - Component parameters updated for explode and assembly triggers
export default function ThreeViewport({
  objects,
  setObjects,
  selectedId,
  setSelectedId,
  isSimulating,
  setIsSimulating,
  physicsConfig,
  isExploded = false,
  assemblyTrigger = 0
}) {
  const mountRef = useRef(null);
  // ??$$$ Use a pre-created canvas element to avoid duplicate WebGL context creation
  const canvasRef = useRef(null);
  const [webglError, setWebglError] = useState(null);
  const [isAssembling, setIsAssembling] = useState(false);
  
  // Keep refs of react state to read inside the animation loop without recreation
  const objectsRef = useRef(objects);
  const isSimulatingRef = useRef(isSimulating);
  const physicsConfigRef = useRef(physicsConfig);
  const selectedIdRef = useRef(selectedId);
  const setObjectsRef = useRef(setObjects);

  // ??$$$ - Refs for smooth real-time ticks animations
  const isExplodedRef = useRef(isExploded);
  const explodeFactorRef = useRef(0);
  const assemblyTimeRef = useRef(-1);
  const isAssemblingRef = useRef(false);

  // Sync refs with state changes
  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { isSimulatingRef.current = isSimulating; }, [isSimulating]);
  useEffect(() => { physicsConfigRef.current = physicsConfig; }, [physicsConfig]);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { setObjectsRef.current = setObjects; }, [setObjects]);

  // ??$$$ - Watch explode and assembly triggers
  useEffect(() => {
    isExplodedRef.current = isExploded;
  }, [isExploded]);

  useEffect(() => {
    if (assemblyTrigger > 0) {
      assemblyTimeRef.current = 0; // start assembly timeline
    }
  }, [assemblyTrigger]);

  // Three.js instances refs
  const sceneRef = useRef(null);
  const meshesRef = useRef({}); // Mapping: objId -> THREE.Mesh
  const transformControlsRef = useRef(null);
  const orbitControlsRef = useRef(null);
  const rendererRef = useRef(null);
  const cameraRef = useRef(null);
  const lightsRef = useRef([]);

  // Initialize Three.js environment
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ??$$$ Guard: ensure container has real pixel dimensions before creating renderer
    const width = container.clientWidth || container.offsetWidth;
    const height = container.clientHeight || container.offsetHeight;

    // ??$$$ WebGL support check — detect before attempting renderer creation
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
    if (!gl) {
      setWebglError('WebGL is not supported or has been disabled in this browser. Please enable hardware acceleration.');
      return;
    }

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0a0b10');
    scene.fog = new THREE.FogExp2('#0a0b10', 0.015);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(50, Math.max(width, 1) / Math.max(height, 1), 0.1, 100);
    camera.position.set(10, 8, 15);
    cameraRef.current = camera;

    // 3. Renderer setup — ??$$$ pass the pre-created canvas and add powerPreference hint
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvasRef.current,
        powerPreference: 'high-performance',
      });
    } catch (err) {
      setWebglError(`Failed to create WebGL renderer: ${err.message}`);
      return;
    }
    renderer.setSize(Math.max(width, 300), Math.max(height, 300));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.25);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight('#ffffff', 1.5);
    dirLight.position.set(12, 18, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 40;
    const d = 15;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const dirLight2 = new THREE.DirectionalLight('#7000ff', 0.6);
    dirLight2.position.set(-10, 5, -10);
    scene.add(dirLight2);

    lightsRef.current = [ambientLight, dirLight, dirLight2];

    // 5. Grid and Helpers
    const gridHelper = new THREE.GridHelper(40, 40, '#00f0ff', '#1a1d2e');
    gridHelper.position.y = 0.01; // slightly above floor
    scene.add(gridHelper);

    // 6. Orbit Controls
    const orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true;
    orbitControls.dampingFactor = 0.05;
    orbitControls.maxPolarAngle = Math.PI / 2 - 0.02; // prevent going below ground
    orbitControlsRef.current = orbitControls;

    // 7. Transform Controls (Gizmos for moving objects)
    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.addEventListener('change', () => renderer.render(scene, camera));
    transformControls.addEventListener('dragging-changed', (event) => {
      orbitControls.enabled = !event.value; // disable orbits when dragging gizmo
    });
    // On gizmo drag end, sync the new transform values back to React state
    transformControls.addEventListener('objectChange', () => {
      const activeObj = transformControls.object;
      if (activeObj && activeObj.userData && activeObj.userData.id) {
        const id = activeObj.userData.id;
        const currentObjects = [...objectsRef.current];
        const index = currentObjects.findIndex(o => o.id === id);
        if (index !== -1) {
          const obj = { ...currentObjects[index] };
          obj.position = [activeObj.position.x, activeObj.position.y, activeObj.position.z];
          obj.rotation = [
            THREE.MathUtils.radToDeg(activeObj.rotation.x),
            THREE.MathUtils.radToDeg(activeObj.rotation.y),
            THREE.MathUtils.radToDeg(activeObj.rotation.z)
          ];
          // If the shape scale is modified
          if (activeObj.scale) {
             // For simplicity, we just keep position and rotation sync'd, 
             // scale is edited via parameters, but we can capture it too.
          }
          currentObjects[index] = obj;
          setObjectsRef.current(currentObjects);
        }
      }
    });
    scene.add(transformControls);
    transformControlsRef.current = transformControls;

    // Raycasting for object selection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (e) => {
      // Don't select if clicking on transform gizmos
      if (transformControls.dragging) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      // Filter children to selectable meshes
      const selectableObjects = Object.values(meshesRef.current);
      const intersects = raycaster.intersectObjects(selectableObjects, true);

      if (intersects.length > 0) {
        // Find root mesh in case of compound structures
        let clickedMesh = intersects[0].object;
        while (clickedMesh.parent && clickedMesh.parent !== scene) {
          clickedMesh = clickedMesh.parent;
        }
        if (clickedMesh.userData && clickedMesh.userData.id) {
          setSelectedId(clickedMesh.userData.id);
        }
      } else {
        // Clicked empty space
        setSelectedId(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation / Render loop
    let lastTime = performance.now();
    let animId;

    // ??$$$ - Tick loop with physics, auto-arrangement, exploded view, and assembly animations
    const tick = () => {
      const time = performance.now();
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      const currentObjects = objectsRef.current;

      // 1. Run physics step if simulating
      if (isSimulatingRef.current) {
        const clonedObjects = JSON.parse(JSON.stringify(currentObjects));
        
        // Step the physics on current state copy
        stepPhysics(clonedObjects, physicsConfigRef.current, dt);

        // Sync visual meshes directly for fast performance
        clonedObjects.forEach((obj) => {
          const mesh = meshesRef.current[obj.id];
          if (mesh) {
            mesh.position.set(obj.position[0], obj.position[1], obj.position[2]);
            mesh.rotation.set(
              THREE.MathUtils.degToRad(obj.rotation[0]),
              THREE.MathUtils.degToRad(obj.rotation[1]),
              THREE.MathUtils.degToRad(obj.rotation[2])
            );
            
            // Retain velocities for next frame
            const currentObj = currentObjects.find(o => o.id === obj.id);
            if (currentObj) {
              currentObj.position = obj.position;
              currentObj.velocity = obj.velocity;
            }
          }
        });
      } else {
        // 2. If NOT simulating, apply animation overrides (Exploded view / Assembly)
        // Lerp explode factor
        if (isExplodedRef.current && assemblyTimeRef.current < 0) {
          explodeFactorRef.current = THREE.MathUtils.lerp(explodeFactorRef.current, 1, 0.08);
        } else {
          explodeFactorRef.current = THREE.MathUtils.lerp(explodeFactorRef.current, 0, 0.08);
        }

        // Check assembly timeline
        let isAssemblingNow = false;
        if (assemblyTimeRef.current >= 0) {
          isAssemblingNow = true;
          assemblyTimeRef.current += dt;
          if (assemblyTimeRef.current > 5.0) {
            assemblyTimeRef.current = -1;
          }
        }

        // Trigger react state update safely
        if (isAssemblingRef.current !== isAssemblingNow) {
          isAssemblingRef.current = isAssemblingNow;
          setTimeout(() => setIsAssembling(isAssemblingNow), 0);
        }

        // Calculate average scene center excluding the floor
        const validObjs = currentObjects.filter(o => o.id !== 'floor');
        const sceneCenter = new THREE.Vector3(0, 0, 0);
        if (validObjs.length > 0) {
          validObjs.forEach(o => {
            sceneCenter.x += o.position[0];
            sceneCenter.y += o.position[1];
            sceneCenter.z += o.position[2];
          });
          sceneCenter.divideScalar(validObjs.length);
        }

        const structuralParts = currentObjects.filter(o => o.id !== 'floor' && !o.isElectronic);
        const numStructural = Math.max(structuralParts.length, 1);

        currentObjects.forEach((obj) => {
          const mesh = meshesRef.current[obj.id];
          if (!mesh) return;

          let px = obj.position[0];
          let py = obj.position[1];
          let pz = obj.position[2];

          // A. Assembly Animation override
          if (isAssemblingNow) {
            if (obj.id === 'floor') {
              // Floor stays in place
            } else if (obj.isElectronic) {
              // Electronic components arrive between t = 0 and t = 1.5 seconds
              const p = Math.max(0, Math.min(assemblyTimeRef.current / 1.5, 1));
              const easeP = 1 - Math.pow(1 - p, 3); // easeOutCubic
              py = py + 12 * (1 - easeP); // fly down
            } else {
              // Structural parts arrive staggered between t = 1.5 and t = 4.5 seconds
              const idx = structuralParts.findIndex(o => o.id === obj.id);
              const offsetIndex = idx >= 0 ? idx : 0;
              const tStart = 1.5 + offsetIndex * (2.8 / numStructural);
              const p = Math.max(0, Math.min((assemblyTimeRef.current - tStart) / 0.8, 1));
              const easeP = 1 - Math.pow(1 - p, 3);
              
              if (offsetIndex % 4 === 0) px = px - 10 * (1 - easeP);
              else if (offsetIndex % 4 === 1) px = px + 10 * (1 - easeP);
              else if (offsetIndex % 4 === 2) pz = pz + 10 * (1 - easeP);
              else pz = pz - 10 * (1 - easeP);
              
              py = py + 3 * (1 - easeP);
            }
          }

          // B. Explode Modifier override
          if (explodeFactorRef.current > 0 && obj.id !== 'floor') {
            const currentPos = new THREE.Vector3(px, py, pz);
            const dir = new THREE.Vector3().subVectors(currentPos, sceneCenter);
            if (dir.lengthSq() < 0.01) {
              dir.set(Math.random() - 0.5, 0.5, Math.random() - 0.5);
            }
            dir.normalize();
            
            px += dir.x * (4.5 * explodeFactorRef.current);
            py += dir.y * (4.5 * explodeFactorRef.current);
            pz += dir.z * (4.5 * explodeFactorRef.current);
          }

          mesh.position.set(px, py, pz);
          mesh.rotation.set(
            THREE.MathUtils.degToRad(obj.rotation[0]),
            THREE.MathUtils.degToRad(obj.rotation[1]),
            THREE.MathUtils.degToRad(obj.rotation[2])
          );
        });
      }

      orbitControls.update();
      renderer.render(scene, camera);
      animId = requestAnimationFrame(tick);
    };

    tick();

    // Cleanups
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      // ??$$$ Do NOT remove the canvas element — it is managed by canvasRef in the JSX
      renderer.dispose();
    };
  }, [setSelectedId]);

  // Synchronize 3D meshes with objects prop
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Identify which objects were added, deleted or modified
    const currentIds = new Set(objects.map(o => o.id));
    
    // Delete meshes that no longer exist
    Object.keys(meshesRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        const mesh = meshesRef.current[id];
        scene.remove(mesh);
        delete meshesRef.current[id];
        
        // If the selected object is deleted, detach controls
        if (selectedIdRef.current === id) {
          transformControlsRef.current.detach();
        }
      }
    });

    // Add or update meshes
    objects.forEach((obj) => {
      let mesh = meshesRef.current[obj.id];

      // If mesh doesn't exist, create it
      if (!mesh) {
        mesh = createMeshForObject(obj);
        scene.add(mesh);
        meshesRef.current[obj.id] = mesh;
      } else {
        // Update existing mesh properties
        // Update geometry if dimensions or type changed
        if (mesh.userData.type !== obj.type || JSON.stringify(mesh.userData.dimensions) !== JSON.stringify(obj.dimensions)) {
          scene.remove(mesh);
          mesh = createMeshForObject(obj);
          scene.add(mesh);
          meshesRef.current[obj.id] = mesh;
        } else {
          // Update material if color or material type changed
          if (mesh.userData.color !== obj.color || mesh.userData.materialType !== obj.material) {
            mesh.material.dispose();
            mesh.material = createMaterial(obj.color, obj.material);
            mesh.userData.color = obj.color;
            mesh.userData.materialType = obj.material;
          }
        }
      }

      // Sync transform properties (only when NOT actively simulating to avoid fighting)
      if (!isSimulating && !isExploded && assemblyTimeRef.current < 0) {
        mesh.position.set(obj.position[0], obj.position[1], obj.position[2]);
        mesh.rotation.set(
          THREE.MathUtils.degToRad(obj.rotation[0]),
          THREE.MathUtils.degToRad(obj.rotation[1]),
          THREE.MathUtils.degToRad(obj.rotation[2])
        );
      }
    });

    // Update Gizmo selection
    const selectedMesh = meshesRef.current[selectedId];
    const isAssembling = assemblyTimeRef.current >= 0;
    if (selectedMesh && !isSimulating && !isExploded && !isAssembling) {
      transformControlsRef.current.attach(selectedMesh);
    } else {
      transformControlsRef.current.detach();
    }

  }, [objects, selectedId, isSimulating, isExploded, assemblyTrigger]);

// /* Old shape builder commented out for component visual decorators update
// const createMeshForObject = (obj) => { ... };
// */

// ??$$$ - Advanced Component Visual Mesh Builder
  const createMeshForObject = (obj) => {
    let geometry;
    // ??$$$ - Sanitize dimensions for Three.js geometry initialization to avoid NaN
    const rawDims = obj.dimensions || [1, 1, 1];
    const dims = rawDims.map(d => (typeof d === 'number' && Number.isFinite(d) && d > 0) ? d : 1.0);
    // /* Old unsanitized dimensions assignment commented out
    // const dims = obj.dimensions || [1, 1, 1];
    // */
    const isElec = !!obj.isElectronic;

    switch (obj.type) {
      case 'sphere':
        geometry = new THREE.SphereGeometry(dims[0] || 0.5, 32, 32);
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(dims[0] || 0.5, dims[0] || 0.5, dims[1] || 1, 32);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(dims[0] || 0.5, dims[1] || 1, 32);
        break;
      case 'torus':
        geometry = new THREE.TorusGeometry(dims[0] || 0.8, dims[1] || 0.2, 16, 64);
        break;
      case 'box':
      default:
        geometry = new THREE.BoxGeometry(dims[0] || 1, dims[1] || 1, dims[2] || 1);
        break;
    }

    const material = createMaterial(obj.color, obj.material);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.userData = {
      id: obj.id,
      type: obj.type,
      dimensions: [...dims],
      color: obj.color,
      materialType: obj.material
    };

    // If it is a glowing neon element, add point light
    if (obj.material === 'glowing') {
      const glowLight = new THREE.PointLight(obj.color, 1.5, 6);
      mesh.add(glowLight);
    }

    // Add high-fidelity visual subcomponents if it is an electronic part
    if (isElec) {
      const darkMat = new THREE.MeshStandardMaterial({ color: '#161822', roughness: 0.8 });
      const metalMat = new THREE.MeshStandardMaterial({ color: '#d0d0d8', metalness: 0.9, roughness: 0.1 });
      const goldMat = new THREE.MeshStandardMaterial({ color: '#d4af37', metalness: 0.85, roughness: 0.2 });

      if (obj.id.startsWith('arduino')) {
        // USB Port (silver)
        const usbGeom = new THREE.BoxGeometry(1.5, 0.8, 1.2);
        const usbMesh = new THREE.Mesh(usbGeom, metalMat);
        usbMesh.position.set(-2.5, 0.5, 1.5);
        mesh.add(usbMesh);

        // Power Jack (black)
        const jackGeom = new THREE.BoxGeometry(1.4, 0.9, 1.0);
        const jackMesh = new THREE.Mesh(jackGeom, darkMat);
        jackMesh.position.set(-2.5, 0.5, -1.5);
        mesh.add(jackMesh);

        // Main Microcontroller Chip (black block)
        const chipGeom = new THREE.BoxGeometry(1.4, 0.2, 1.4);
        const chipMesh = new THREE.Mesh(chipGeom, darkMat);
        chipMesh.position.set(1.0, 0.35, -0.6);
        mesh.add(chipMesh);

        // Gold Pins headers
        const pinGeom = new THREE.BoxGeometry(4.5, 0.3, 0.2);
        const pinMesh1 = new THREE.Mesh(pinGeom, goldMat);
        pinMesh1.position.set(0.5, 0.3, 2.3);
        const pinMesh2 = new THREE.Mesh(pinGeom, goldMat);
        pinMesh2.position.set(0.5, 0.3, -2.3);
        mesh.add(pinMesh1, pinMesh2);

      } else if (obj.id.startsWith('esp32')) {
        // ESP32 Metal shield
        const shieldGeom = new THREE.BoxGeometry(1.6, 0.3, 1.6);
        const shieldMesh = new THREE.Mesh(shieldGeom, metalMat);
        shieldMesh.position.set(-0.8, 0.3, 0);
        mesh.add(shieldMesh);

        // PCB Antenna trace (gold lines represented by a thin plate)
        const antGeom = new THREE.BoxGeometry(0.8, 0.05, 2.4);
        const antMesh = new THREE.Mesh(antGeom, goldMat);
        antMesh.position.set(-2.0, 0.22, 0);
        mesh.add(antMesh);

        // Dual row headers
        const pinGeom = new THREE.BoxGeometry(3.5, 0.5, 0.15);
        const pinMesh1 = new THREE.Mesh(pinGeom, darkMat);
        pinMesh1.position.set(0.6, -0.35, 1.2);
        const pinMesh2 = new THREE.Mesh(pinGeom, darkMat);
        pinMesh2.position.set(0.6, -0.35, -1.2);
        mesh.add(pinMesh1, pinMesh2);

      } else if (obj.id.startsWith('fan')) {
        // Center hub cylinder
        const hubGeom = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
        const hubMesh = new THREE.Mesh(hubGeom, metalMat);
        hubMesh.position.set(0, 0.2, 0);
        mesh.add(hubMesh);

        // Propeller Blades (two thin wings extending left and right)
        const bladeGeom = new THREE.BoxGeometry(4.6, 0.05, 0.3);
        const bladeMesh = new THREE.Mesh(bladeGeom, darkMat);
        bladeMesh.position.set(0, 0.2, 0);
        bladeMesh.rotation.y = Math.PI / 6; // pitched slightly
        mesh.add(bladeMesh);

      } else if (obj.id.startsWith('lipo')) {
        // Yellow power leads block
        const wireGeom = new THREE.BoxGeometry(0.8, 0.3, 0.3);
        const leadMesh = new THREE.Mesh(wireGeom, new THREE.MeshStandardMaterial({ color: '#ffaa00' }));
        leadMesh.position.set(-3.2, 0.6, 0);
        mesh.add(leadMesh);

      } else if (obj.id.startsWith('servo')) {
        // White Servo Horn
        const shaftGeom = new THREE.CylinderGeometry(0.3, 0.3, 0.4, 16);
        const shaftMesh = new THREE.Mesh(shaftGeom, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
        shaftMesh.position.set(0.6, 1.2, 0);
        
        const armGeom = new THREE.BoxGeometry(1.6, 0.1, 0.3);
        const armMesh = new THREE.Mesh(armGeom, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
        armMesh.position.set(0, 0.2, 0);
        shaftMesh.add(armMesh);
        
        mesh.add(shaftMesh);
      }
    }

    return mesh;
  };

  // Helper to construct modern Three.js materials
  const createMaterial = (colorHex, materialType) => {
    const color = new THREE.Color(colorHex || '#ffffff');

    switch (materialType) {
      case 'metal':
        return new THREE.MeshStandardMaterial({
          color,
          metalness: 0.9,
          roughness: 0.15,
          envMapIntensity: 1.0
        });
      case 'glass':
        return new THREE.MeshPhysicalMaterial({
          color,
          metalness: 0.1,
          roughness: 0.05,
          transmission: 0.95,
          ior: 1.5,
          thickness: 1.5,
          transparent: true,
          opacity: 0.9
        });
      case 'glowing':
        return new THREE.MeshBasicMaterial({
          color
        });
      case 'toon':
        return new THREE.MeshToonMaterial({
          color
        });
      case 'standard':
      default:
        return new THREE.MeshStandardMaterial({
          color,
          metalness: 0.1,
          roughness: 0.45
        });
    }
  };

  // ??$$$ Show a fallback UI if WebGL failed to initialize
  if (webglError) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0b10',
        color: '#f87171',
        gap: '1rem',
        padding: '2rem',
        textAlign: 'center',
        fontFamily: "'Outfit', sans-serif",
      }}>
        <span style={{ fontSize: '3rem' }}>⚠️</span>
        <p style={{ fontSize: '1rem', fontWeight: 700 }}>3D Engine Unavailable</p>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '360px', lineHeight: 1.5 }}>
          {webglError}
        </p>
        <p style={{ fontSize: '0.75rem', color: '#475569' }}>
          Try enabling Hardware Acceleration in your browser settings, or use Chrome/Edge.
        </p>
      </div>
    );
  }

  return (
    <div className="three-canvas-wrapper" ref={mountRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* ??$$$ Pre-created canvas element — Three.js renderer reuses this instead of appending its own */}
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {isAssembling && (
        <>
          <style>{`
            @keyframes cad-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes cad-pulse {
              from { opacity: 0.7; transform: translateX(-50%) scale(0.98); }
              to { opacity: 1; transform: translateX(-50%) scale(1.02); }
            }
          `}</style>
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(10, 11, 16, 0.85)',
            backdropFilter: 'blur(10px)',
            border: '1px solid var(--accent-primary)',
            borderRadius: '8px',
            padding: '8px 16px',
            color: '#ffffff',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 20px rgba(0, 240, 255, 0.25)',
            zIndex: 10,
            pointerEvents: 'none',
            animation: 'cad-pulse 1.5s infinite alternate ease-in-out'
          }}>
            <span style={{ fontSize: '1.1rem', animation: 'cad-spin 2s linear infinite', display: 'inline-block' }}>⚙️</span>
            <span>🔧 Assembling CAD Enclosure...</span>
          </div>
        </>
      )}
    </div>
  );
}

