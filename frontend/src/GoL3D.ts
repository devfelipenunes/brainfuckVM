import * as THREE from 'three';

let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let instancedMesh: THREE.InstancedMesh;
let animationId: number;
let isInitialized = false;

const NUM_CELLS = 1000;
const dummy = new THREE.Object3D();
const colorAlive = new THREE.Color(0x00ff88);
const colorDead = new THREE.Color(0x0a1a10);
// Store target colors for smooth transitions
const currentColors = new Float32Array(NUM_CELLS * 3);
const targetColors = new Float32Array(NUM_CELLS * 3);
let cellsState = new Array(NUM_CELLS).fill(0);

export function initGoL3D(container: HTMLElement) {
    if (isInitialized) return;
    
    // Setup Scene
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050508, 0.02);

    // Setup Camera
    const aspect = container.clientWidth / container.clientHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
    camera.position.z = 40;

    // Setup Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Setup Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambientLight);
    
    const pointLight = new THREE.PointLight(0x00ff88, 2, 100);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Create 1000 instances using a biological looking geometry (Icosahedron looks like a cell)
    const geometry = new THREE.IcosahedronGeometry(0.8, 1);
    
    // Custom fleshy/glowing material
    const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.2,
        clearcoat: 1.0,
        clearcoatRoughness: 0.1,
        emissive: 0x000000,
        emissiveIntensity: 0.5,
    });

    instancedMesh = new THREE.InstancedMesh(geometry, material, NUM_CELLS);
    
    // Position cells on a Fibonacci sphere so they are evenly distributed but 1D adjacent
    const phi = Math.PI * (3 - Math.sqrt(5)); // golden angle
    const radius = 20;

    for (let i = 0; i < NUM_CELLS; i++) {
        const y = 1 - (i / (NUM_CELLS - 1)) * 2; // y goes from 1 to -1
        const r = Math.sqrt(1 - y * y); // radius at y
        const theta = phi * i;

        const x = Math.cos(theta) * r;
        const z = Math.sin(theta) * r;

        dummy.position.set(x * radius, y * radius, z * radius);
        
        // Face outwards
        dummy.lookAt(0,0,0);
        // Random slight rotation for organic look
        dummy.rotateX(Math.random() * Math.PI);
        
        dummy.updateMatrix();
        instancedMesh.setMatrixAt(i, dummy.matrix);
        
        // Initialize dead colors
        colorDead.toArray(currentColors, i * 3);
        colorDead.toArray(targetColors, i * 3);
        instancedMesh.setColorAt(i, colorDead);
    }

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) instancedMesh.instanceColor.needsUpdate = true;
    
    scene.add(instancedMesh);

    // Handle Resize
    window.addEventListener('resize', onWindowResize);

    isInitialized = true;
    animate();
}

export function updateGoL3D(cells: number[]) {
    if (!isInitialized) return;
    cellsState = cells;
    
    // Update target colors based on alive/dead state
    for (let i = 0; i < NUM_CELLS; i++) {
        const targetColor = cells[i] ? colorAlive : colorDead;
        targetColor.toArray(targetColors, i * 3);
    }
}

function animate() {
    animationId = requestAnimationFrame(animate);

    const time = performance.now() * 0.001;

    // Slowly rotate the entire cell structure
    if (instancedMesh) {
        instancedMesh.rotation.y = time * 0.1;
        instancedMesh.rotation.z = Math.sin(time * 0.05) * 0.2;
        
        // Smoothly interpolate colors for that glowing/fading effect
        let colorUpdated = false;
        for (let i = 0; i < NUM_CELLS * 3; i++) {
            const current = currentColors[i];
            const target = targetColors[i];
            // Lerp
            const updated = current + (target - current) * 0.1;
            if (Math.abs(updated - current) > 0.001) {
                currentColors[i] = updated;
                colorUpdated = true;
            }
        }
        
        if (colorUpdated && instancedMesh.instanceColor) {
            // Apply new colors
            const c = new THREE.Color();
            for (let i = 0; i < NUM_CELLS; i++) {
                c.fromArray(currentColors, i * 3);
                
                // Add a "breathing" scale effect if alive
                // We'll just update color for now.
                instancedMesh.setColorAt(i, c);
            }
            instancedMesh.instanceColor.needsUpdate = true;
        }
        
        // Add a breathing effect to the whole sphere based on living cells count
        const aliveCount = cellsState.filter(c => c).length;
        const intensity = aliveCount / NUM_CELLS;
        const scale = 1.0 + Math.sin(time * 2) * 0.02 * intensity;
        instancedMesh.scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
}

function onWindowResize() {
    if (!isInitialized) return;
    const container = renderer.domElement.parentElement;
    if (container) {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
}

export function destroyGoL3D() {
    if (!isInitialized) return;
    window.removeEventListener('resize', onWindowResize);
    cancelAnimationFrame(animationId);
    scene.clear();
    renderer.dispose();
    const container = renderer.domElement.parentElement;
    if (container) container.innerHTML = '';
    isInitialized = false;
}
