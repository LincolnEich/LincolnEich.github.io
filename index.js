import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pass, 
         uniform, 
         uv, 
         texture, 
         time, 
         vec2, 
         float, 
         screenSize,
         mix, 
         floor,
         mx_noise_float } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { outline } from 'three/addons/tsl/display/OutlineNode.js';
import { pixelationPass } from 'three/addons/tsl/display/PixelationPassNode.js';


const container = document.body
let w = container.clientWidth;
let h = container.clientHeight;
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(20, w / h, 1, 10000);
camera.position.z = 18 - ((camera.aspect - 1.8) / 0.1);
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
const zoomSensitivity = 0.5;
const minZoom = 5;
const maxZoom = 40;
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

window.addEventListener('resize', onWindowResize, false);
window.addEventListener('orientationchange', onWindowResize, false);

function onWindowResize() {
    requestAnimationFrame(() => {
        w = container.clientWidth;
        h = container.clientHeight;

        camera.aspect = w / h;
        camera.updateProjectionMatrix();

        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        console.log(Math.max(w/h, h/w));
        targetZoom = 18 - Math.max(w/h, h/w);
    });
}

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
const aspectRatio = screenSize.x.div(screenSize.y);
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
dotPass.scale.value = 1.4;

postProcessing.outputNode = dotPass;


function animate() {
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    const currentDistance = direction.length();

    const newDistance = THREE.MathUtils.lerp(currentDistance, targetZoom, lerpZoomFactor);

    direction.setLength(newDistance);
    camera.position.copy(controls.target).add(direction);
    
    controls.update();

    knot.rotation.x += 0.005 * (currentDistance - targetZoom) + 0.005;
    knot.rotation.y += 0.005 * (currentDistance - targetZoom) + 0.005;

    postProcessing.render();
}

renderer.setAnimationLoop(animate);