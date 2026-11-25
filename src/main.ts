import './style.css';
import { mat3, mat4 } from 'gl-matrix';
import { ATTRIB, createFixedFunction, LIGHTING, TEXTURE_2D } from './vendor/ff/ff';
import type { MeshData } from './geometry/types';
import type { Material, SceneNode } from './scene/sceneNode';
import { traverse } from './scene/sceneNode';
import { buildTankTree } from './scene/tankTree.ts';
import {
  CANVAS_HEIGHT, CANVAS_WIDTH, CLEAR_COLOR,
  TABLE, TABLE_INDEX,
  NORMAL_OFFSET_BYTES, STRIDE_BYTES, UV_OFFSET_BYTES,
  BODY_HEIGHT, BODY_DEPTH,
  TURRET_RADIUS, CANNON_RADIUS, CANNON_LENGTH, BULLET_RADIUS,
  INITIAL_ELEVATION,
  BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH,
  FORCE_MULTIPLIERS,
  MIN_ELEVATION, MAX_ELEVATION, ELEVATION_SPEED,
  BASE_SPEED, GRAVITY,
  MOVE_SPEED, TURN_SPEED, TURRET_TURN_SPEED, MAX_TURRET_YAW,
  ARENA_MIN_X, ARENA_MAX_X, ARENA_MIN_Z, ARENA_MAX_Z,
} from './constants';
import { createBox } from './geometry/box';
import { createCylinder } from './geometry/cylinder';
import { createSphere } from './geometry/sphere';
import { loadTexture } from './textures/loadTexture';

type FF = ReturnType<typeof createFixedFunction>;
const MAX_DT = 0.1;

let texBody: WebGLTexture;
let texGround: WebGLTexture;

let gl: WebGL2RenderingContext;
let ff: FF;

//Estado del juego
const state = {
  bodyPos: [0, 0] as [number, number],
  bodyYaw: 0,
  turretYaw: 0,
  elev: INITIAL_ELEVATION,
  force: 1,
  bullet: {
    status: 'ready' as 'ready' | 'flying',
    pos: [0, 0, 0] as [number, number, number],
    vel: [0, 0, 0] as [number, number, number],
  },
};

const objectives: { pos: [number, number, number]; alive: boolean }[] = [
  { pos: [-2.0, 1.9,  -8.0], alive: true },
  { pos: [ 0.5, 3.7, -15.5], alive: true },
  { pos: [ 2.5, 1.3,  -4.5], alive: true },
];

// Materiales
const MAT_BODY:      Material = { ambient: [0.15, 0.25, 0.10, 1], diffuse: [0.35, 0.55, 0.20, 1] };
const MAT_TURRET:    Material = { ambient: [0.12, 0.20, 0.08, 1], diffuse: [0.30, 0.50, 0.18, 1] };
const MAT_CANNON:    Material = { ambient: [0.10, 0.10, 0.10, 1], diffuse: [0.25, 0.25, 0.25, 1] };
const MAT_BULLET:    Material = { ambient: [0.02, 0.02, 0.02, 1], diffuse: [0.05, 0.05, 0.05, 1] };
const MAT_GROUND:    Material = { ambient: [0.20, 0.15, 0.10, 1], diffuse: [0.55, 0.45, 0.30, 1] };
const MAT_OBJECTIVE: Material = { ambient: [0.30, 0.05, 0.05, 1], diffuse: [0.85, 0.20, 0.20, 1] };
const MAT_BAR_ON:    Material = { ambient: [0.10, 0.40, 0.10, 1], diffuse: [0.20, 0.90, 0.20, 1] };
const MAT_BAR_OFF:   Material = { ambient: [0.05, 0.10, 0.05, 1], diffuse: [0.10, 0.20, 0.10, 1] };

// Construimos el arbol
const tank = buildTankTree();

interface MeshBundle { vao: WebGLVertexArrayObject; indexCount: number; }
const meshRegistry = new Map<MeshData, MeshBundle>();

// Meshes
let bodyMesh: MeshData;
let turretMesh: MeshData;
let cannonMesh: MeshData;
let barMesh: MeshData;
let bulletMesh: MeshData;
let objectiveMesh: MeshData;
let groundMesh: MeshData;

// Audio gracioso
const FAH = new Audio('/src/FAH.m4a');

// Entrada 
const keys = {
  forward: false, backward: false,
  rotateLeft: false, rotateRight: false,
  turretLeft: false, turretRight: false,
  elevateUp: false, elevateDown: false,
};
const KEYMAP: Record<string, keyof typeof keys> = {
  KeyW: 'forward',   KeyS: 'backward',
  KeyA: 'rotateLeft', KeyD: 'rotateRight',
  ArrowLeft: 'turretLeft', ArrowRight: 'turretRight',
  ArrowUp: 'elevateUp',    ArrowDown: 'elevateDown',
};

window.addEventListener('keydown', (e) => {
  const action = KEYMAP[e.code];
  if (action) { keys[action] = true; e.preventDefault(); return; }
  if (e.repeat) return;
  switch (e.code) {
    case 'Space':  fireBullet(); e.preventDefault(); break;
    case 'Digit1': state.force = 1; break;
    case 'Digit2': state.force = 2; break;
    case 'Digit3': state.force = 3; break;
    case 'KeyF':   state.force = (state.force % 3) + 1; break;
    case 'KeyR':   resetGame(); break;
  }
});
window.addEventListener('keyup', (e) => {
  const action = KEYMAP[e.code];
  if (action) { keys[action] = false; e.preventDefault(); }
});

// Helpers de disparo
function getCannonDirection(): [number, number, number] {
  const totalYaw = state.bodyYaw + state.turretYaw;
  const cosElev = Math.cos(state.elev);
  return [
    -cosElev * Math.sin(totalYaw),
     Math.sin(state.elev),
    -cosElev * Math.cos(totalYaw),
  ];
}
function getCannonTipWorld(): [number, number, number] {
  const totalYaw = state.bodyYaw + state.turretYaw;
  const cosElev = Math.cos(state.elev);
  const L = CANNON_LENGTH;
  return [
    state.bodyPos[0] - L * cosElev * Math.sin(totalYaw),
    BODY_HEIGHT + L * Math.sin(state.elev),
    state.bodyPos[1] - L * cosElev * Math.cos(totalYaw),
  ];
}
function fireBullet(): void {
  if (state.bullet.status !== 'ready') return;
  const speed = BASE_SPEED * FORCE_MULTIPLIERS[state.force - 1];
  const dir = getCannonDirection();
  const tip = getCannonTipWorld();
  state.bullet.pos = [tip[0], tip[1], tip[2]];
  state.bullet.vel = [dir[0] * speed, dir[1] * speed, dir[2] * speed];
  state.bullet.status = 'flying';
}
function resetGame(): void {
  state.bodyPos = [0, 0];
  state.bodyYaw = 0;
  state.turretYaw = 0;
  state.elev = INITIAL_ELEVATION;
  state.force = 1;
  state.bullet.status = 'ready';
  state.bullet.pos = [0, 0, 0];
  state.bullet.vel = [0, 0, 0];
  for (const obj of objectives) obj.alive = true;
}

// Update
function update(dt: number): void {
  const forwardX = -Math.sin(state.bodyYaw);
  const forwardZ = -Math.cos(state.bodyYaw);

  let move = 0;
  if (keys.forward)  move += 1;
  if (keys.backward) move -= 1;
  state.bodyPos[0] += forwardX * move * MOVE_SPEED * dt;
  state.bodyPos[1] += forwardZ * move * MOVE_SPEED * dt;

  let turn = 0;
  if (keys.rotateLeft)  turn += 1;
  if (keys.rotateRight) turn -= 1;
  state.bodyYaw += turn * TURN_SPEED * dt;

  let turretTurn = 0;
  if (keys.turretLeft)  turretTurn += 1;
  if (keys.turretRight) turretTurn -= 1;
  state.turretYaw += turretTurn * TURRET_TURN_SPEED * dt;
  state.turretYaw = Math.max(-MAX_TURRET_YAW, Math.min(MAX_TURRET_YAW, state.turretYaw));

  let de = 0;
  if (keys.elevateUp)   de += 1;
  if (keys.elevateDown) de -= 1;
  state.elev += de * ELEVATION_SPEED * dt;
  state.elev = Math.max(MIN_ELEVATION, Math.min(MAX_ELEVATION, state.elev));

  state.bodyPos[0] = Math.max(ARENA_MIN_X, Math.min(ARENA_MAX_X, state.bodyPos[0]));
  state.bodyPos[1] = Math.max(ARENA_MIN_Z, Math.min(ARENA_MAX_Z, state.bodyPos[1]));

  if (state.bullet.status === 'ready') {
    const tip = getCannonTipWorld();
    state.bullet.pos[0] = tip[0];
    state.bullet.pos[1] = tip[1];
    state.bullet.pos[2] = tip[2];
  } else {
    state.bullet.vel[1] -= GRAVITY * dt;
    state.bullet.pos[0] += state.bullet.vel[0] * dt;
    state.bullet.pos[1] += state.bullet.vel[1] * dt;
    state.bullet.pos[2] += state.bullet.vel[2] * dt;

    for (const obj of objectives) {
      if (!obj.alive) continue;
      const dx = state.bullet.pos[0] - obj.pos[0];
      const dy = state.bullet.pos[1] - obj.pos[1];
      const dz = state.bullet.pos[2] - obj.pos[2];
      const collisionDist = BULLET_RADIUS + 0.5;
      if (dx * dx + dy * dy + dz * dz <= collisionDist * collisionDist) {
        obj.alive = false;
        state.bullet.status = 'ready';
        break;
      }
    }

    if (state.bullet.status === 'flying' && state.bullet.pos[1] <= BULLET_RADIUS) {
      state.bullet.pos[1] = BULLET_RADIUS;
      state.bullet.status = 'ready';
      FAH.play().catch((err) => console.warn('Audio bloqueado:', err));
    }
  }
}

function updateTreeFromState(): void {
  tank.root.position = [state.bodyPos[0], 0, state.bodyPos[1]];
  tank.root.rotation = [0, state.bodyYaw, 0];
  tank.turretPivot.rotation = [0, state.turretYaw, 0];
  tank.cannonPivot.rotation = [state.elev - Math.PI / 2, 0, 0];
  for (let i = 0; i < tank.forceBars.length; i++) {
    tank.forceBars[i].material = i < state.force ? MAT_BAR_ON : MAT_BAR_OFF;
  }
}

//Render
const tmpModel  = mat4.create();
const tmpNormal = mat3.create();

function registerMesh(mesh: MeshData): void {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('createVertexArray failed');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('createBuffer failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('createBuffer failed');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(ATTRIB.POSITION);
  gl.vertexAttribPointer(ATTRIB.POSITION, 3, gl.FLOAT, false, STRIDE_BYTES, 0);
  gl.enableVertexAttribArray(ATTRIB.NORMAL);
  gl.vertexAttribPointer(ATTRIB.NORMAL, 3, gl.FLOAT, false, STRIDE_BYTES, NORMAL_OFFSET_BYTES);
  gl.enableVertexAttribArray(ATTRIB.UV);
  gl.vertexAttribPointer(ATTRIB.UV, 2, gl.FLOAT, false, STRIDE_BYTES, UV_OFFSET_BYTES);

  gl.bindVertexArray(null);
  meshRegistry.set(mesh, { vao, indexCount: mesh.indices.length });
}

function drawNode(node: SceneNode, world: mat4, texture: WebGLTexture | null = null): void {
  if (!node.mesh || !node.material) return;
  const bundle = meshRegistry.get(node.mesh);
  if (!bundle) return;

  if (texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    ff.enable(TEXTURE_2D);
  } else {
    ff.disable(TEXTURE_2D);
  }

  ff.setMaterial(node.material);
  ff.setModelMatrix(world);
  mat3.normalFromMat4(tmpNormal, world);
  ff.setNormalMatrix(tmpNormal);

  gl.bindVertexArray(bundle.vao);
  ff.drawElements(gl.TRIANGLES, bundle.indexCount, gl.UNSIGNED_SHORT, 0);
}

function drawMeshAt(mesh: MeshData, material: Material, pos: [number, number, number], texture: WebGLTexture | null = null): void {
  const bundle = meshRegistry.get(mesh);
  if (!bundle) return;

  if (texture) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    ff.enable(TEXTURE_2D);
  } else {
    ff.disable(TEXTURE_2D);
  }

  mat4.identity(tmpModel);
  mat4.translate(tmpModel, tmpModel, pos);
  ff.setMaterial(material);
  ff.setModelMatrix(tmpModel);
  mat3.normalFromMat4(tmpNormal, tmpModel);
  ff.setNormalMatrix(tmpNormal);

  gl.bindVertexArray(bundle.vao);
  ff.drawElements(gl.TRIANGLES, bundle.indexCount, gl.UNSIGNED_SHORT, 0);
}

function render(): void {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  
  // Suelo texturizado
  drawMeshAt(groundMesh, MAT_GROUND, [0, 0, 0], texGround);
  
  // Objetivos
  for (const obj of objectives) {
    if (!obj.alive) continue;
    drawMeshAt(objectiveMesh, MAT_OBJECTIVE, obj.pos, null); // null = sin textura, solo color
  }

  // Tanque (pasamos texBody a las partes que queramos texturizar)
  traverse(tank.root, (node, world) => {
    // Solo texturizamos el cuerpo y la torreta
    const tex = (node === tank.body || node === tank.turretSphere) ? texBody : null;
    drawNode(node, world, tex);
  });

  // Bala
  drawMeshAt(bulletMesh, MAT_BULLET, state.bullet.pos, null);
}

// Setup 
function getContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const ctx = canvas.getContext('webgl2');
  if (!ctx) throw new Error('WebGL2 is not available.');
  return ctx;
}

function setupState(canvas: HTMLCanvasElement): void {
  canvas.width  = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(...CLEAR_COLOR);
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
}

function setupScene(): void {
  ff.enable(LIGHTING);
  ff.setGlobalAmbient([0.2, 0.2, 0.2, 1]);
  ff.setLight(0, { position: [1, 1, 0.5, 0], diffuse: [1, 1, 1, 1] });
  ff.enableLight(0);

  const view = mat4.lookAt(mat4.create(), [0, 2.0, 4], [0, 1.0, -4.0], [0, 1, 0]);
  ff.setViewMatrix(view);

  const projection = mat4.perspective(
    mat4.create(), Math.PI / 4, CANVAS_WIDTH / CANVAS_HEIGHT, 0.1, 100,
  );
  ff.setProjectionMatrix(projection);
}

function setupMeshes(): void {
  bodyMesh      = createBox(1.0, BODY_HEIGHT, BODY_DEPTH);
  turretMesh    = createSphere(TURRET_RADIUS, 24, 32);
  cannonMesh    = createCylinder(CANNON_RADIUS, CANNON_LENGTH, 15);
  barMesh       = createBox(BAR_WIDTH, BAR_HEIGHT, BAR_DEPTH);
  bulletMesh    = createSphere(BULLET_RADIUS, 16, 24);
  objectiveMesh = createSphere(0.5, 24, 32);
  groundMesh    = { vertices: TABLE, indices: TABLE_INDEX };

  [bodyMesh, turretMesh, cannonMesh, barMesh, bulletMesh, objectiveMesh, groundMesh]
    .forEach(registerMesh);

  // Conectar meshes y materiales al arbol del tanque
  tank.body.mesh = bodyMesh;
  tank.body.material = MAT_BODY;
  tank.turretSphere.mesh = turretMesh;
  tank.turretSphere.material = MAT_TURRET;
  tank.cannonBarrel.mesh = cannonMesh;
  tank.cannonBarrel.material = MAT_CANNON;
  tank.forceBars.forEach((bar) => { bar.mesh = barMesh; });
}

async function run(canvas: HTMLCanvasElement): Promise<void>  {
  gl = getContext(canvas);
  ff = createFixedFunction(gl, { debug: true });

  setupState(canvas);
  setupScene();
  setupMeshes();

  // Cargamos imagenes
  texBody   = await loadTexture(gl, '/textures/metal.png');
  texGround = await loadTexture(gl, '/textures/floor.png');

  let last: number | null = null;
  function frame(now: number): void {
    if (last === null) last = now;
    const dt = Math.min((now - last) / 1000, MAX_DT);
    last = now;

    update(dt);
    updateTreeFromState();
    render();

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Bootstrap
const canvas = document.createElement('canvas');
document.getElementById('stage')!.append(canvas);
run(canvas).catch(console.error);