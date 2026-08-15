import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { uv, dot, sin, pass, time, vec2, vec3, float, floor, uniform, screenSize, smoothstep, mx_noise_float } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';

/* --------------------------- Initial Scene Setup -------------------------- */
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
camera.aspect = w/h;
camera.updateProjectionMatrix();
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);
renderer.setClearColor(0x000000, 0);
await renderer.init()

/* ------------------------------ Rapier Setup ------------------------------ */
await RAPIER.init();
const gravity = { x:0.0, y:-9.81, z:0.0 };
const world = new RAPIER.World(gravity);
const mainPhysicsObjects = [];
const otherPhysicsObjects = [];

/* ----------------------- Orbit Camera + Custom Zoom ----------------------- */
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

/* ----------------------------- CSS Label Setup ---------------------------- */
let labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(w, h);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0px';
labelRenderer.domElement.style.pointerEvents = 'none';
document.body.appendChild( labelRenderer.domElement );

/* -------------------------------------------------------------------------- */
/*                              Scene Population                              */
/* -------------------------------------------------------------------------- */

const torusGeo = new THREE.TorusGeometry(1.3, 0.5, 32, 72);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshLambertNodeMaterial({ 
    color: 0xffffff
});
const knot = new THREE.Mesh(torusGeo, material);
const cube = new THREE.Mesh(boxGeo, material);
//knot.autoUpdate = true;
//cube.autoUpdate = true;
scene.add(knot, cube);

cube.position.set(5, 0, 0);

const groundGeo = new THREE.BoxGeometry(50, 0.2, 50);
const groundMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.position.set(0, -2, 0);
groundMesh.visible = false; //==**==**==**==
scene.add(groundMesh);

/* -------------------------- GLTF Loader + Objects ------------------------- */

const loader = new GLTFLoader();

const shakeGlb = await loader.loadAsync('Assets/Models/Sunshake/scene.gltf');
const shake = shakeGlb.scene;
let shakeGeo = null;

shake.traverse((child) =>{
    if (child.isMesh) {
        child.material.color.multiplyScalar(5);
        child.material.needsUpdate = true;
        shakeGeo = child.geometry;
    }
})

scene.add(shake);
shake.scale.set(5, 5, 5);

const array = [shake, cube, knot];

/* ------------------------------ Physics Setup ----------------------------- */

const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -2, 0);
const groundBody = world.createRigidBody(groundBodyDesc);
const groundColliderDesc = RAPIER.ColliderDesc.cuboid(5, 0.1, 5);
world.createCollider(groundColliderDesc, groundBody);

const knotBody = world.createRigidBody( RAPIER.RigidBodyDesc.kinematicPositionBased() );
const knotDesc = RAPIER.ColliderDesc.trimesh( torusGeo.attributes.position.array, torusGeo.index.array );
world.createCollider(knotDesc, knotBody);
mainPhysicsObjects.push({mesh: knot, body: knotBody});

const boxBody = world.createRigidBody( RAPIER.RigidBodyDesc.kinematicPositionBased() );
const boxDesc = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5);
world.createCollider(boxDesc, boxBody);
mainPhysicsObjects.push({mesh: cube, body: boxBody});

const shakeBody = world.createRigidBody( RAPIER.RigidBodyDesc.kinematicPositionBased() );
const shakeDesc = RAPIER.ColliderDesc.trimesh( shakeGeo.attributes.position.array, shakeGeo.index.array );
world.createCollider(shakeDesc, shakeBody);
mainPhysicsObjects.push({mesh: shake, body: shakeBody});

/* -------------------------- Other Physics Bodies -------------------------- */

const button = document.getElementById("boxButton");

button.addEventListener("click", async function() {
    //const cubeGeo = new THREE.BoxGeometry(1,1,1);
    //const cubeMat = new THREE.MeshLambertNodeMaterial({ color: 0xffffff });
    //const cubeMesh = new THREE.Mesh(cubeGeo, cubeMat);
    const cubeGlb = await loader.loadAsync('Assets/Models/Spud/cotton_from_scrap_mechanic.glb');
        const cube = cubeGlb.scene;
        let cubeGeo = null;

        cube.traverse((child) =>{
            if (child.isMesh) {
                child.material.color.multiplyScalar(3);
                child.material.needsUpdate = true;
                cubeGeo = child.geometry;
        }
    })
    cube.scale.set(12, 12, 12); 
    scene.add(cube);

    const cubeBody = world.createRigidBody( RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0).setRotation(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2))) )
    const cubeDesc = RAPIER.ColliderDesc.convexHull(cubeGeo.attributes.position.array).setMass(5).setRestitution(0.0);
    world.createCollider(cubeDesc, cubeBody);
    otherPhysicsObjects.push({mesh: cube, body: cubeBody});
    
});

/* --------------------------------- Lights --------------------------------- */

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
scene.add(hemiLight);

/* -------------------------------------------------------------------------- */
/*                                CSS Elements                                */
/* -------------------------------------------------------------------------- */

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

const cssElement4 = document.createElement('div');
cssElement4.className = 'Container1';
cssElement4.id = 'Container1';
cssElement4.innerHTML = ` <h5>.Cotton</h5> `;

const Label4 = new CSS2DObject(cssElement4);
scene.add(Label4);
Label4.position.set(0, 99999, 0);

/* -------------------------------------------------------------------------- */
/*                          Screen Orientation Checks                         */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*                               Post Processing                              */
/* -------------------------------------------------------------------------- */

const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);

scenePass.samples = 4; 
const scenePassColor = scenePass.getTextureNode(); 

const initialTarget = new THREE.Vector3().copy(controls.target);
const panXUniform = uniform(0);
const panYUniform = uniform(0);
const initialZoom = targetZoom;

const scaleX = uniform(0);
const scaleY = uniform(0);

function updateUniforms() {
    camera.updateMatrixWorld();
    
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    camera.matrixWorld.extractBasis(cameraRight, cameraUp, new THREE.Vector3());

    const panDisplacement = new THREE.Vector3().subVectors(controls.target, initialTarget);

    const horizontalPan = panDisplacement.dot(cameraRight);
    const verticalPan = panDisplacement.dot(cameraUp);

    panXUniform.value = horizontalPan / (targetZoom / initialZoom);
    panYUniform.value = verticalPan / (targetZoom / initialZoom);

    scaleX.value = Math.max(h/w/1.25, 1);
    scaleY.value = Math.max(w/h/1.25, 1);
}

const steppedTime = floor(time.mul(10)); //10
const aspectRatio = screenSize.x.div(screenSize.y);
const correctedUv = uv().mul(vec2(aspectRatio, float(1.0)));
const noiseFrequency = float(100); //100
const distortionScale = float(0.00125); //0.0015
const animOffset = steppedTime.mul(500); //500
const samplePos = correctedUv.mul(noiseFrequency);
const noiseX = mx_noise_float(samplePos.add(vec2(animOffset.add(panXUniform.mul(14)), panYUniform.mul(-14))));
const noiseY = mx_noise_float(samplePos.add(vec2(panXUniform.mul(14), animOffset.sub(panYUniform.mul(14)))));
const proceduralOffset = vec2(noiseX.mul(scaleX), noiseY.mul(scaleY)).mul(distortionScale);
const distortedUv = uv().add(proceduralOffset);
const distortedSceneNode = scenePass.getTextureNode('output').sample(distortedUv);

const sceneAlpha = distortedSceneNode.a;
const luminance = dot(vec3(0.2126, 0.7152, 0.0722), distortedSceneNode.rgb);
const lineFrequency = float(200); //200
const diagonalCoord = correctedUv.x.add(panXUniform.div(7)).add((correctedUv.y).sub(panYUniform.div(7))).mul(lineFrequency);
const diagonalLines = sin(diagonalCoord).mul(8); //2?
const shadowMask = (smoothstep(float(0.3), float(0.0), luminance)).div(5);
const lineIntensity = diagonalLines.mul(shadowMask);
const hatchedColor = distortedSceneNode.mul(lineIntensity);
const finalHatch = (distortedSceneNode.add(hatchedColor.rgb)).mul(sceneAlpha);

const filmPass = film(finalHatch, 0.75);
const dotPass = dotScreen(filmPass);
dotPass.scale.value = 1.4;

postProcessing.outputNode = dotPass;

/* -------------------------------------------------------------------------- */
/*                          Animate + Test Variables                          */
/* -------------------------------------------------------------------------- */

let mytime = 0;

let rotX = 0;
let rotY = 0;
let rotZ = 0;
const targetEuler = new THREE.Euler();
const targetQuat = new THREE.Quaternion();

function animate() {

    /* ------------------------------ Camera Stuff ------------------------------ */

    const direction = new THREE.Vector3().subVectors(camera.position, controls.target);
    const currentDistance = direction.length();

    const newDistance = THREE.MathUtils.lerp(currentDistance, targetZoom, lerpZoomFactor);

    direction.setLength(newDistance);
    camera.position.copy(controls.target).add(direction);
    
    controls.update();

    world.step();

    /* --------------------------- Object Manipulation -------------------------- */

    rotX += 0.005 * (currentDistance - targetZoom) + 0.005;
    rotY += 0.005 * (currentDistance - targetZoom) + 0.005;
    //rotZ += 0.005 * (currentDistance - targetZoom) + 0.005;

    for (const obj of mainPhysicsObjects) {
        targetEuler.set(rotX, rotY*1.2, 0, 'XYZ');
        targetQuat.setFromEuler(targetEuler);
        obj.body.setNextKinematicRotation(targetQuat);
    }

    mytime += 0.01;

    shakeBody.setNextKinematicTranslation({ x: Math.sin(mytime) * -3, y: 0, z: Math.cos(mytime) * -3 });
    boxBody.setNextKinematicTranslation({ x: Math.sin(mytime) * 3, y: 0, z: Math.cos(mytime) * 3 });
    Label1.position.set(cube.position.x, + 1.2, cube.position.z);
    Label2.position.set(shake.position.x, + 1.2, shake.position.z);

    for (const obj of mainPhysicsObjects) {
        const position = obj.body.translation();
        const rotation = obj.body.rotation();

        obj.mesh.position.set(position.x, position.y, position.z);
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }

    for (let i = 0; i <= otherPhysicsObjects.length - 1; i++) {
        const obj = otherPhysicsObjects[i];
        const position = obj.body.translation();
        const rotation = obj.body.rotation();

        obj.mesh.position.set(position.x, position.y, position.z);
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

        if (position.y < -25) {
            world.removeRigidBody(obj.body);
            scene.remove(obj.mesh);
            otherPhysicsObjects.splice(i, 1);
        } else {
            Label4.position.set(position.x, position.y + 1.1, position.z);
        }
        
    }

    /* --------------------------------- Updates -------------------------------- */

    updateUniforms();

    postProcessing.render();
    labelRenderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);