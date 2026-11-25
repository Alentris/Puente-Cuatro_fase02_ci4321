import type { MeshData } from './types';

export function createCylinder(radius: number, height: number, segments: number): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];
  const h = height / 2;

  // Generamos anillos de abajo a arriba
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = Math.cos(theta);
    const z = Math.sin(theta);
    const u = i / segments; // U va de 0 a 1 alrededor del cilindro

    // Vértice de abajo (v = 0)
    vertices.push(x * radius, -h, z * radius, x, 0, z, u, 0);
    // Vértice de arriba (v = 1)
    vertices.push(x * radius,  h, z * radius, x, 0, z, u, 1);
  }

  // Índices para los triángulos laterales
  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(
      base, base + 1, base + 3, // Triángulo 1
      base, base + 3, base + 2  // Triángulo 2
    );
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}