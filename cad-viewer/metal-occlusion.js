// View-space ambient occlusion for real mesh recesses. Keep the sampling
// contract in step with WebCAD: eight directions, two rings, one horizon/direction.
export const METAL_OCCLUSION_PROFILE = Object.freeze({
  radiusRatio: 0.035, angleBias: 0.06, strength: 1.5, minimumVisibility: 0.42,
});

export const metalOcclusionShader = `
uniform sampler2D uOcclusionDepth;
uniform vec2 uOcclusionViewport;
uniform vec2 uOcclusionProjection;
uniform float uOcclusionFar;
uniform float uOcclusionRadius;
uniform float uOcclusionReady;
float recessSample(vec2 uv, vec3 normal, float radius) {
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return 0.0;
  vec4 depthTexel = texture2D(uOcclusionDepth, uv);
  if (depthTexel.a < 0.5) return 0.0;
  float depth = dot(depthTexel.rgb, vec3(1.0, 1.0 / 255.0, 1.0 / 65025.0)) * uOcclusionFar;
  vec3 samplePosition = vec3((uv * 2.0 - 1.0) * depth / uOcclusionProjection, -depth);
  vec3 delta = samplePosition - vViewPosition;
  float distanceToSample = length(delta);
  if (distanceToSample < radius * 0.002 || distanceToSample >= radius) return 0.0;
  float aboveSurface = dot(normal, delta / distanceToSample);
  float horizon = max(aboveSurface - 0.06, 0.0);
  float falloff = 1.0 - smoothstep(radius * 0.25, radius, distanceToSample);
  return horizon * falloff;
}
float metalOcclusion(vec3 normal) {
  if (uOcclusionReady < 0.5) return 1.0;
  vec2 uv = gl_FragCoord.xy / uOcclusionViewport;
  float viewDepth = max(-vViewPosition.z, 0.0001);
  float worldPerPixel = 2.0 * viewDepth / (uOcclusionProjection.y * uOcclusionViewport.y);
  float radiusPixels = clamp(uOcclusionRadius / worldPerPixel, 2.0, 32.0);
  float radius = radiusPixels * worldPerPixel;
  float occlusion = 0.0;
  for (int directionIndex = 0; directionIndex < 8; directionIndex++) {
    float angle = float(directionIndex) * 0.78539816339;
    vec2 offset = vec2(cos(angle), sin(angle)) * radiusPixels / uOcclusionViewport;
    float inner = recessSample(uv + offset * 0.3, normal, radius);
    float outer = recessSample(uv + offset * 0.9, normal, radius);
    occlusion += max(inner, outer);
  }
  return clamp(1.0 - 1.5 * occlusion / 8.0, 0.42, 1.0);
}`;

export class MetalOcclusionDepth {
  constructor(gl, compileShader) {
    this.gl = gl;
    this.width = 0;
    this.height = 0;
    this.available = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision > 0;
    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // A complete, empty texture also keeps the fallback shader sampler valid.
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
    if (!this.available) return;
    const vertex = compileShader(gl, gl.VERTEX_SHADER, `
      attribute vec3 aPosition;
      uniform mat4 uProjection, uView, uModel;
      varying highp float vDepth;
      void main() {
        vec4 viewPosition = uView * uModel * vec4(aPosition, 1.0);
        vDepth = -viewPosition.z;
        gl_Position = uProjection * viewPosition;
      }`);
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, `
      precision highp float;
      varying highp float vDepth;
      uniform float uFar;
      void main() {
        vec3 encodedDepth = fract(clamp(vDepth / uFar, 0.0, 0.999999) * vec3(1.0, 255.0, 65025.0));
        encodedDepth -= encodedDepth.yzz * vec3(1.0 / 255.0, 1.0 / 255.0, 0.0);
        gl_FragColor = vec4(encodedDepth, 1.0);
      }`);
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertex);
    gl.attachShader(this.program, fragment);
    gl.linkProgram(this.program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('WebGL occlusion depth program: ' + gl.getProgramInfoLog(this.program));
    }
    this.locations = {
      position: gl.getAttribLocation(this.program, 'aPosition'),
      projection: gl.getUniformLocation(this.program, 'uProjection'),
      view: gl.getUniformLocation(this.program, 'uView'),
      model: gl.getUniformLocation(this.program, 'uModel'),
      far: gl.getUniformLocation(this.program, 'uFar'),
    };
    this.framebuffer = gl.createFramebuffer();
    this.depthbuffer = gl.createRenderbuffer();
  }

  draw({ width, height, projection, view, model, far, positionBuffer, vertexCount }) {
    if (!this.available) return false;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    if (this.width !== width || this.height !== height) {
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);
      gl.bindRenderbuffer(gl.RENDERBUFFER, this.depthbuffer);
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.depthbuffer);
      this.width = width;
      this.height = height;
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
        this.available = false;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return false;
      }
    }
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.locations.projection, false, projection);
    gl.uniformMatrix4fv(this.locations.view, false, view);
    gl.uniformMatrix4fv(this.locations.model, false, model);
    gl.uniform1f(this.locations.far, far);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return true;
  }

  destroy() {
    const gl = this.gl;
    gl.deleteTexture(this.texture);
    if (this.program) gl.deleteProgram(this.program);
    if (this.framebuffer) gl.deleteFramebuffer(this.framebuffer);
    if (this.depthbuffer) gl.deleteRenderbuffer(this.depthbuffer);
  }
}
