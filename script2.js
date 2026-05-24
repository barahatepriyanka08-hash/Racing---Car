/**
 * CITY RACER: NITRO - REFINED RACING
 */

// ================= GAME STATE =================
let gameActive = false;
let crashed = false;
let speed = 0;
let score = 0;
let currentLevel = 1;
let lastTime = performance.now();
const keys = {};
const lanes = [-2.5, 0, 2.5];
let lane = 1;

// ================= SCENE SETUP =================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f1a);
scene.fog = new THREE.Fog(0x0b0f1a, 15, 120);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 2.5, 6.0);

const renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById("gameCanvas"),
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.5));
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(-10, 25, 10);
sun.castShadow = true;
scene.add(sun);

// ================= WORLD OBJECTS =================
const buildings = [];
const trees = [];
const sideBarriers = []; 
const roadObstacles = []; 
const traffic = [];
const wheelMeshes = [];
let carPlayer;

// ================= ROAD =================
function createRoad() {
    const c = document.createElement("canvas");
    c.width = c.height = 1024;
    const x = c.getContext("2d");
    x.fillStyle = "#1b1b25";
    x.fillRect(0, 0, 1024, 1024);
    x.strokeStyle = "#ffffff";
    x.lineWidth = 6;
    x.setLineDash([40, 30]);
    x.beginPath(); x.moveTo(512, 0); x.lineTo(512, 1024); x.stroke();
    x.setLineDash([]);
    x.lineWidth = 15;
    x.beginPath(); x.moveTo(80, 0); x.lineTo(80, 1024); x.moveTo(944, 0); x.lineTo(944, 1024); x.stroke();
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 10);
    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(12, 200),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.z = -80;
    road.receiveShadow = true;
    return { mesh: road, tex: tex };
}
const roadData = createRoad();
scene.add(roadData.mesh);

// ================= ENVIRONMENT =================
function initEnvironment() {
    [buildings, trees, sideBarriers, roadObstacles].forEach(arr => {
        arr.forEach(obj => scene.remove(obj));
        arr.length = 0;
    });

    for (let i = 0; i < 30; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const zPos = -i * 12;

        const h = 10 + Math.random() * 20;
        const b = new THREE.Mesh(new THREE.BoxGeometry(5, h, 5), new THREE.MeshStandardMaterial({color: 0x1a1d2b}));
        b.position.set(15 * side, h/2, zPos);
        scene.add(b);
        buildings.push(b);

        const sb = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 12), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
        sb.position.set(6.2 * side, 0.3, zPos);
        scene.add(sb);
        sideBarriers.push(sb);

        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.2), new THREE.MeshStandardMaterial({color: 0x3d2b1f}));
        const leaves = new THREE.Mesh(new THREE.SphereGeometry(1.0), new THREE.MeshStandardMaterial({color: 0x145214}));
        leaves.position.y = 1.2;
        tree.add(trunk, leaves);
        tree.position.set(9 * side, 0.5, zPos + (Math.random() * 5));
        scene.add(tree);
        trees.push(tree);
    }

    // Spawn barriers only for level 2 & 3
    if(currentLevel > 1){
        for(let i=0;i<3;i++) spawnRoadObstacle(true);
    }
}

function spawnRoadObstacle(initial=false){
    const obstacle = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2,0.8,0.8), new THREE.MeshStandardMaterial({color:0xffcc00}));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.1,0.25,0.9), new THREE.MeshStandardMaterial({color:0x111111}));
    obstacle.add(base,stripe);
    obstacle.position.set(lanes[Math.floor(Math.random()*3)],0.4, initial?-100-(Math.random()*200):-300);
    scene.add(obstacle);
    roadObstacles.push(obstacle);
}

// ================= PLAYER CAR =================
function createRacingCar(color=0xff0000, isPlayer=false){
    const car = new THREE.Group();
    car.userData.parts=[];
    const paintMat = new THREE.MeshStandardMaterial({color,metalness:0.7,roughness:0.2});
    const blackMat = new THREE.MeshStandardMaterial({ color:0x111111});

    const body = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.45,3.2), paintMat);
    body.position.y=0.45;
    car.add(body); car.userData.parts.push(body);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1,0.4,1.2), new THREE.MeshStandardMaterial({color:0x111111}));
    cabin.position.set(0,0.8,-0.2);
    car.add(cabin); car.userData.parts.push(cabin);

    const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.5,0.05,0.5), paintMat);
    spoiler.position.set(0,0.95,-1.3);
    car.add(spoiler); car.userData.parts.push(spoiler);

    const wheelGeo = new THREE.CylinderGeometry(0.38,0.38,0.3,24);
    [[-0.75,0.38,1],[0.75,0.38,1],[-0.75,0.38,-1],[0.75,0.38,-1]].forEach(pos=>{
        const w=new THREE.Mesh(wheelGeo,blackMat);
        w.rotation.z=Math.PI/2;
        w.position.set(...pos);
        car.add(w); car.userData.parts.push(w);
        if(isPlayer) wheelMeshes.push(w);
    });

    return car;
}

// ================= INIT GAME =================
window.initGame = function(level){
    currentLevel = level; score=0; speed=0; lane=1; crashed=false;
    if(carPlayer) scene.remove(carPlayer); wheelMeshes.length=0;
    carPlayer=createRacingCar(0xcc0000,true);
    scene.add(carPlayer);

    traffic.forEach(t=>scene.remove(t)); traffic.length=0;
    let npcCount = 2+level*2;
    for(let i=0;i<npcCount;i++) spawnTraffic(true);

    initEnvironment();
    gameActive=true;
};

// ================= TRAFFIC =================
function spawnTraffic(initial=false){
    const t = createRacingCar(Math.random()*0xffffff);
    t.position.set(
        lanes[Math.floor(Math.random()*3)],
        0,
        initial ? -40 - Math.random()*150 : -250
    );

    // 🔁 ALWAYS RESET AI DATA
    t.userData.speed = 10 + Math.random()*10;
    t.userData.targetLane = undefined;
    t.userData.aggressive = false;

    // 🔴 LEVEL 3: assign ONE aggressive enemy
    if(currentLevel === 3 && traffic.length === 0){
        t.userData.aggressive = true;
        t.userData.speed += 8;
    }

    scene.add(t);
    traffic.push(t);
}


// ================= INPUT =================
window.onkeydown=e=>{
    if(!gameActive||crashed) return;
    const k=e.key.toLowerCase();
    if((k==="arrowleft"||k==="a") && lane>0) lane--;
    if((k==="arrowright"||k==="d") && lane<2) lane++;
    keys[k]=true;
};
window.onkeyup=e=>keys[e.key.toLowerCase()]=false;

// ================= CRASH =================
function handleCrash(){
    if(crashed) return;
    crashed=true;
    document.getElementById("status").textContent="Crash";

    carPlayer.userData.parts.forEach(p=>{
        p.userData.velocity=new THREE.Vector3(
            (Math.random()-0.5)*1.5,
            Math.random()*1.5,
            (Math.random()-0.5)*1.5
        );
        p.userData.rotVel=new THREE.Vector3(
            Math.random()*0.3,
            Math.random()*0.3,
            Math.random()*0.3
        );
    });

    setTimeout(()=>{ if(typeof triggerGameOver==="function") triggerGameOver(score); },2000);
}

// ================= UPDATE LOOP =================
function update(now){
    const dt = Math.min((now-lastTime)/1000,0.1);
    lastTime=now;
    if(!gameActive) return;

    if(crashed){
        carPlayer.userData.parts.forEach(p=>{
            if(p.userData.velocity){
                p.position.add(p.userData.velocity.clone().multiplyScalar(dt));
                p.rotation.x+=p.userData.rotVel.x;
                p.rotation.y+=p.userData.rotVel.y;
                p.rotation.z+=p.userData.rotVel.z;
                p.userData.velocity.y-=0.02;
                if(p.position.y<0){ p.position.y=0; p.userData.velocity.set(0,0,0); }
            }
        });
        return;
    }

    // SPEED CONTROL
    if(keys.s||keys.arrowdown) speed-=150*dt;
    else if(keys.w||keys.arrowup) speed+=45*dt;
    else speed-=12*dt;
    speed=Math.max(0, Math.min(speed,65+currentLevel*15));

    // PLAYER POSITION
    const targetX=lanes[lane];
    carPlayer.position.x+=(targetX-carPlayer.position.x)*10*dt;
    carPlayer.rotation.z=-(carPlayer.position.x-targetX)*0.3;
    wheelMeshes.forEach(w=>w.rotation.x-=speed*dt*0.7);

    // ROAD SCROLL
    const worldStep=speed*dt;
    roadData.tex.offset.y+=worldStep*0.05;
    [...buildings,...trees,...sideBarriers].forEach(obj=>{
        obj.position.z+=worldStep;
        if(obj.position.z>25) obj.position.z=-300;
    });

    // ROAD OBSTACLES
    roadObstacles.forEach(obs=>{
        obs.position.z+=worldStep;
        if(obs.position.z>20){ 
            obs.position.z=-350;
            obs.position.x=lanes[Math.floor(Math.random()*3)];
        }
        if(Math.abs(obs.position.z-carPlayer.position.z)<1.6 && Math.abs(obs.position.x-carPlayer.position.x)<1.0) handleCrash();
    });

    // TRAFFIC + ENEMY LANE CHANGE LEVEL 3
    traffic.forEach(t=>{
        if(currentLevel===3){
            if(Math.random()<0.005) t.userData.targetLane=Math.floor(Math.random()*3);
            if(t.userData.targetLane!==undefined){
                t.position.x+=(lanes[t.userData.targetLane]-t.position.x)*0.05;
            }
        }
        const npcForward=t.userData.speed*dt;
        t.position.z+=worldStep-npcForward;
        if(t.position.z>20){
            t.position.z=-250;
            t.position.x=lanes[Math.floor(Math.random()*3)];
        }
        if(Math.abs(t.position.z-carPlayer.position.z)<2.5 && Math.abs(t.position.x-carPlayer.position.x)<1.2) handleCrash();
    });

    // HUD & SCORE
    score+=worldStep;
    document.getElementById("speed").textContent=Math.floor(speed*3);
    document.getElementById("score").textContent=Math.floor(score);
    camera.position.x+=(carPlayer.position.x-camera.position.x)*0.05;
    camera.lookAt(carPlayer.position.x,0.5,-5);
}

function draw(now){
    update(now);
    renderer.render(scene,camera);
    requestAnimationFrame(draw);
}
requestAnimationFrame(draw);