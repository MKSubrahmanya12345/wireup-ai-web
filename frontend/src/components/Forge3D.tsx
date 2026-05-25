// @ts-nocheck
// ??$$$ - Forge3D CAD Layout and Simulation Component
import React, { useState, useEffect } from 'react';
import { 
  Play, Pause, RotateCcw, Plus, Trash, Settings, Sparkles, 
  Download, Upload, Info, Key, Check, HelpCircle, 
  Layers, Sliders, Activity, Globe, Compass, Wind
} from 'lucide-react';
import confetti from 'canvas-confetti';
import ThreeViewport from './ThreeViewport';
import { generate3DModel } from '../utils/groq';
import '../styles/forge3d.css';

// Initial scene setup (default demo)
const DEFAULT_OBJECTS = [
  {
    id: 'floor',
    name: 'Floor Grid',
    type: 'box',
    dimensions: [20, 0.5, 20],
    position: [0, -0.25, 0],
    rotation: [0, 0, 0],
    color: '#1a1d2e',
    material: 'metal',
    physics: { isStatic: true, mass: 1, restitution: 0.8, velocity: [0, 0, 0] }
  },
  {
    id: 'glowing-orb',
    name: 'Pulse Orb',
    type: 'sphere',
    dimensions: [0.8],
    position: [0, 6, 0],
    rotation: [0, 0, 0],
    color: '#00f0ff',
    material: 'glowing',
    physics: { isStatic: false, mass: 2, restitution: 0.9, velocity: [0, 0, 0] }
  },
  {
    id: 'metal-cube-1',
    name: 'Steel Anchor',
    type: 'box',
    dimensions: [1.5, 1.5, 1.5],
    position: [-2, 0.75, -2],
    rotation: [0, 45, 0],
    color: '#ff007f',
    material: 'metal',
    physics: { isStatic: false, mass: 4, restitution: 0.5, velocity: [0, 0, 0] }
  },
  {
    id: 'glass-pillar',
    name: 'Prism Tower',
    type: 'cylinder',
    dimensions: [0.6, 3],
    position: [3, 1.5, 2],
    rotation: [0, 0, 0],
    color: '#7000ff',
    material: 'glass',
    physics: { isStatic: false, mass: 3, restitution: 0.4, velocity: [0, 0, 0] }
  }
];

const LOCAL_TEMPLATES = {
  marble_slide: {
    name: 'Marble Slide Roll',
    objects: [
      { id: 'floor', name: 'Floor Grid', type: 'box', dimensions: [25, 0.5, 25], position: [0, -0.25, 0], rotation: [0, 0, 0], color: '#161722', material: 'standard', physics: { isStatic: true, mass: 1, restitution: 0.5, velocity: [0, 0, 0] } },
      { id: 'ramp', name: 'Launcher Slide', type: 'box', dimensions: [14, 0.4, 3], position: [-2, 4.5, 0], rotation: [0, 0, -22], color: '#7000ff', material: 'metal', physics: { isStatic: true, mass: 1, restitution: 0.6, velocity: [0, 0, 0] } },
      { id: 'marble1', name: 'Neon Marble X', type: 'sphere', dimensions: [0.6], position: [-7, 8.5, 0.3], rotation: [0, 0, 0], color: '#00f0ff', material: 'glowing', physics: { isStatic: false, mass: 1, restitution: 0.8, velocity: [2, 0, 0] } },
      { id: 'marble2', name: 'Ruby Core Y', type: 'sphere', dimensions: [0.8], position: [-8, 9, -0.5], rotation: [0, 0, 0], color: '#ff007f', material: 'glass', physics: { isStatic: false, mass: 1.8, restitution: 0.7, velocity: [1, 0, 0] } },
      { id: 'target1', name: 'Pins A', type: 'box', dimensions: [1, 2, 1], position: [4, 1, 0], rotation: [0, 0, 0], color: '#ffcc00', material: 'standard', physics: { isStatic: false, mass: 0.5, restitution: 0.3, velocity: [0, 0, 0] } },
      { id: 'target2', name: 'Pins B', type: 'box', dimensions: [1, 2, 1], position: [5.5, 1, -1.2], rotation: [0, 0, 0], color: '#ffcc00', material: 'standard', physics: { isStatic: false, mass: 0.5, restitution: 0.3, velocity: [0, 0, 0] } },
      { id: 'target3', name: 'Pins C', type: 'box', dimensions: [1, 2, 1], position: [5.5, 1, 1.2], rotation: [0, 0, 0], color: '#ffcc00', material: 'standard', physics: { isStatic: false, mass: 0.5, restitution: 0.3, velocity: [0, 0, 0] } }
    ]
  },
  pyramid_stack: {
    name: 'Block Destruction',
    objects: [
      { id: 'floor', name: 'Floor Grid', type: 'box', dimensions: [20, 0.5, 20], position: [0, -0.25, 0], rotation: [0, 0, 0], color: '#10121a', material: 'standard', physics: { isStatic: true, mass: 1, restitution: 0.4, velocity: [0, 0, 0] } },
      { id: 'b1', name: 'Base block 1', type: 'box', dimensions: [1.2, 1.2, 1.2], position: [-1.5, 0.6, 0], rotation: [0, 0, 0], color: '#00f0ff', material: 'standard', physics: { isStatic: false, mass: 1.5, restitution: 0.2, velocity: [0, 0, 0] } },
      { id: 'b2', name: 'Base block 2', type: 'box', dimensions: [1.2, 1.2, 1.2], position: [0, 0.6, 0], rotation: [0, 0, 0], color: '#00f0ff', material: 'standard', physics: { isStatic: false, mass: 1.5, restitution: 0.2, velocity: [0, 0, 0] } },
      { id: 'b3', name: 'Base block 3', type: 'box', dimensions: [1.2, 1.2, 1.2], position: [1.5, 0.6, 0], rotation: [0, 0, 0], color: '#00f0ff', material: 'standard', physics: { isStatic: false, mass: 1.5, restitution: 0.2, velocity: [0, 0, 0] } },
      { id: 'b4', name: 'Mid block 1', type: 'box', dimensions: [1.2, 1.2, 1.2], position: [-0.75, 1.8, 0], rotation: [0, 0, 0], color: '#7000ff', material: 'standard', physics: { isStatic: false, mass: 1.5, restitution: 0.2, velocity: [0, 0, 0] } },
      { id: 'b5', name: 'Mid block 2', type: 'box', dimensions: [1.2, 1.2, 1.2], position: [0.75, 1.8, 0], rotation: [0, 0, 0], color: '#7000ff', material: 'standard', physics: { isStatic: false, mass: 1.5, restitution: 0.2, velocity: [0, 0, 0] } },
      { id: 'b6', name: 'Apex block', type: 'box', dimensions: [1.2, 1.2, 1.2], position: [0, 3.0, 0], rotation: [0, 0, 0], color: '#ff007f', material: 'standard', physics: { isStatic: false, mass: 1.5, restitution: 0.2, velocity: [0, 0, 0] } },
      { id: 'striker', name: 'Heavy Striker', type: 'sphere', dimensions: [1.0], position: [0, 8, 8], rotation: [0, 0, 0], color: '#ffffff', material: 'metal', physics: { isStatic: false, mass: 12, restitution: 0.8, velocity: [0, -3, -12] } }
    ]
  },
  newtons_cradle: {
    name: 'Newton Cradle Swing',
    objects: [
      { id: 'floor', name: 'Floor Grid', type: 'box', dimensions: [20, 0.5, 20], position: [0, -0.25, 0], rotation: [0, 0, 0], color: '#161722', material: 'standard', physics: { isStatic: true, mass: 1, restitution: 0.7, velocity: [0, 0, 0] } },
      { id: 'beam', name: 'Cradle Beam', type: 'box', dimensions: [10, 0.3, 0.3], position: [0, 6, 0], rotation: [0, 0, 0], color: '#888888', material: 'metal', physics: { isStatic: true, mass: 1, restitution: 0.8, velocity: [0, 0, 0] } },
      { id: 'c1', name: 'Cradle Orb A', type: 'sphere', dimensions: [0.5], position: [-1.5, 2.5, 0], rotation: [0, 0, 0], color: '#00f0ff', material: 'metal', physics: { isStatic: false, mass: 2, restitution: 0.99, velocity: [0, 0, 0] } },
      { id: 'c2', name: 'Cradle Orb B', type: 'sphere', dimensions: [0.5], position: [-0.5, 2.5, 0], rotation: [0, 0, 0], color: '#ffffff', material: 'metal', physics: { isStatic: false, mass: 2, restitution: 0.99, velocity: [0, 0, 0] } },
      { id: 'c3', name: 'Cradle Orb C', type: 'sphere', dimensions: [0.5], position: [0.5, 2.5, 0], rotation: [0, 0, 0], color: '#ffffff', material: 'metal', physics: { isStatic: false, mass: 2, restitution: 0.99, velocity: [0, 0, 0] } },
      { id: 'c4', name: 'Striker Orb', type: 'sphere', dimensions: [0.5], position: [3.5, 4.5, 0], rotation: [0, 0, 0], color: '#ff007f', material: 'metal', physics: { isStatic: false, mass: 2, restitution: 0.99, velocity: [-5, -2, 0] } }
    ]
  }
};

const ELECTRONIC_COMPONENTS = {
  arduino: {
    name: 'Arduino Uno',
    type: 'box',
    dimensions: [6.8, 0.5, 5.3],
    color: '#008c8c',
    material: 'standard',
    icon: '🔌'
  },
  esp32: {
    name: 'ESP32 NodeMCU',
    type: 'box',
    dimensions: [5.0, 0.4, 2.8],
    color: '#20222a',
    material: 'metal',
    icon: '📶'
  },
  fan: {
    name: 'Drone Propeller',
    type: 'cylinder',
    dimensions: [2.5, 0.2],
    color: '#404045',
    material: 'metal',
    icon: '🚁'
  },
  lipo: {
    name: 'LiPo Battery (3S)',
    type: 'box',
    dimensions: [7.0, 2.0, 3.5],
    color: '#cc1111',
    material: 'standard',
    icon: '🔋'
  },
  servo: {
    name: 'Servo SG90',
    type: 'box',
    dimensions: [2.3, 2.2, 1.2],
    color: '#0066cc',
    material: 'standard',
    icon: '⚙️'
  }
};

export default function Forge3D({ bom = [] }) {
  const [groqApiKey, setGroqApiKey] = useState(() => localStorage.getItem('groq_api_key') || '');
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('objects');

  const [objects, setObjects] = useState(DEFAULT_OBJECTS);
  const [initialObjects, setInitialObjects] = useState(JSON.parse(JSON.stringify(DEFAULT_OBJECTS)));
  const [selectedId, setSelectedId] = useState(null);

  const [isSimulating, setIsSimulating] = useState(false);
  const [physicsConfig, setPhysicsConfig] = useState({
    gravity: -9.81,
    airResistance: 0.05,
    wind: [0, 0, 0]
  });

  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState(null);

  const [isExploded, setIsExploded] = useState(false);
  const [assemblyTrigger, setAssemblyTrigger] = useState(0);

  // Auto-populate 3D scene from active project BOM when loaded
  useEffect(() => {
    if (bom && bom.length > 0) {
      const parsedObjects = [
        {
          id: 'floor',
          name: 'Floor Grid',
          type: 'box',
          dimensions: [25, 0.5, 25],
          position: [0, -0.25, 0],
          rotation: [0, 0, 0],
          color: '#12131a',
          material: 'standard',
          physics: { isStatic: true, mass: 1, restitution: 0.5, velocity: [0, 0, 0] }
        }
      ];

      bom.forEach((item, index) => {
        const nameLower = (item.displayName || item.key || '').toLowerCase();
        let template = null;
        let templateKey = '';

        if (nameLower.includes('arduino')) {
          template = ELECTRONIC_COMPONENTS.arduino;
          templateKey = 'arduino';
        } else if (nameLower.includes('esp32') || nameLower.includes('nodemcu')) {
          template = ELECTRONIC_COMPONENTS.esp32;
          templateKey = 'esp32';
        } else if (nameLower.includes('servo') || nameLower.includes('motor')) {
          template = ELECTRONIC_COMPONENTS.servo;
          templateKey = 'servo';
        } else if (nameLower.includes('battery') || nameLower.includes('lipo') || nameLower.includes('power')) {
          template = ELECTRONIC_COMPONENTS.lipo;
          templateKey = 'lipo';
        } else if (nameLower.includes('led') || nameLower.includes('propeller') || nameLower.includes('fan')) {
          template = ELECTRONIC_COMPONENTS.fan;
          templateKey = 'fan';
        }

        if (template) {
          parsedObjects.push({
            id: `${templateKey}_${Date.now()}_${index}`,
            name: item.displayName || template.name,
            type: template.type,
            dimensions: [...template.dimensions],
            position: [index * 2 - (bom.length - 1), 1.5, 0],
            rotation: [0, 0, 0],
            color: template.color,
            material: template.material,
            isElectronic: true,
            physics: {
              isStatic: false,
              mass: 0.5,
              restitution: 0.3,
              velocity: [0, 0, 0]
            }
          });
        } else {
          // generic fallback component
          parsedObjects.push({
            id: `part_${Date.now()}_${index}`,
            name: item.displayName || 'BOM Part',
            type: 'box',
            dimensions: [2, 1, 2],
            position: [index * 2 - (bom.length - 1), 1.5, 0],
            rotation: [0, 0, 0],
            color: '#a3a3a3',
            material: 'standard',
            isElectronic: true,
            physics: {
              isStatic: false,
              mass: 0.4,
              restitution: 0.2,
              velocity: [0, 0, 0]
            }
          });
        }
      });

      setObjects(parsedObjects);
      setInitialObjects(JSON.parse(JSON.stringify(parsedObjects)));
    }
  }, [bom]);

  const loadTemplate = (key) => {
    const template = LOCAL_TEMPLATES[key];
    if (template) {
      const cloned = JSON.parse(JSON.stringify(template.objects));
      setObjects(cloned);
      setInitialObjects(JSON.parse(JSON.stringify(cloned)));
      setSelectedId(null);
      setIsSimulating(false);
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.8 }
      });
    }
  };

  const toggleSimulation = () => {
    if (!isSimulating) {
      setInitialObjects(JSON.parse(JSON.stringify(objects)));
    }
    setIsSimulating(!isSimulating);
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setObjects(JSON.parse(JSON.stringify(initialObjects)));
  };

  const handleAddNewShape = (type) => {
    const id = `${type}_${Date.now().toString().slice(-4)}`;
    let dimensions = [1, 1, 1];
    let color = '#00f0ff';
    let material = 'standard';
    
    if (type === 'sphere') {
      dimensions = [0.8];
      color = '#ff007f';
    } else if (type === 'cylinder' || type === 'cone') {
      dimensions = [0.6, 2];
      color = '#7000ff';
    } else if (type === 'torus') {
      dimensions = [0.8, 0.2];
      color = '#ffcc00';
    }

    const newObj = {
      id,
      name: `${type.charAt(0).toUpperCase() + type.slice(1)} ${objects.length}`,
      type,
      dimensions,
      position: [0, 5, 0],
      rotation: [0, 0, 0],
      color,
      material,
      physics: {
        isStatic: false,
        mass: 1.0,
        restitution: 0.6,
        velocity: [0, 0, 0]
      }
    };

    const newObjList = [...objects, newObj];
    setObjects(newObjList);
    setInitialObjects(JSON.parse(JSON.stringify(newObjList)));
    setSelectedId(id);
  };

  const handleAddNewComponent = (partKey) => {
    const template = ELECTRONIC_COMPONENTS[partKey];
    if (!template) return;
    
    const id = `${partKey}_${Date.now().toString().slice(-4)}`;
    const newObj = {
      id,
      name: `${template.name} ${objects.filter(o => o.id.startsWith(partKey)).length + 1}`,
      type: template.type,
      dimensions: [...template.dimensions],
      position: [0, 4, 0],
      rotation: [0, 0, 0],
      color: template.color,
      material: template.material,
      isElectronic: true,
      physics: {
        isStatic: false,
        mass: 0.5,
        restitution: 0.3,
        velocity: [0, 0, 0]
      }
    };

    const newList = [...objects, newObj];
    setObjects(newList);
    setInitialObjects(JSON.parse(JSON.stringify(newList)));
    setSelectedId(id);
  };

  const handleDeleteObject = (id) => {
    if (id === 'floor') return;
    const filtered = objects.filter(o => o.id !== id);
    setObjects(filtered);
    setInitialObjects(JSON.parse(JSON.stringify(filtered)));
    if (selectedId === id) setSelectedId(null);
  };

  const handleClearScene = () => {
    const floor = objects.find(o => o.id === 'floor');
    const baseList = floor ? [floor] : [];
    setObjects(baseList);
    setInitialObjects(JSON.parse(JSON.stringify(baseList)));
    setSelectedId(null);
    setIsSimulating(false);
  };

  const handleDuplicateObject = (obj) => {
    if (obj.id === 'floor') return;
    const duplicated = {
      ...JSON.parse(JSON.stringify(obj)),
      id: `${obj.type}_${Date.now().toString().slice(-4)}`,
      name: `${obj.name} (Copy)`,
      position: [obj.position[0] + 1.5, obj.position[1] + 1.0, obj.position[2]]
    };
    const newList = [...objects, duplicated];
    setObjects(newList);
    setInitialObjects(JSON.parse(JSON.stringify(newList)));
    setSelectedId(duplicated.id);
  };

  const handleUpdateObjectProperty = (id, path, value) => {
    const updated = objects.map((obj) => {
      if (obj.id === id) {
        const copy = { ...obj };
        if (path.startsWith('physics.')) {
          const key = path.split('.')[1];
          copy.physics = { ...copy.physics, [key]: value };
        } else if (path.startsWith('dimensions[')) {
          const index = parseInt(path.match(/\[(\d+)\]/)[1]);
          const newDims = [...copy.dimensions];
          newDims[index] = parseFloat(value) || 0;
          copy.dimensions = newDims;
        } else if (path.startsWith('position[')) {
          const index = parseInt(path.match(/\[(\d+)\]/)[1]);
          const newPos = [...copy.position];
          newPos[index] = parseFloat(value) || 0;
          copy.position = newPos;
        } else if (path.startsWith('rotation[')) {
          const index = parseInt(path.match(/\[(\d+)\]/)[1]);
          const newRot = [...copy.rotation];
          newRot[index] = parseFloat(value) || 0;
          copy.rotation = newRot;
        } else {
          copy[path] = value;
        }
        return copy;
      }
      return obj;
    });

    setObjects(updated);
    if (!isSimulating) {
      setInitialObjects(JSON.parse(JSON.stringify(updated)));
    }
  };

  const handleGenerateAIScene = async (e) => {
    if (e) e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setGenError(null);

    try {
      const result = await generate3DModel(prompt.trim(), groqApiKey, selectedModel, objects);
      
      if (result && Array.isArray(result.objects)) {
        let finalObjects = result.objects;
        const hasFloor = finalObjects.some(o => o.id === 'floor' || o.type === 'box' && o.dimensions[0] >= 15 && o.position[1] < 0.5);
        if (!hasFloor) {
          const floor = DEFAULT_OBJECTS.find(o => o.id === 'floor');
          finalObjects = [floor, ...finalObjects];
        }

        finalObjects = finalObjects.map(obj => {
          return {
            ...obj,
            id: obj.id || `${obj.type}_${Math.random().toString(36).substr(2, 4)}`,
            name: obj.name || `${obj.type} generated`,
            position: Array.isArray(obj.position) ? obj.position.map(Number) : [0, 2, 0],
            rotation: Array.isArray(obj.rotation) ? obj.rotation.map(Number) : [0, 0, 0],
            dimensions: Array.isArray(obj.dimensions) ? obj.dimensions.map(Number) : [1, 1, 1],
            isElectronic: !!obj.isElectronic,
            physics: {
              isStatic: obj.physics?.isStatic ?? false,
              mass: Number(obj.physics?.mass ?? 1),
              restitution: Number(obj.physics?.restitution ?? 0.6),
              velocity: Array.isArray(obj.physics?.velocity) ? obj.physics.velocity.map(Number) : [0, 0, 0]
            }
          };
        });

        setObjects(finalObjects);
        setInitialObjects(JSON.parse(JSON.stringify(finalObjects)));
        setSelectedId(null);
        setIsSimulating(false);
        setPrompt('');

        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 }
        });
      } else {
        throw new Error("Invalid scene format received from Groq AI.");
      }
    } catch (err) {
      console.error(err);
      setGenError(err.message || 'Generation failed. Check your API key or server status.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveSettings = (apiKey, model) => {
    localStorage.setItem('groq_api_key', apiKey);
    setGroqApiKey(apiKey);
    setSelectedModel(model);
    setIsSettingsOpen(false);
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ name: "Forge3D Scene", objects, physicsConfig }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href",     dataStr);
    downloadAnchor.setAttribute("download", `forge3d_scene_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleImportJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        if (parsed && Array.isArray(parsed.objects)) {
          setObjects(parsed.objects);
          setInitialObjects(JSON.parse(JSON.stringify(parsed.objects)));
          if (parsed.physicsConfig) setPhysicsConfig(parsed.physicsConfig);
          setSelectedId(null);
          setIsSimulating(false);
        }
      } catch (err) {
        alert("Failed to parse JSON file: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  const selectedObject = objects.find(o => o.id === selectedId);

  return (
    <div className="forge-container">
      <div className="workspace">
        {/* LEFT SIDEBAR */}
        <aside className="sidebar glass">
          <div className="sidebar-header">
            <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
              <Layers size={14} /> Explorer
            </div>
            <button className="btn" style={{padding: '3px 6px', fontSize: '0.7rem'}} onClick={handleClearScene}>
              Clear
            </button>
          </div>

          <div className="sidebar-content" style={{gap: '10px'}}>
            {/* Electronic Parts */}
            <div className="inspector-section">
              <div className="inspector-title">
                🤖 Electronic Parts
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px'}}>
                {Object.entries(ELECTRONIC_COMPONENTS).map(([key, part]) => (
                  <button 
                    key={key} 
                    className="btn" 
                    style={{justifyContent: 'flex-start', fontSize: '0.75rem', padding: '4px 8px'}} 
                    onClick={() => handleAddNewComponent(key)}
                  >
                    <span style={{marginRight: '6px', fontSize: '0.85rem'}}>{part.icon}</span>
                    <span style={{fontWeight: 500}}>{part.name}</span>
                    <span style={{marginLeft: 'auto', color: 'var(--accent-primary)', fontSize: '0.65rem'}}>+ Add</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Shape Adder */}
            <div className="inspector-section">
              <div className="inspector-title">
                <Plus size={12} /> Add Shape
              </div>
              <div style={{display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px'}}>
                <button className="btn" style={{padding: '4px 6px', fontSize: '0.75rem'}} onClick={() => handleAddNewShape('box')}>+ Box</button>
                <button className="btn" style={{padding: '4px 6px', fontSize: '0.75rem'}} onClick={() => handleAddNewShape('sphere')}>+ Sphere</button>
                <button className="btn" style={{padding: '4px 6px', fontSize: '0.75rem'}} onClick={() => handleAddNewShape('cylinder')}>+ Cylinder</button>
                <button className="btn" style={{padding: '4px 6px', fontSize: '0.75rem'}} onClick={() => handleAddNewShape('cone')}>+ Cone</button>
                <button className="btn" style={{padding: '4px 6px', fontSize: '0.75rem', gridColumn: 'span 2'}} onClick={() => handleAddNewShape('torus')}>+ Torus</button>
              </div>
            </div>

            {/* Objects Tree */}
            <div className="inspector-section" style={{flex: 1, overflowY: 'auto'}}>
              <div className="inspector-title" style={{marginBottom: '4px'}}>
                <Globe size={12} /> Scene List
              </div>
              <div className="tree-list">
                {objects.map((obj) => {
                  const isElec = obj.isElectronic;
                  let icon = obj.type === 'sphere' ? '⚽' : obj.type === 'box' ? '📦' : '🌀';
                  if (isElec) {
                    if (obj.id.startsWith('arduino')) icon = '🔌';
                    else if (obj.id.startsWith('esp32')) icon = '📶';
                    else if (obj.id.startsWith('fan')) icon = '🚁';
                    else if (obj.id.startsWith('lipo')) icon = '🔋';
                    else if (obj.id.startsWith('servo')) icon = '⚙️';
                    else icon = '🤖';
                  }

                  return (
                    <div 
                      key={obj.id} 
                      className={`tree-item ${selectedId === obj.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(obj.id)}
                    >
                      <span className="tree-item-name" style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                        <span>{icon} {obj.name}</span>
                        {isElec && (
                          <span style={{
                            fontSize: '0.55rem', 
                            padding: '1px 3px', 
                            borderRadius: '3px', 
                            background: 'rgba(0, 240, 255, 0.15)', 
                            color: 'var(--accent-primary)',
                            fontWeight: 700,
                            marginLeft: '4px'
                          }}>
                            PART
                          </span>
                        )}
                      </span>
                      <div className="tree-item-actions">
                        <button className="btn" style={{padding: '1px 4px', fontSize: '0.7rem'}} onClick={(e) => { e.stopPropagation(); handleDuplicateObject(obj); }} title="Duplicate">
                          📑
                        </button>
                        {obj.id !== 'floor' && (
                          <button className="btn" style={{padding: '1px 4px', fontSize: '0.7rem', color: 'var(--accent-secondary)'}} onClick={(e) => { e.stopPropagation(); handleDeleteObject(obj.id); }} title="Delete">
                            <Trash size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* 3D VIEWPORT CONTAINER */}
        <main className="viewport-container" style={{position: 'relative'}}>
          {/* SIMULATOR HUD */}
          <div className="viewport-hud glass" style={{gap: '6px'}}>
            <button 
              className={`btn ${isSimulating ? 'btn-active' : 'btn-primary'}`} 
              onClick={toggleSimulation}
              disabled={isExploded || assemblyTrigger > 0}
            >
              {isSimulating ? <Pause size={14} /> : <Play size={14} />}
              {isSimulating ? 'Pause' : 'Simulate'}
            </button>

            <button 
              className="btn glass-interactive" 
              onClick={resetSimulation}
              disabled={isExploded || assemblyTrigger > 0}
            >
              <RotateCcw size={14} />
              Reset
            </button>

            <button 
              className={`btn ${isExploded ? 'btn-active' : 'glass-interactive'}`}
              onClick={() => {
                if (isSimulating) setIsSimulating(false);
                setIsExploded(!isExploded);
              }}
            >
              💥 {isExploded ? 'Collapse' : 'Explode'}
            </button>

            <button 
              className="btn glass-interactive"
              onClick={() => {
                if (isSimulating) setIsSimulating(false);
                setIsExploded(false);
                setAssemblyTrigger(prev => prev + 1);
              }}
            >
              🔧 Assembly
            </button>
          </div>

          {/* Canvas Render Viewport */}
          <ThreeViewport 
            objects={objects} 
            setObjects={setObjects}
            selectedId={selectedId} 
            setSelectedId={setSelectedId}
            isSimulating={isSimulating}
            setIsSimulating={setIsSimulating}
            physicsConfig={physicsConfig}
            isExploded={isExploded}
            assemblyTrigger={assemblyTrigger}
          />

          {/* HUD INFO PANEL */}
          <div className="viewport-info glass">
            <div style={{fontWeight: 700, color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '6px'}}>
              <Activity size={12} /> Sandbox HUD
            </div>
            <div>Gravity: {physicsConfig.gravity} m/s²</div>
            <div>Static Parts: {objects.filter(o => o.physics?.isStatic).length}</div>
            <div>Dynamic Parts: {objects.filter(o => !o.physics?.isStatic).length}</div>
          </div>

          {/* AI PANEL IN HUD */}
          <div className="prompt-panel glass">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <span style={{fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px'}}>
                <Sparkles size={12} className="text-primary" /> Ask AI to arrange parts & design casing:
              </span>
              <span style={{fontSize: '0.72rem', color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => setIsSettingsOpen(true)}>
                ⚙️ Config Groq API
              </span>
            </div>

            <form onSubmit={handleGenerateAIScene} className="prompt-input-row">
              <input
                type="text"
                className="prompt-input"
                placeholder={groqApiKey ? "e.g., 'Arrange side-by-side with a protective casing' or 'Drone quadcopter frame'" : "Input Groq API Key to query or use local buttons below..."}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isGenerating}
              />
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={isGenerating || !prompt.trim()}
              >
                {isGenerating ? <div className="spinner" style={{width: 12, height: 12}} /> : <Sparkles size={14} />}
                Generate
              </button>
            </form>

            {genError && (
              <div style={{color: 'var(--accent-secondary)', fontSize: '0.75rem', marginTop: '2px'}}>
                ⚠️ {genError}
              </div>
            )}

            <div className="quick-tags" style={{marginTop: '2px'}}>
              <span className="tag" onClick={() => loadTemplate('marble_slide')}>🌀 Marble Slide</span>
              <span className="tag" onClick={() => loadTemplate('pyramid_stack')}>🧱 Pyramid Stack</span>
              <span className="tag" onClick={() => loadTemplate('newtons_cradle')}>🎯 Newton Cradle</span>
              <button className="tag" style={{border: 'none', background: 'none'}} onClick={handleExportJSON}>📥 Export Scene</button>
              <label className="tag" style={{cursor: 'pointer'}}>
                📤 Import Scene
                <input type="file" accept=".json" onChange={handleImportJSON} style={{display: 'none'}} />
              </label>
            </div>
          </div>
        </main>

        {/* RIGHT INSPECTOR */}
        <aside className="sidebar right glass">
          <div className="sidebar-header">
            <span style={{display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)'}}>
              <Sliders size={14} /> Inspector
            </span>
            <div className="quick-tags">
              <span className={`tag ${activeTab === 'objects' ? 'tag-active btn-active' : ''}`} onClick={() => setActiveTab('objects')}>Part</span>
              <span className={`tag ${activeTab === 'physics' ? 'tag-active btn-active' : ''}`} onClick={() => setActiveTab('physics')}>World</span>
            </div>
          </div>

          <div className="sidebar-content">
            {activeTab === 'objects' && (
              <>
                {selectedObject ? (
                  <>
                    <div className="inspector-section">
                      <div className="inspector-title">📝 General</div>
                      <div className="form-group">
                        <label>Name</label>
                        <input 
                          type="text" 
                          className="form-control"
                          value={selectedObject.name} 
                          onChange={(e) => handleUpdateObjectProperty(selectedId, 'name', e.target.value)}
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>Shape</label>
                          <select 
                            className="form-control"
                            value={selectedObject.type}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'type', e.target.value)}
                          >
                            <option value="box">Box</option>
                            <option value="sphere">Sphere</option>
                            <option value="cylinder">Cylinder</option>
                            <option value="cone">Cone</option>
                            <option value="torus">Torus</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Material</label>
                          <select 
                            className="form-control"
                            value={selectedObject.material}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'material', e.target.value)}
                          >
                            <option value="standard">Standard</option>
                            <option value="metal">Metal</option>
                            <option value="glass">Glass</option>
                            <option value="glowing">Neon Glowing</option>
                            <option value="toon">Toon</option>
                          </select>
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Color</label>
                        <div style={{display: 'flex', gap: '6px'}}>
                          <input 
                            type="color" 
                            className="form-control"
                            style={{width: '32px', height: '30px', padding: '2px', cursor: 'pointer'}}
                            value={selectedObject.color} 
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'color', e.target.value)}
                          />
                          <input 
                            type="text" 
                            className="form-control"
                            style={{flex: 1}}
                            value={selectedObject.color} 
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'color', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="inspector-section">
                      <div className="inspector-title">📐 Dimensions</div>
                      {selectedObject.isElectronic ? (
                        <div style={{fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px 0', borderLeft: '2px solid var(--accent-primary)', paddingLeft: '6px'}}>
                          ℹ️ Dimensions are locked for standard electronic component.
                        </div>
                      ) : (
                        <>
                          {selectedObject.type === 'box' && (
                            <div className="form-row-three">
                              <div className="form-group">
                                <label>Width</label>
                                <input 
                                  type="number" step="0.1" className="form-control"
                                  value={selectedObject.dimensions[0] || 0}
                                  onChange={(e) => handleUpdateObjectProperty(selectedId, 'dimensions[0]', e.target.value)}
                                />
                              </div>
                              <div className="form-group">
                                <label>Height</label>
                                <input 
                                  type="number" step="0.1" className="form-control"
                                  value={selectedObject.dimensions[1] || 0}
                                  onChange={(e) => handleUpdateObjectProperty(selectedId, 'dimensions[1]', e.target.value)}
                                />
                              </div>
                              <div className="form-group">
                                <label>Depth</label>
                                <input 
                                  type="number" step="0.1" className="form-control"
                                  value={selectedObject.dimensions[2] || 0}
                                  onChange={(e) => handleUpdateObjectProperty(selectedId, 'dimensions[2]', e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                          {selectedObject.type === 'sphere' && (
                            <div className="form-group">
                              <label>Radius</label>
                              <input 
                                type="number" step="0.1" className="form-control"
                                value={selectedObject.dimensions[0] || 0}
                                  onChange={(e) => handleUpdateObjectProperty(selectedId, 'dimensions[0]', e.target.value)}
                              />
                            </div>
                          )}
                          {(selectedObject.type === 'cylinder' || selectedObject.type === 'cone' || selectedObject.type === 'torus') && (
                            <div className="form-row">
                              <div className="form-group">
                                <label>Radius</label>
                                <input 
                                  type="number" step="0.1" className="form-control"
                                  value={selectedObject.dimensions[0] || 0}
                                  onChange={(e) => handleUpdateObjectProperty(selectedId, 'dimensions[0]', e.target.value)}
                                />
                              </div>
                              <div className="form-group">
                                <label>{selectedObject.type === 'torus' ? 'Tube Rad' : 'Height'}</label>
                                <input 
                                  type="number" step="0.1" className="form-control"
                                  value={selectedObject.dimensions[1] || 0}
                                  onChange={(e) => handleUpdateObjectProperty(selectedId, 'dimensions[1]', e.target.value)}
                                />
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    <div className="inspector-section">
                      <div className="inspector-title">📍 Transform</div>
                      <div className="form-group">
                        <label>Position (X, Y, Z)</label>
                        <div className="form-row-three">
                          <input 
                            type="number" step="0.1" className="form-control"
                            value={selectedObject.position[0].toFixed(2)}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'position[0]', e.target.value)}
                          />
                          <input 
                            type="number" step="0.1" className="form-control"
                            value={selectedObject.position[1].toFixed(2)}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'position[1]', e.target.value)}
                          />
                          <input 
                            type="number" step="0.1" className="form-control"
                            value={selectedObject.position[2].toFixed(2)}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'position[2]', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-group">
                        <label>Rotation (X, Y, Z deg)</label>
                        <div className="form-row-three">
                          <input 
                            type="number" step="1" className="form-control"
                            value={Math.round(selectedObject.rotation[0])}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'rotation[0]', e.target.value)}
                          />
                          <input 
                            type="number" step="1" className="form-control"
                            value={Math.round(selectedObject.rotation[1])}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'rotation[1]', e.target.value)}
                          />
                          <input 
                            type="number" step="1" className="form-control"
                            value={Math.round(selectedObject.rotation[2])}
                            onChange={(e) => handleUpdateObjectProperty(selectedId, 'rotation[2]', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="inspector-section">
                      <div className="inspector-title">⚡ Physics</div>
                      <div className="form-group" style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <label style={{cursor: 'pointer'}} htmlFor="static-check-component">Anchor (Static)</label>
                        <input 
                          id="static-check-component"
                          type="checkbox" 
                          style={{width: '16px', height: '16px'}}
                          checked={!!selectedObject.physics?.isStatic} 
                          onChange={(e) => handleUpdateObjectProperty(selectedId, 'physics.isStatic', e.target.checked)}
                        />
                      </div>
                      {!selectedObject.physics?.isStatic && (
                        <>
                          <div className="form-row">
                            <div className="form-group">
                              <label>Mass (kg)</label>
                              <input 
                                type="number" step="0.1" min="0.1" className="form-control"
                                value={selectedObject.physics?.mass ?? 1.0}
                                onChange={(e) => handleUpdateObjectProperty(selectedId, 'physics.mass', parseFloat(e.target.value) || 1.0)}
                              />
                            </div>
                            <div className="form-group">
                              <label>Bounciness</label>
                              <input 
                                type="range" min="0" max="1" step="0.05" className="form-control"
                                style={{padding: '0'}}
                                value={selectedObject.physics?.restitution ?? 0.6}
                                onChange={(e) => handleUpdateObjectProperty(selectedId, 'physics.restitution', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <div style={{textAlign: 'center', color: 'var(--text-muted)', padding: '30px 10px', fontSize: '0.8rem'}}>
                    <Compass size={24} style={{margin: '0 auto 8px', opacity: 0.5}} />
                    Select a part from the list or view to edit its properties.
                  </div>
                )}
              </>
            )}

            {activeTab === 'physics' && (
              <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
                <div className="inspector-section">
                  <div className="inspector-title"><Globe size={12} /> Environmental Force</div>
                  <div className="form-group">
                    <label>Gravity</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <input 
                        type="range" min="-25" max="0" step="0.1" className="form-control"
                        style={{flex: 1, padding: 0}}
                        value={physicsConfig.gravity}
                        onChange={(e) => setPhysicsConfig({...physicsConfig, gravity: parseFloat(e.target.value)})}
                      />
                      <span style={{fontFamily: 'var(--font-mono)', fontSize: '0.8rem', width: '40px'}}>{physicsConfig.gravity}</span>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Air Resistance</label>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <input 
                        type="range" min="0" max="0.5" step="0.01" className="form-control"
                        style={{flex: 1, padding: 0}}
                        value={physicsConfig.airResistance}
                        onChange={(e) => setPhysicsConfig({...physicsConfig, airResistance: parseFloat(e.target.value)})}
                      />
                      <span style={{fontFamily: 'var(--font-mono)', fontSize: '0.8rem', width: '40px'}}>{physicsConfig.airResistance}</span>
                    </div>
                  </div>
                </div>

                <div className="inspector-section">
                  <div className="inspector-title"><Wind size={12} /> Wind Settings</div>
                  <div className="form-group">
                    <label>Wind Velocity (X, Y, Z)</label>
                    <div className="form-row-three">
                      <input 
                        type="number" step="0.5" className="form-control"
                        value={physicsConfig.wind?.[0] ?? 0}
                        onChange={(e) => {
                          const newWind = [...(physicsConfig.wind || [0,0,0])];
                          newWind[0] = parseFloat(e.target.value) || 0;
                          setPhysicsConfig({ ...physicsConfig, wind: newWind });
                        }}
                      />
                      <input 
                        type="number" step="0.5" className="form-control"
                        value={physicsConfig.wind?.[1] ?? 0}
                        onChange={(e) => {
                          const newWind = [...(physicsConfig.wind || [0,0,0])];
                          newWind[1] = parseFloat(e.target.value) || 0;
                          setPhysicsConfig({ ...physicsConfig, wind: newWind });
                        }}
                      />
                      <input 
                        type="number" step="0.5" className="form-control"
                        value={physicsConfig.wind?.[2] ?? 0}
                        onChange={(e) => {
                          const newWind = [...(physicsConfig.wind || [0,0,0])];
                          newWind[2] = parseFloat(e.target.value) || 0;
                          setPhysicsConfig({ ...physicsConfig, wind: newWind });
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* SETTINGS / API KEY MODAL */}
      {isSettingsOpen && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
                <Key size={14} className="text-primary" /> Groq AI Settings
              </span>
              <button className="btn" style={{padding: '2px 6px'}} onClick={() => setIsSettingsOpen(false)}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Groq API Key</label>
                <input 
                  type="password" 
                  className="form-control"
                  placeholder="gsk_..."
                  value={groqApiKey}
                  onChange={(e) => setGroqApiKey(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Preferred LLM Model</label>
                <select 
                  className="form-control"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B Versatile (Fast & Smart)</option>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B Instant (Ultra-fast)</option>
                  <option value="qwen/qwen3-32b">Mixtral 8x7B (Solid reasoning)</option>
                </select>
              </div>
            </div>

            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px'}}>
              <button className="btn" onClick={() => setIsSettingsOpen(false)}>Cancel</button>
              <button 
                className="btn btn-primary"
                onClick={() => handleSaveSettings(groqApiKey, selectedModel)}
              >
                <Check size={14} /> Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

