export async function loadTexture(gl: WebGL2RenderingContext, url: string): Promise<WebGLTexture> {
  const image = new Image();
  image.src = url;
  await image.decode(); // Espera a que la imagen esté lista

  const texture = gl.createTexture();
  if (!texture) throw new Error('No se pudo crear la textura');

  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Voltea la imagen en el eje Y (V) para que las UVs coincidan
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Filtros y envoltura
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.generateMipmap(gl.TEXTURE_2D);

  return texture;
}