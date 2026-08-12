import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass, 
         uniform, 
         uv, 
         texture, 
         time, 
         vec2, 
         float, 
         viewportResolution,
         mix, 
         floor,
         mx_noise_float } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { outline } from 'three/addons/tsl/display/OutlineNode.js';
import { pixelationPass } from 'three/addons/tsl/display/PixelationPassNode.js';


const w = window.innerWidth;
const h = window.innerHeight;
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(75, w / h, 0.1, 1000);
camera.position.z = 4.5;
const renderer = new THREE.WebGPURenderer({antialias: true});
renderer.setSize(w, h, false);
document.body.appendChild(renderer.domElement);
renderer.setClearColor(0x000000, 0);

await renderer.init()

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableZoom = false;
controls.dampingFactor = 0.05;
controls.maxTargetRadius = 2;
let targetZoom = camera.position.length();
const zoomSensitivity = 0.1;
const minZoom = 2;
const maxZoom = 10;
const lerpZoomFactor = 0.05;

//const geometry = new THREE.TorusKnotGeometry(1, 0.35, 256, 64);
const geometry = new THREE.TorusGeometry(1.3, 0.5, 32, 72);
const material = new THREE.MeshLambertNodeMaterial({ 
    color: 0xffffff
});
const knot = new THREE.Mesh(geometry, material);
knot.autoUpdate = true; 
scene.add(knot);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
scene.add(hemiLight);


window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

window.addEventListener('wheel', (event) => {
    targetZoom += event.deltaY * zoomSensitivity * 0.05;

    targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
});


const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);
scenePass.samples = 4; 
const scenePassColor = scenePass.getTextureNode(); 

const textureLoader = new THREE.TextureLoader();
const noisetexture = textureLoader.load('path/to/noise.png');
const steppedTime = floor(time.mul(10));
const aspectRatio = viewportResolution.x.div(viewportResolution.y);
const correctedUv = uv().mul(vec2(aspectRatio, float(1.0)));
const noiseFrequency = float(100);
const distortionScale = float(0.0015);
const animOffset = steppedTime.mul(100);
const samplePos = correctedUv.mul(noiseFrequency);
const noiseX = mx_noise_float(samplePos.add(vec2(animOffset, 0.0)));
const noiseY = mx_noise_float(samplePos.add(vec2(0.0, animOffset)));
const proceduralOffset = vec2(noiseX, noiseY.mul(1.1)).mul(distortionScale);
const distortedUv = uv().add(proceduralOffset);
const distortedSceneNode = scenePass.getTextureNode('output').uv(distortedUv);

const filmPass = film(distortedSceneNode, 1);
const dotPass = dotScreen(filmPass);
dotPass.scale.value = 4;

postProcessing.outputNode = dotPass;


function animate() {
    knot.rotation.x += 0.005;
    knot.rotation.y += 0.005;
    
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    const currentDistance = direction.length();

    const newDistance = THREE.MathUtils.lerp(currentDistance, targetZoom, lerpZoomFactor);

    direction.setLength(newDistance);
    camera.position.copy(controls.target).add(direction);
    
    controls.update();

    postProcessing.render();
}

renderer.setAnimationLoop(animate);