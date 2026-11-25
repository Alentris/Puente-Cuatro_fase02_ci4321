import type { MeshData } from './types';

export function createSphere(radius: number, latSegments: number, lonSegments: number): MeshData {
  const vertices: number[] = [];
  const indices: number[] = [];

  // Generamos la cuadrícula de latitud/longitud
  for (let lat = 0; lat <= latSegments; lat++) {
    const phi = (lat / latSegments) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    const v = lat / latSegments; // V va de 0 (polo norte) a 1 (polo sur)

    for (let lon = 0; lon <= lonSegments; lon++) {
      const theta = (lon / lonSegments) * Math.PI * 2;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      const u = lon / lonSegments; // U va de 0 a 1 alrededor del ecuador

      const x = sinPhi * cosTheta;
      const y = cosPhi;
      const z = sinPhi * sinTheta;

      vertices.push(
        x * radius, y * radius, z * radius, // Posición
        x, y, z,                            // Normal
        u, v                                // UV
      );
    }
  }

  // Índices
  const rowSize = lonSegments + 1;
  for (let lat = 0; lat < latSegments; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const first = lat * rowSize + lon;
      const second = first + rowSize;

      // Evitamos triángulos degenerados en los polos
      if (lat !== 0) {
        // Antes: (first, second, first + 1)
        indices.push(first, first + 1, second); 
      }
      if (lat !== latSegments - 1) {
      // Este ya estaba bien (CCW)
        indices.push(first + 1, second + 1, second); 
      }
    }
  }

  return {
    vertices: new Float32Array(vertices),
    indices: new Uint16Array(indices),
  };
}