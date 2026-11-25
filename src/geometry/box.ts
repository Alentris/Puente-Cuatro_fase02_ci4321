import type { MeshData } from './types';


export function createBox(width: number, height: number, depth: number): MeshData {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;

  // Formato: x, y, z, nx, ny, nz, u, v
  const vertices = new Float32Array([
    // Frontal (z = +d)
    -w, -h,  d,  0,  0,  1,  0, 0,
     w, -h,  d,  0,  0,  1,  1, 0,
     w,  h,  d,  0,  0,  1,  1, 1,
    -w,  h,  d,  0,  0,  1,  0, 1,
    // Trasera (z = -d)
     w, -h, -d,  0,  0, -1,  0, 0,
    -w, -h, -d,  0,  0, -1,  1, 0,
    -w,  h, -d,  0,  0, -1,  1, 1,
     w,  h, -d,  0,  0, -1,  0, 1,
    // Superior (y = +h)
    -w,  h,  d,  0,  1,  0,  0, 0,
     w,  h,  d,  0,  1,  0,  1, 0,
     w,  h, -d,  0,  1,  0,  1, 1,
    -w,  h, -d,  0,  1,  0,  0, 1,
    // Inferior (y = -h)
    -w, -h, -d,  0, -1,  0,  0, 0,
     w, -h, -d,  0, -1,  0,  1, 0,
     w, -h,  d,  0, -1,  0,  1, 1,
    -w, -h,  d,  0, -1,  0,  0, 1,
    // Derecha (x = +w)
     w, -h,  d,  1,  0,  0,  0, 0,
     w, -h, -d,  1,  0,  0,  1, 0,
     w,  h, -d,  1,  0,  0,  1, 1,
     w,  h,  d,  1,  0,  0,  0, 1,
    // Izquierda (x = -w)
    -w, -h, -d, -1,  0,  0,  0, 0,
    -w, -h,  d, -1,  0,  0,  1, 0,
    -w,  h,  d, -1,  0,  0,  1, 1,
    -w,  h, -d, -1,  0,  0,  0, 1,
  ]);

  const indices = new Uint16Array([
     0,  1,  2,   0,  2,  3, // Frontal
     4,  5,  6,   4,  6,  7, // Trasera
     8,  9, 10,   8, 10, 11, // Superior
    12, 13, 14,  12, 14, 15, // Inferior
    16, 17, 18,  16, 18, 19, // Derecha
    20, 21, 22,  20, 22, 23, // Izquierda
  ]);

  return { vertices, indices };
}