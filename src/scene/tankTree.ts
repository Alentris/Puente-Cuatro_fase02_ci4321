import { createNode, addChild, type SceneNode } from './sceneNode.ts';
import { BODY_HEIGHT, CANNON_LENGTH } from '../constants.ts';

// Nodos 
export interface TankTree {
  root: SceneNode;
  body: SceneNode;          
  turretPivot: SceneNode;
  turretSphere: SceneNode;  
  cannonPivot: SceneNode;
  cannonBarrel: SceneNode;  
  cannonTip: SceneNode;
  forceBars: SceneNode[];
}

export function buildTankTree(): TankTree {
  const root = createNode('tank');

  // Cuerpo
  const body = createNode('body', {
    position: [0, BODY_HEIGHT / 2, 0],
  });
  addChild(root, body);

  // Pivote de la torreta
  const turretPivot = createNode('turretPivot', {
    position: [0, BODY_HEIGHT / 2, 0],
  });
  addChild(body, turretPivot);

  // La esfera de la torreta 
  const turretSphere = createNode('turretSphere');
  addChild(turretPivot, turretSphere);

  // Pivote del cañón
  const cannonPivot = createNode('cannonPivot');
  addChild(turretPivot, cannonPivot);

  // Barril
  const cannonBarrel = createNode('cannonBarrel', {
    position: [0, CANNON_LENGTH / 2, 0],
  });
  addChild(cannonPivot, cannonBarrel);

  // Punta del cañon
  const cannonTip = createNode('cannonTip', {
    position: [0, CANNON_LENGTH, 0],
  });
  addChild(cannonPivot, cannonTip);

  // Barras del indicador de fuerza
  const forceBars: SceneNode[] = [];
  for (let i = 0; i < 3; i++) {
    const bar = createNode(`forceBar${i}`, {
      position: [0, -0.15 + i * 0.12, 0.42],  // derecha, altura, atrás
    });
    addChild(body, bar);
    forceBars.push(bar);
  }

  return { root, body, turretPivot, turretSphere, cannonPivot, cannonBarrel, cannonTip, forceBars };
}