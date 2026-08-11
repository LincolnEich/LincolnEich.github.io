import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 4.5;
const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setSize(w, h, false);
document.body.appendChild(renderer.domElement);
renderer.setClearColor(0x000000, 0);

const controls = new OrbitControls(camera, renderer.domElement);

const geometry = new THREE.TorusKnotGeometry(1, 0.35, 256, 64);
const material = new THREE.MeshLambertNodeMaterial({ 
    color: 0xfffffff
});
const knot = new THREE.Mesh(geometry, material);
scene.add(knot);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
scene.add(hemiLight);

function animate() {
    knot.rotation.x += 0.01;
    knot.rotation.y += 0.02;
    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);