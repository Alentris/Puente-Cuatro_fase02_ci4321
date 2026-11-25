import { mat4 } from 'gl-matrix';
import type { MeshData } from '../geometry/types.ts';

export interface Material {
  ambient: [number, number, number, number];
  diffuse: [number, number, number, number];
}

export interface SceneNode {
  name: string;
  position: [number, number, number];
  rotation: [number, number, number]; // radianes
  scale: [number, number, number];
  mesh: MeshData | null;
  material: Material | null;
  children: SceneNode[];
}

// Crea un nodo con valores por defecto o dados
export function createNode(
  name: string,
  options: Partial<Omit<SceneNode, 'name' | 'children'>> = {},
): SceneNode {
  return {
    name,
    position: options.position ?? [0, 0, 0],
    rotation: options.rotation ?? [0, 0, 0],
    scale: options.scale ?? [1, 1, 1],
    mesh: options.mesh ?? null,
    material: options.material ?? null,
    children: [],
  };
}

export function addChild(parent: SceneNode, child: SceneNode): void {
  parent.children.push(child);
}

// Construye la matriz local del nodo: T · Rx · Ry · Rz · S
export function buildLocalMatrix(out: mat4, node: SceneNode): mat4 {
  mat4.identity(out);
  mat4.translate(out, out, node.position);
  mat4.rotateX(out, out, node.rotation[0]);
  mat4.rotateY(out, out, node.rotation[1]);
  mat4.rotateZ(out, out, node.rotation[2]);
  mat4.scale(out, out, node.scale);
  return out;
}

export type NodeVisitor = (node: SceneNode, worldMatrix: mat4) => void;

// Recorre el árbol en pre-orden pasandole a cada visitante la matriz de mundo del nodo
export function traverse(root: SceneNode, visit: NodeVisitor): void {
  const identity = mat4.create();
  visitRecursive(root, identity, visit);
}

function visitRecursive(
  node: SceneNode,
  parentWorld: mat4,
  visit: NodeVisitor,
): void {
  const local = mat4.create();
  buildLocalMatrix(local, node);

  const world = mat4.create();
  mat4.multiply(world, parentWorld, local);

  visit(node, world);

  for (const child of node.children) {
    visitRecursive(child, world, visit);
  }
}

// Imprime el arbol con indentacion
export function printTree(node: SceneNode, indent: string = ''): void {
  const kind = node.mesh ? '[mesh]' : '[group]';
  const pos = node.position.map((v) => v.toFixed(2)).join(', ');
  console.log(`${indent}${node.name} ${kind} pos=(${pos})`);
  for (const child of node.children) {
    printTree(child, indent + '  ');
  }
}