import * as THREE from "https://unpkg.com/three@0.179.1/build/three.module.js";

const container = document.getElementById("skills-3d");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / 700,
    0.1,
    1000
);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true
});

renderer.setSize(container.clientWidth, 700);
renderer.setClearColor(0xf8f9fc);

container.appendChild(renderer.domElement);

// ====================
// LIGHT
// ====================

scene.add(new THREE.AmbientLight(0xffffff, 3));

const light = new THREE.DirectionalLight(0xffffff, 5);
light.position.set(10, 20, 10);
scene.add(light);

// ====================
// GRID
// ====================

const grid = new THREE.GridHelper(
    38,
    25,
    0x94a3b8,
    0xcbd5e1
);

scene.add(grid);

// ====================
// SKILLS
// ====================

const skills = [

{
    name:"Azure",
    level:9,
    detail:`
    <strong>Cloud Platform</strong><br><br>

    Certifications<br>
    • AZ-900<br>
    • SC-900<br><br>

    Focus Areas<br>
    • Entra ID<br>
    • Defender<br>
    • Conditional Access
    `
},

{
    name:"IAM",
    level:8,
    detail:`
    Identity & Access Management<br><br>

    • RBAC<br>
    • PIM<br>
    • Conditional Access<br>
    • MFA
    `
},

{
    name:"Security",
    level:9,
    detail:`
    • SOC<br>
    • SIEM<br>
    • Threat Detection<br>
    • Incident Response
    `
},

{
    name:"Privacy",
    level:7,
    detail:`
    • PIA<br>
    • Data Protection<br>
    • Compliance
    `
},

{
    name:"Cloud",
    level:8,
    detail:`
    Azure<br>
    Cloud Architecture<br>
    Security Design
    `
},

{
    name:"Python",
    level:6,
    detail:`
    Automation<br>
    Security Scripts<br>
    API Integration
    `
},

{
    name:"AI",
    level:6,
    detail:`
    Gemini API<br>
    Prompt Engineering<br>
    AI Security
    `
},

{
    name:"Network",
    level:7,
    detail:`
    TCP/IP<br>
    Routing<br>
    DNS
    `
},

{
    name:"Linux",
    level:7,
    detail:`
    Ubuntu<br>
    Bash<br>
    Server Management
    `
},

{
    name:"Docker",
    level:6,
    detail:`
    Containers<br>
    Deployment
    `
},

{
    name:"Entra ID",
    level:8,
    detail:`
    Identity Platform<br>
    User Lifecycle
    `
},

{
    name:"CSPM",
    level:7,
    detail:`
    Cloud Security Posture Management
    `
},

{
    name:"DevSecOps",
    level:5,
    detail:`
    Secure Pipelines<br>
    CI/CD Security
    `
},

{
    name:"SIEM",
    level:8,
    detail:`
    Log Analysis<br>
    Monitoring
    `
},

{
    name:"Terraform",
    level:5,
    detail:`
    Infrastructure as Code
    `
},

{
    name:"Research",
    level:8,
    detail:`
    Cloud Security Research<br>
    Privacy Research
    `
}

];

function createTextLabel(text) {

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = 512;
    canvas.height = 128;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1a2744";
    ctx.font = "bold 90px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(
        text,
        canvas.width / 2,
        canvas.height / 2
    );

    const texture =
        new THREE.CanvasTexture(canvas);

    texture.needsUpdate = true;

    const material =
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });

    const geometry =
        new THREE.PlaneGeometry(
            3.2,
            1.0
        );

    const plane =
        new THREE.Mesh(
            geometry,
            material
        );

    plane.rotation.x =
        -Math.PI / 2;

    return plane;
}

// ====================
// BARS
// ====================

const bars = [];
const skillGroup = new THREE.Group();
scene.add(skillGroup);

const cols = 4;
// 막대 그래프 간격 조정
const spacing = 5;

skills.forEach((skill, index) => {

    const row = Math.floor(index / cols);
    const col = index % cols;

    const x = (col - 1.5) * spacing;
    const z = (row - 1.5) * spacing;

    const geometry = new THREE.BoxGeometry(
        1.5,
        skill.level,
        1.5
    );

    const material =
        new THREE.MeshStandardMaterial({
            color: 0x3b82f6
        });

    const bar = new THREE.Mesh(
        geometry,
        material
    );

    bar.position.set(
        x,
        skill.level / 2,
        z
    );

    bar.userData = skill;

    skillGroup.add(bar);

    bars.push(bar);
    const textLabel =
    createTextLabel(
        skill.name
    );

    textLabel.position.set(
        x,
        0.05,
        z + 1.8
    );

    skillGroup.add(
        textLabel
    );
});

// ====================
// CAMERA
// ====================

camera.position.set(
    0,
    19,
    20
);

camera.lookAt(
    0,
    0,
    0
);

// ====================
// CLICK
// ====================

const raycaster =
    new THREE.Raycaster();

const mouse =
    new THREE.Vector2();

let selectedBar = null;

window.addEventListener(
    "click",
    event => {

        const rect =
            renderer.domElement
            .getBoundingClientRect();

        mouse.x =
            ((event.clientX - rect.left)
            / rect.width) * 2 - 1;

        mouse.y =
            -((event.clientY - rect.top)
            / rect.height) * 2 + 1;

        raycaster.setFromCamera(
            mouse,
            camera
        );

        const hits =
            raycaster.intersectObjects(
                bars
            );

        if (!hits.length) return;

        bars.forEach(bar => {

            bar.material.color.set(
                0x3b82f6
            );

        });

        const clickedBar =
            hits[0].object;

        clickedBar.material.color.set(
            0x1e40af
        );

        selectedBar =
            clickedBar;

        const skill =
            clickedBar.userData;

        document
            .getElementById(
                "skill-modal"
            )
            .style.display = "flex";

        document
            .getElementById(
                "skill-title"
            )
            .innerText =
                skill.name;

        document
            .getElementById(
                "skill-content"
            )
            .innerHTML =
                skill.detail;
    }
);

// ====================
// CLOSE MODAL
// ====================

document
.getElementById("close-modal")
.addEventListener(
    "click",
    () => {

        document
        .getElementById(
            "skill-modal"
        )
        .style.display = "none";

    }
);

// ====================
// DRAG ROTATE
// ====================

let isDragging = false;
let previousX = 0;

renderer.domElement
.addEventListener(
    "mousedown",
    e => {

        isDragging = true;
        previousX = e.clientX;

    }
);

window.addEventListener(
    "mouseup",
    () => {

        isDragging = false;

    }
);

window.addEventListener(
    "mousemove",
    e => {

        if (!isDragging) return;

        const delta =
            e.clientX - previousX;

        skillGroup.rotation.y +=
            delta * 0.01;
            
        previousX =
            e.clientX;

    }
);

// ====================
// RESIZE
// ====================

window.addEventListener(
    "resize",
    () => {

        camera.aspect =
            container.clientWidth / 700;

        camera.updateProjectionMatrix();

        renderer.setSize(
            container.clientWidth,
            600
        );

    }
);

// ====================
// ANIMATION
// ====================

function animate() {

    requestAnimationFrame(animate);

    // 자동 회전
    skillGroup.rotation.y += 0.001;

    renderer.render(
        scene,
        camera
    );
}

animate();
