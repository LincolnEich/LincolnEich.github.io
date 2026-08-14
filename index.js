import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { pass,
         uv,
         time, 
         vec2,
         vec3,
         float,
         screenSize,
         floor,
         smoothstep,
         dot,
         sin,
         mx_noise_float } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';

// Initial Scene Setup
const container = document.body
let w = container.clientWidth;
let h = container.clientHeight;
const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(20, w / h, 1, 10000);
if (w < h)
    { camera.position.z = 18 / camera.aspect / 1.3; } else 
    { camera.position.z = 20; }
const renderer = new THREE.WebGPURenderer({antialias: true});
renderer.setSize(w, h, false);
document.body.appendChild(renderer.domElement);
renderer.setClearColor(0x000000, 0);
await renderer.init()

//Orbit Camera + Custom Zoom
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

//CSS Label Setup
let labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(w, h);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild( labelRenderer.domElement );

//Scene Population
//const geometry = new THREE.TorusKnotGeometry(1, 0.35, 256, 64);
const geometry = new THREE.TorusGeometry(1.3, 0.5, 32, 72);
const geometry2 = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshLambertNodeMaterial({ 
    color: 0xffffff
});
const knot = new THREE.Mesh(geometry, material);
const cube = new THREE.Mesh(geometry2, material);
//knot.autoUpdate = true;
//cube.autoUpdate = true;
scene.add(knot, cube);

cube.position.set(5, 0, 0);

//GLTF Loader + Objects
const loader = new GLTFLoader();

const shakeGlb = await loader.loadAsync('Assets/Models/Sunshake/scene.gltf');
const shake = shakeGlb.scene;
shake.traverse((child) =>{
    if (child.isMesh) {
        //console.log(child.material);
        child.material.color.multiplyScalar(5);
    }
})
scene.add(shake);
shake.scale.set(5, 5, 5);

const array = [shake, cube, knot];

//Lights
const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
scene.add(hemiLight);

//CSS Elements
const cssElement1 = document.createElement('div');
cssElement1.className = 'Container1';
cssElement1.innerHTML = ` <h5>.Cube</h5> `;

const Label1 = new CSS2DObject(cssElement1);
scene.add(Label1);

const cssElement2 = document.createElement('div');
cssElement2.className = 'Container1';
cssElement2.innerHTML = ` <h5>.Sunshake</h5> `;

const Label2 = new CSS2DObject(cssElement2);
scene.add(Label2);

const cssElement3 = document.createElement('div');
cssElement3.className = 'Container1';
cssElement3.innerHTML = ` <h5>.Torus</h5> `;

const Label3 = new CSS2DObject(cssElement3);
scene.add(Label3);
Label3.position.set(0, 2.3, 0);

//Event Listeners
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
        labelRenderer.setSize(w, h);

        if (w < h) {
            targetZoom = 18 / camera.aspect / 1.1;
        } else {
            targetZoom = 20;
        }
    });
}

window.addEventListener('wheel', (event) => {
    targetZoom += event.deltaY * zoomSensitivity * 0.05;

    targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
});

//Post Processing
const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);

scenePass.samples = 4; 
const scenePassColor = scenePass.getTextureNode(); 

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
const distortedSceneNode = scenePass.getTextureNode('output').sample(distortedUv);

const sceneAlpha = distortedSceneNode.a;
const luminance = dot(vec3(0.2126, 0.7152, 0.0722), distortedSceneNode.rgb);
const lineFrequency = float(300.0);
const diagonalCoord = correctedUv.x.add(correctedUv.y).mul(lineFrequency);
const diagonalLines = sin(diagonalCoord).mul(1);
const shadowMask = (smoothstep(float(0.3), float(0.0), luminance)).div(5);
const lineIntensity = diagonalLines.mul(shadowMask);
const hatchedColor = distortedSceneNode.mul(lineIntensity);
const finalHatch = (distortedSceneNode.add(hatchedColor.rgb)).mul(sceneAlpha);

const filmPass = film(finalHatch, 0.75);
const dotPass = dotScreen(filmPass);
dotPass.scale.value = 1.4;

postProcessing.outputNode = filmPass;

//Test Variables
let mytime = 0;

function animate() {
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    const currentDistance = direction.length();

    const newDistance = THREE.MathUtils.lerp(currentDistance, targetZoom, lerpZoomFactor);

    direction.setLength(newDistance);
    camera.position.copy(controls.target).add(direction);
    
    controls.update();

    for (const object of array) {
        object.rotation.x += 0.005 * (currentDistance - targetZoom) + 0.005;
        object.rotation.y += 0.005 * (currentDistance - targetZoom) + 0.005;
    }

    mytime += 0.01;

    shake.position.set(Math.sin(mytime) * -3, 0, Math.cos(mytime) * -3);
    cube.position.set(Math.sin(mytime) * 3, 0, Math.cos(mytime) * 3);
    Label1.position.set(cube.position.x, + 1.2, cube.position.z);
    Label2.position.set(shake.position.x, + 1.2, shake.position.z);

    postProcessing.render();
    labelRenderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);