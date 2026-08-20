import * as THREE from 'three/webgpu';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import RAPIER from '@dimforge/rapier3d-compat';
import { uv, dot, sin, pass, time, vec2, vec3, float, floor, uniform, screenSize, smoothstep, texture, mx_noise_float } from 'three/tsl';
import { dotScreen } from 'three/addons/tsl/display/DotScreenNode.js';
import { film } from 'three/addons/tsl/display/FilmNode.js';
import { outline } from 'three/addons/tsl/display/OutlineNode.js';

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
const gravity = { x:0.0, y:-12, z:0.0 };
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

/* --------------------------------- Loader --------------------------------- */

const manager = new THREE.LoadingManager();
const canvas = document.querySelector('canvas');
canvas.classList.add('canvas');

manager.onLoad = () => {
    canvas.classList.add('fadeIn');

    document.body.classList.add('loaded');

    function updateText(element) {
        element.innerHTML = element.innerText
            .split("")
            .map(letter => `<span>${letter === " " ? "&nbsp;" : letter}</span>`)
            .join("");

        Array.from(element.children).forEach((span, index) => {
            span.style.opacity = 0;
            setTimeout(() => {
            span.classList.add("wavy");
            }, index * 200);
        });
    }

    updateText(document.querySelector('h1'));
    setTimeout(() => {
    updateText(document.querySelector('h2'));
    }, 1600);
};

/* -------------------------------------------------------------------------- */
/*                              Scene Population                              */
/* -------------------------------------------------------------------------- */

const textureLoader = new THREE.TextureLoader(manager);

const torusGeo = new THREE.TorusGeometry(1.3, 0.5, 32, 72);
const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshLambertNodeMaterial({ 
    color: 0xffffff
});
/*
const toonMaterial = new THREE.MeshToonNodeMaterial({
  color: 0xffffff
});
*/
const knot = new THREE.Mesh(torusGeo, material);
const cube = new THREE.Mesh(boxGeo, material);
knot.layers.enable(1);
knot.layers.disable(0);
knot.autoUpdate = true;
cube.autoUpdate = true;
scene.add(knot); //cube

cube.position.set(5, 0, 0);

const groundGeo = new THREE.BoxGeometry(50, 0.2, 50);
const groundMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
groundMesh.position.set(0, -2, 0);
groundMesh.visible = false; //==**==**==**==
scene.add(groundMesh);

/* -------------------------- GLTF Loader + Objects ------------------------- */

const loader = new GLTFLoader(manager);

const shakeGlb = await loader.loadAsync('Assets/Models/Sunshake/scene.gltf');
const shake = shakeGlb.scene;
let shakeGeo = null;

shake.traverse((child) =>{
    if (child.isMesh) {
        child.material.color.multiplyScalar(5);
        child.material.needsUpdate = true;
        child.layers.enable(1);
        child.layers.disable(0);
        shakeGeo = child.geometry;
    }
})

scene.add(shake);
shake.scale.set(5, 5, 5);

const fossilGlb = await loader.loadAsync('Assets/Models/Fossil/Star.glb');
const fossil = fossilGlb.scene;
let fossilGeo = null;

const starTexture = textureLoader.load('Assets/Models/Fossil/Text.png');
const starMat = new THREE.MeshBasicMaterial({ 
    map: starTexture
});

fossil.traverse((child) =>{
    if (child.isMesh) {
        child.material = starMat;
        child.material.needsUpdate = true;
        fossilGeo = child.geometry;
    }
})

fossil.scale.set(0.35, 0.35, 0.35);
let fossilCopy = fossil.clone();
fossilCopy.scale.set(0.345, 0.345, 0.345);

scene.add(fossil, fossilCopy);
const array = [shake, fossil, cube, knot];

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
mainPhysicsObjects.push({mesh: fossil, body: boxBody});

const shakeBody = world.createRigidBody( RAPIER.RigidBodyDesc.kinematicPositionBased() );
const shakeDesc = RAPIER.ColliderDesc.trimesh( shakeGeo.attributes.position.array, shakeGeo.index.array );
world.createCollider(shakeDesc, shakeBody);
mainPhysicsObjects.push({mesh: shake, body: shakeBody});

/* -------------------------- Other Physics Bodies -------------------------- */

const button = document.getElementById("boxButton");
const loader2 = new GLTFLoader();

button.addEventListener("click", async function() {
    const cubeGlb = await loader2.loadAsync('Assets/Models/Spud/cotton_from_scrap_mechanic.glb');
        const cube = cubeGlb.scene;
        let cubeGeo = null;

        cube.traverse((child) =>{
            if (child.isMesh) {
                child.material.color.multiplyScalar(3);
                child.material.needsUpdate = true;
                cubeGeo = child.geometry;
                child.layers.enable(1);
                child.layers.disable(0);
        }
    })
    cube.scale.set(12, 12, 12); 
    scene.add(cube);

    const cubeBody = world.createRigidBody( RAPIER.RigidBodyDesc.dynamic().setTranslation(0, 5, 0).setRotation(new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2))) )
    const cubeDesc = RAPIER.ColliderDesc.convexHull(cubeGeo.attributes.position.array).setMass(5).setRestitution(0.2);
    world.createCollider(cubeDesc, cubeBody);
    otherPhysicsObjects.push({mesh: cube, body: cubeBody});
    
});

/* --------------------------------- Lights --------------------------------- */

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, 1.5);
scene.add(hemiLight);

const hemiFx = new THREE.HemisphereLight(0xffffff, 0x000000, 2);
hemiFx.layers.enable(1);
scene.add(hemiFx);

/*const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(0,5,0);
scene.add(directionalLight);*/

/* -------------------------------------------------------------------------- */
/*                                Howler Setup                                */
/* -------------------------------------------------------------------------- */

const open = new Howl({
  src: ['Assets/Audio/Open.mp3'],
  volume: 1.0
});

const close = new Howl({
  src: ['Assets/Audio/Close.mp3'],
  volume: 1.0
});

const slideIn = new Howl({
  src: ['Assets/Audio/Slide In.mp3'],
  volume: 1.0
});

const slideOut = new Howl({
  src: ['Assets/Audio/Slide Out.mp3'],
  volume: 1.0
});

/* -------------------------------------------------------------------------- */
/*                                CSS Elements                                */
/* -------------------------------------------------------------------------- */

const cssElement1 = document.createElement('div');
cssElement1.className = 'Container2';
cssElement1.innerHTML = ` <div class="mask" id="openBtn">
                            <div class="card">
                            <h6>Click me to zoom</h6>
                            <p1>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque nulla eros, varius at lobortis nec, ullamcorper vel nulla. Vestibulum vehicula ex nec lectus sodales rutrum in dictum eros. Duis quam sem, luctus id ante in, hendrerit consequat mauris. Nunc tristique nisl ac sem eleifend accumsan. Maecenas ex magna, dapibus eu dapibus et, tristique ac arcu. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus arcu massa, rhoncus sit amet aliquet et, mattis eu tortor. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.
                                Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec volutpat pulvinar tellus eu cursus. Mauris et magna mauris. Donec quam enim, eleifend at egestas quis, facilisis eu massa. Morbi cursus vestibulum dolor sit amet efficitur. Praesent id lobortis tortor, rhoncus auctor purus. Phasellus dictum facilisis augue quis imperdiet. Sed congue lorem eu orci suscipit sagittis. Phasellus aliquet vehicula nibh, ac fermentum tortor euismod vitae. Donec vitae eros sit amet erat laoreet hendrerit non id lacus. Aliquam eu dui fermentum, gravida est id, mattis enim. Vivamus imperdiet bibendum dolor, id tincidunt dolor porttitor vitae.
                                In nisi nisi, varius quis facilisis tristique, aliquam at tortor. Aliquam eget tempor lectus. Aenean id dolor placerat augue consequat lobortis sit amet at augue. Duis a hendrerit nulla, fringilla auctor elit. Donec efficitur nec lectus vel scelerisque. Sed venenatis pharetra nisl, id tempor magna molestie vitae. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec tincidunt felis ac arcu vehicula semper.
                                Nam ut arcu luctus, ultricies turpis vel, pellentesque risus. Sed quam est, fringilla at erat at, sagittis pulvinar est. Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac turpis egestas. Donec luctus dolor id sem pellentesque, sit amet consectetur tellus hendrerit. Vivamus venenatis orci vel aliquam dictum. Donec non fringilla metus, sit amet mollis orci. Etiam fringilla nibh eu enim mattis rhoncus. Vivamus bibendum libero quis lorem tincidunt sollicitudin. Praesent vel tellus varius, vestibulum mi et, viverra turpis. Maecenas eros ligula, posuere sit amet vulputate ut, venenatis non augue.
                                Suspendisse luctus feugiat diam, in mattis elit ornare ut. Nam est urna, fringilla ut tellus aliquam, porta tempor turpis. Integer mattis egestas ante at laoreet. Integer ultricies sem ut metus efficitur, in rutrum sapien efficitur. Fusce eleifend justo non nisl sollicitudin, eget consectetur lorem vulputate. Integer pulvinar condimentum neque, et iaculis velit sollicitudin sit amet. Pellentesque est lorem, porta vitae dignissim eu, aliquam eu mauris. Nam auctor congue orci nec rutrum. Suspendisse efficitur augue a ornare sodales. Curabitur ex ante, posuere ac ipsum malesuada, hendrerit tincidunt risus. In ex elit, imperdiet sit amet pharetra vel, euismod sed ante. Maecenas sed risus quis lectus mollis gravida lobortis eu arcu.
                                </p1>
                            </div>
                        </div> `;
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

/* ---------------------------- CSS Manipulation ---------------------------- */

const openBtn = cssElement1.querySelector('#openBtn')
let openCheck1 = 0;

openBtn.addEventListener('click', () => {
    if(!openCheck1) {
        cssElement1.classList.add('active');
        cssElement1.classList.remove('disabled');
        open.play();
        slideIn.play();
        openCheck1 = 1;
    } else {
        cssElement1.classList.remove('active');
        cssElement1.classList.add('disabled');
        close.play();
        slideOut.play();
        openCheck1 = 0;
    }
});

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
        fxCamera.aspect = w / h;
        camera.updateProjectionMatrix();
        fxCamera.updateProjectionMatrix();

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
    if (!openCheck1) {
        targetZoom += event.deltaY * zoomSensitivity * 0.05;

        targetZoom = Math.max(minZoom, Math.min(maxZoom, targetZoom));
    }
});

/* -------------------------------------------------------------------------- */
/*                               Post Processing                              */
/* -------------------------------------------------------------------------- */

const postProcessing = new THREE.PostProcessing(renderer);
const scenePass = pass(scene, camera);
scenePass.samples = 4; 
const sceneDepth = scenePass.getTextureNode('depth');

const fxCamera = camera.clone();
fxCamera.layers.set(1);
const fxPass = pass(scene, fxCamera);
fxPass.samples = 4;
const fxDepth = fxPass.getTextureNode('depth');

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

/* --------------------------------- Distort -------------------------------- */

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
const distortedFxNode = fxPass.getTextureNode('output').sample(distortedUv);
const distortedFxDepth = fxDepth.sample(distortedUv);

/* --------------------------------- Outline -------------------------------- */

const edgeStrength = uniform( 10.0 );
const edgeGlow = uniform( 5.0 );
const edgeThickness = uniform( 1.0 );
const outlinePass = outline( scene, camera, {
    edgeStrength,
    edgeGlow,
    edgeThickness
});
outlinePass.selectedObjects = [fossilCopy];
const { visibleEdge, hiddenEdge } = outlinePass;
const outlineColor = visibleEdge.mul( 10 ).add( hiddenEdge.mul( 10 ));

/* --------------------------------- Hashes --------------------------------- */

const sceneAlpha = distortedFxNode.a;
const luminance = dot(vec3(0.2126, 0.7152, 0.0722), distortedFxNode.rgb);
const lineFrequency = float(200); //200
const diagonalCoord = correctedUv.x.add(panXUniform.div(7)).add((correctedUv.y).sub(panYUniform.div(7))).mul(lineFrequency);
const diagonalLines = sin(diagonalCoord).mul(2); //2?
const shadowMask = (smoothstep(float(0.3), float(0.0), luminance)).div(5);
const lineIntensity = diagonalLines.mul(shadowMask);
const hatchedColor = distortedFxNode.mul(lineIntensity);
const finalHatch = (distortedFxNode.add(hatchedColor.rgb)).mul(sceneAlpha);

/* ---------------------------------- Other --------------------------------- */

const filmPass = film(finalHatch, 0.75);
const dotPass = dotScreen(filmPass);
dotPass.scale.value = 1.4;

const isOccluded = distortedFxDepth.greaterThan(sceneDepth);
const finalFrameColor = isOccluded.select(
    scenePass,
    dotPass
);

postProcessing.outputNode = finalFrameColor.add(outlineColor);

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

    fxCamera.position.copy(camera.position);
    fxCamera.rotation.copy(camera.rotation);

    /* --------------------------- Object Manipulation -------------------------- */

    world.step();

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
    Label2.position.set(shake.position.x, + 1.2, shake.position.z);

    for (const obj of mainPhysicsObjects) {
        const position = obj.body.translation();
        const rotation = obj.body.rotation();

        obj.mesh.position.set(position.x, position.y, position.z);
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

        obj.mesh.updateMatrixWorld();
    }

    for (let i = 0; i <= otherPhysicsObjects.length - 1; i++) {
        const obj = otherPhysicsObjects[i];
        const position = obj.body.translation();
        const rotation = obj.body.rotation();

        obj.mesh.position.set(position.x, position.y, position.z);
        obj.mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);

        obj.mesh.updateMatrixWorld();

        if (position.y < -25) {
            world.removeRigidBody(obj.body);
            scene.remove(obj.mesh);
            otherPhysicsObjects.splice(i, 1);
        } else {
            Label4.position.set(position.x, position.y + 1.1, position.z);
        }
        
    }

    fossilCopy.position.copy(fossil.position);
    fossilCopy.rotation.copy(fossil.rotation);

    /* ---------------------------- CSS Manipulation ---------------------------- */

    if (!openCheck1) {
        Label1.renderOrder = 0;
        const targetVec = new THREE.Vector3(Math.sin(mytime + 0.175) * 3, + 1.2, Math.cos(mytime + 0.175) * 3);
        Label1.position.lerp(targetVec, 0.05);
    } else {
        Label1.renderOrder = 999;
        Label1.position.lerp(controls.target, 0.1)
    }

    /* --------------------------------- Updates -------------------------------- */

    updateUniforms();

    postProcessing.render();
    labelRenderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);