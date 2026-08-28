const DEFAULT_MODEL_COLOR = [0.36, 0.65, 0.93];

function fail(message) {
  throw new Error(message);
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeVector(x, y, z) {
  const length = Math.hypot(x, y, z);
  return length < 1e-12 ? [0, 0, 1] : [x / length, y / length, z / length];
}

function faceNormal(a, b, c) {
  const ux = b[0] - a[0];
  const uy = b[1] - a[1];
  const uz = b[2] - a[2];
  const vx = c[0] - a[0];
  const vy = c[1] - a[1];
  const vz = c[2] - a[2];
  return normalizeVector(
    uy * vz - uz * vy,
    uz * vx - ux * vz,
    ux * vy - uy * vx,
  );
}

function normalizeColor(value, fallback = DEFAULT_MODEL_COLOR) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) return fallback;
  const color = [Number(value[0]), Number(value[1]), Number(value[2])];
  if (color.some((component) => !Number.isFinite(component))) return fallback;
  const divisor = Math.max(...color) > 1 ? 255 : 1;
  return color.map((component) => clamp(component / divisor, 0, 1));
}

function hexToRgb(hex) {
  let text = String(hex || '#090b0e').replace('#', '');
  if (text.length === 3) {
    text = text[0] + text[0] + text[1] + text[1] + text[2] + text[2];
  }
  const value = Number.parseInt(text, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function mat4Multiply(a, b) {
  const output = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      output[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return output;
}

function mat4Translation(x, y, z) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ]);
}

function mat4RotationX(angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new Float32Array([
    1, 0, 0, 0,
    0, cosine, sine, 0,
    0, -sine, cosine, 0,
    0, 0, 0, 1,
  ]);
}

function mat4RotationY(angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return new Float32Array([
    cosine, 0, -sine, 0,
    0, 1, 0, 0,
    sine, 0, cosine, 0,
    0, 0, 0, 1,
  ]);
}

function mat4Perspective(fieldOfView, aspect, near, far) {
  const focalLength = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    focalLength / aspect, 0, 0, 0,
    0, focalLength, 0, 0,
    0, 0, (far + near) * range, -1,
    0, 0, 2 * far * near * range, 0,
  ]);
}

function finalizeGeometry(rawPositions, rawNormals, rawColors, format) {
  if (!rawPositions.length || rawPositions.length % 9 !== 0) {
    fail('文件中没有可显示的三角面。');
  }
  if (rawNormals.length !== rawPositions.length) {
    fail('模型法线数据不完整。');
  }

  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];
  for (let index = 0; index < rawPositions.length; index += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = Number(rawPositions[index + axis]);
      if (!Number.isFinite(value)) fail('模型包含无效坐标。');
      minimum[axis] = Math.min(minimum[axis], value);
      maximum[axis] = Math.max(maximum[axis], value);
    }
  }

  const center = [
    (minimum[0] + maximum[0]) / 2,
    (minimum[1] + maximum[1]) / 2,
    (minimum[2] + maximum[2]) / 2,
  ];
  const dimensions = {
    x: maximum[0] - minimum[0],
    y: maximum[1] - minimum[1],
    z: maximum[2] - minimum[2],
  };
  const positions = new Float32Array(rawPositions.length);
  const normals = new Float32Array(rawNormals);
  const colors = new Float32Array(rawPositions.length);
  const useInputColors = rawColors && rawColors.length === rawPositions.length;

  for (let index = 0; index < rawPositions.length; index += 3) {
    positions[index] = rawPositions[index] - center[0];
    positions[index + 1] = rawPositions[index + 1] - center[1];
    positions[index + 2] = rawPositions[index + 2] - center[2];
    const color = useInputColors
      ? [rawColors[index], rawColors[index + 1], rawColors[index + 2]]
      : DEFAULT_MODEL_COLOR;
    colors[index] = color[0];
    colors[index + 1] = color[1];
    colors[index + 2] = color[2];
  }

  return {
    positions,
    normals,
    colors,
    triangles: positions.length / 9,
    dimensions,
    radius: Math.max(Math.hypot(dimensions.x, dimensions.y, dimensions.z) / 2, 0.001),
    format,
  };
}

function parseBinaryStl(buffer, faceCount) {
  const view = new DataView(buffer);
  const positions = new Float32Array(faceCount * 9);
  const normals = new Float32Array(faceCount * 9);
  let sourceOffset = 84;
  let targetOffset = 0;

  for (let face = 0; face < faceCount; face += 1) {
    let normal = [
      view.getFloat32(sourceOffset, true),
      view.getFloat32(sourceOffset + 4, true),
      view.getFloat32(sourceOffset + 8, true),
    ];
    sourceOffset += 12;
    const vertices = [];
    for (let vertex = 0; vertex < 3; vertex += 1) {
      vertices.push([
        view.getFloat32(sourceOffset, true),
        view.getFloat32(sourceOffset + 4, true),
        view.getFloat32(sourceOffset + 8, true),
      ]);
      sourceOffset += 12;
    }
    sourceOffset += 2;
    normal = Math.hypot(...normal) < 1e-12
      ? faceNormal(vertices[0], vertices[1], vertices[2])
      : normalizeVector(...normal);
    for (const vertex of vertices) {
      positions.set(vertex, targetOffset);
      normals.set(normal, targetOffset);
      targetOffset += 3;
    }
  }
  return finalizeGeometry(positions, normals, null, 'Binary STL');
}

function parseAsciiStl(buffer) {
  const text = new TextDecoder('utf-8').decode(buffer);
  const positions = [];
  const normals = [];
  let vertices = [];
  let normal;

  for (const line of text.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] === 'facet' && parts[1] === 'normal') {
      normal = [Number.parseFloat(parts[2]), Number.parseFloat(parts[3]), Number.parseFloat(parts[4])];
    } else if (parts[0] === 'vertex' && parts.length >= 4) {
      vertices.push([Number.parseFloat(parts[1]), Number.parseFloat(parts[2]), Number.parseFloat(parts[3])]);
      if (vertices.length === 3) {
        const validNormal = normal && normal.every(Number.isFinite);
        const triangleNormal = validNormal ? normalizeVector(...normal) : faceNormal(...vertices);
        for (const vertex of vertices) {
          positions.push(...vertex);
          normals.push(...triangleNormal);
        }
        vertices = [];
      }
    }
  }
  return finalizeGeometry(positions, normals, null, 'ASCII STL');
}

export function parseStl(buffer) {
  if (!(buffer instanceof ArrayBuffer)) fail('STL 数据必须是 ArrayBuffer。');
  if (buffer.byteLength < 15) fail('文件过小，不是有效的 STL。');

  let isBinary = false;
  let faceCount = 0;
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer);
    faceCount = view.getUint32(80, true);
    const expectedSize = 84 + faceCount * 50;
    const header = new TextDecoder('ascii')
      .decode(buffer.slice(0, Math.min(80, buffer.byteLength)))
      .trim()
      .toLowerCase();
    isBinary = faceCount > 0 && expectedSize <= buffer.byteLength &&
      (expectedSize === buffer.byteLength || !header.startsWith('solid'));
  }
  return isBinary ? parseBinaryStl(buffer, faceCount) : parseAsciiStl(buffer);
}

function geometryFromOcctResult(result, format) {
  if (!result || result.success !== true || !Array.isArray(result.meshes)) {
    fail(result && result.error ? String(result.error) : 'OpenCascade 无法解析此模型。');
  }

  let triangleCount = 0;
  for (const mesh of result.meshes) {
    const indices = mesh && mesh.index && mesh.index.array;
    if (indices) triangleCount += Math.floor(indices.length / 3);
  }
  if (!triangleCount) fail('文件中没有可显示的实体网格。');

  const positions = new Float32Array(triangleCount * 9);
  const normals = new Float32Array(triangleCount * 9);
  const colors = new Float32Array(triangleCount * 9);
  let outputOffset = 0;

  for (const mesh of result.meshes) {
    const sourcePositions = mesh && mesh.attributes && mesh.attributes.position && mesh.attributes.position.array;
    const sourceNormals = mesh && mesh.attributes && mesh.attributes.normal && mesh.attributes.normal.array;
    const indices = mesh && mesh.index && mesh.index.array;
    if (!sourcePositions || !indices) continue;

    const defaultColor = normalizeColor(mesh.color);
    const faces = Array.isArray(mesh.brep_faces) ? mesh.brep_faces : [];
    let faceCursor = 0;
    for (let triangle = 0; triangle < Math.floor(indices.length / 3); triangle += 1) {
      while (faceCursor < faces.length && triangle > faces[faceCursor].last) faceCursor += 1;
      const face = faceCursor < faces.length &&
        triangle >= faces[faceCursor].first &&
        triangle <= faces[faceCursor].last
        ? faces[faceCursor]
        : null;
      const color = normalizeColor(face && face.color, defaultColor);
      const triangleVertices = [];
      for (let corner = 0; corner < 3; corner += 1) {
        const vertexIndex = Number(indices[triangle * 3 + corner]);
        const sourceOffset = vertexIndex * 3;
        const vertex = [
          Number(sourcePositions[sourceOffset]),
          Number(sourcePositions[sourceOffset + 1]),
          Number(sourcePositions[sourceOffset + 2]),
        ];
        triangleVertices.push(vertex);
        positions.set(vertex, outputOffset + corner * 3);
        colors.set(color, outputOffset + corner * 3);
        if (sourceNormals && sourceNormals.length >= sourceOffset + 3) {
          normals.set([
            Number(sourceNormals[sourceOffset]),
            Number(sourceNormals[sourceOffset + 1]),
            Number(sourceNormals[sourceOffset + 2]),
          ], outputOffset + corner * 3);
        }
      }
      if (!sourceNormals) {
        const normal = faceNormal(...triangleVertices);
        normals.set(normal, outputOffset);
        normals.set(normal, outputOffset + 3);
        normals.set(normal, outputOffset + 6);
      }
      outputOffset += 9;
    }
  }

  return finalizeGeometry(
    positions.subarray(0, outputOffset),
    normals.subarray(0, outputOffset),
    colors.subarray(0, outputOffset),
    format,
  );
}

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    fail('WebGL 着色器编译失败：' + message);
  }
  return shader;
}

function createProgram(gl) {
  const vertexSource = [
    'attribute vec3 aPosition;',
    'attribute vec3 aNormal;',
    'attribute vec3 aColor;',
    'uniform mat4 uProjection;',
    'uniform mat4 uView;',
    'uniform mat4 uModel;',
    'uniform mat3 uNormalMatrix;',
    'varying vec3 vNormal;',
    'varying vec3 vColor;',
    'void main(void) {',
    '  vNormal = normalize(uNormalMatrix * aNormal);',
    '  vColor = aColor;',
    '  gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);',
    '}',
  ].join('\n');
  const fragmentSource = [
    'precision mediump float;',
    'varying vec3 vNormal;',
    'varying vec3 vColor;',
    'void main(void) {',
    '  vec3 normal = normalize(vNormal);',
    '  vec3 keyLight = normalize(vec3(0.45, 0.78, 0.55));',
    '  vec3 fillLight = normalize(vec3(-0.65, 0.15, -0.35));',
    '  float diffuse = max(dot(normal, keyLight), 0.0);',
    '  float fill = max(dot(normal, fillLight), 0.0);',
    '  float hemisphere = normal.y * 0.5 + 0.5;',
    '  float brightness = 0.24 + 0.58 * diffuse + 0.14 * fill + 0.12 * hemisphere;',
    '  gl_FragColor = vec4(vColor * brightness, 1.0);',
    '}',
  ].join('\n');

  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    fail('WebGL 程序链接失败：' + gl.getProgramInfoLog(program));
  }
  return program;
}

export class ModelViewer3D {
  constructor(canvas, options = {}) {
    if (!canvas) fail('缺少三维查看画布。');
    this.canvas = canvas;
    this.options = options;
    this.zoomWindow = options.zoomWindow;
    this.background = options.background || '#090b0e';
    this.visible = false;
    this.enabled = false;
    this.geometry = null;
    this.mode = 'pan';
    this.yaw = -Math.PI / 4;
    this.pitch = Math.PI / 7;
    this.distance = 10;
    this.panX = 0;
    this.panY = 0;
    this.fieldOfView = Math.PI / 4;
    this.drag = null;
    this.zoomStart = null;
    this.touchPointers = new Map();
    this.pinch = null;
    this.needsDraw = true;
    this.importWorker = null;
    this.importReject = null;
    this.importTimer = null;

    this.gl = canvas.getContext('webgl', {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
    });
    if (!this.gl) fail('当前浏览器或显卡不支持 WebGL。');

    this.program = createProgram(this.gl);
    this.positionBuffer = this.gl.createBuffer();
    this.normalBuffer = this.gl.createBuffer();
    this.colorBuffer = this.gl.createBuffer();
    this.locations = {
      position: this.gl.getAttribLocation(this.program, 'aPosition'),
      normal: this.gl.getAttribLocation(this.program, 'aNormal'),
      color: this.gl.getAttribLocation(this.program, 'aColor'),
      projection: this.gl.getUniformLocation(this.program, 'uProjection'),
      view: this.gl.getUniformLocation(this.program, 'uView'),
      model: this.gl.getUniformLocation(this.program, 'uModel'),
      normalMatrix: this.gl.getUniformLocation(this.program, 'uNormalMatrix'),
    };
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  bindEvents() {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('wheel', (event) => this.onWheel(event), { passive: false });
    this.canvas.addEventListener('pointerdown', (event) => this.onPointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.onPointerMove(event));
    this.canvas.addEventListener('pointerup', (event) => this.onPointerUp(event));
    this.canvas.addEventListener('pointercancel', (event) => this.onPointerUp(event));
    this.canvas.addEventListener('dblclick', () => this.fit());
  }

  setVisible(visible) {
    this.visible = Boolean(visible);
    this.canvas.hidden = !this.visible;
    if (this.visible) {
      this.resize();
      this.requestDraw();
    }
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.updateCursor();
  }

  setInteractionMode(mode) {
    this.mode = mode === 'zoom-window' ? 'zoom-window' : 'pan';
    this.hideZoomWindow();
    this.updateCursor();
  }

  updateCursor() {
    this.canvas.style.cursor = !this.enabled
      ? 'default'
      : this.mode === 'zoom-window'
        ? 'crosshair'
        : 'grab';
  }

  setBackground(color) {
    this.background = color;
    this.requestDraw();
  }

  clear() {
    this.geometry = null;
    this.cancelImport();
    this.requestDraw();
  }

  setGeometry(geometry) {
    const gl = this.gl;
    this.geometry = geometry;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, geometry.colors, gl.STATIC_DRAW);
    this.yaw = -Math.PI / 4;
    this.pitch = Math.PI / 7;
    this.fit();
    return {
      format: geometry.format,
      triangles: geometry.triangles,
      dimensions: geometry.dimensions,
    };
  }

  loadStl(buffer) {
    return this.setGeometry(parseStl(buffer));
  }

  loadOcctResult(result, format) {
    return this.setGeometry(geometryFromOcctResult(result, format));
  }

  importOcct(buffer, format, workerUrl, parameters = {}) {
    this.cancelImport();
    const bytes = new Uint8Array(buffer);
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerUrl);
      this.importWorker = worker;
      this.importReject = reject;
      this.importTimer = setTimeout(() => {
        const timeoutReject = this.importReject;
        this.finishImportWorker();
        timeoutReject?.(new Error('三维模型解析超时。'));
      }, parameters.timeoutMs || 120000);
      worker.onmessage = (event) => {
        this.finishImportWorker();
        if (event.data?.type === 'error') {
          reject(new Error(event.data.message || '三维模型解析失败。'));
          return;
        }
        try {
          resolve(this.loadOcctResult(event.data?.result ?? event.data, format.toUpperCase()));
        } catch (error) {
          reject(error);
        }
      };
      worker.onerror = (event) => {
        this.finishImportWorker();
        reject(new Error(event.message || 'OpenCascade Worker 运行失败。'));
      };
      worker.postMessage({
        format,
        buffer: bytes,
        params: {
          linearUnit: 'millimeter',
          linearDeflectionType: 'bounding_box_ratio',
          linearDeflection: parameters.linearDeflection || 0.001,
          angularDeflection: parameters.angularDeflection || 0.5,
        },
      }, [bytes.buffer]);
    });
  }

  finishImportWorker() {
    clearTimeout(this.importTimer);
    this.importTimer = null;
    this.importWorker?.terminate();
    this.importWorker = null;
    this.importReject = null;
  }

  cancelImport() {
    if (!this.importWorker) return;
    const reject = this.importReject;
    this.finishImportWorker();
    if (reject) reject(new DOMException('模型解析已取消。', 'AbortError'));
  }

  fit() {
    if (!this.geometry) return;
    this.distance = this.geometry.radius / Math.tan(this.fieldOfView / 2) * 1.25;
    this.panX = 0;
    this.panY = 0;
    this.requestDraw();
  }

  onWheel(event) {
    if (!this.enabled || !this.geometry) return;
    event.preventDefault();
    this.zoomBy(Math.exp(-event.deltaY * 0.0012));
  }

  zoomBy(factor) {
    if (!this.enabled || !this.geometry) return;
    this.distance = clamp(
      this.distance / Math.max(factor, 0.01),
      this.geometry.radius * 0.15,
      this.geometry.radius * 100,
    );
    this.requestDraw();
  }

  eventPoint(event) {
    const bounds = this.canvas.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  onPointerDown(event) {
    if (!this.enabled || !this.geometry) return;
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
    const point = this.eventPoint(event);
    if (this.mode === 'zoom-window') {
      this.zoomStart = point;
      this.showZoomWindow(point, point);
      return;
    }

    if (event.pointerType === 'touch') {
      this.touchPointers.set(event.pointerId, point);
      if (this.touchPointers.size >= 2) {
        const pointers = [...this.touchPointers.entries()].slice(0, 2);
        this.pinch = {
          ids: [pointers[0][0], pointers[1][0]],
          distance: Math.hypot(
            pointers[1][1].x - pointers[0][1].x,
            pointers[1][1].y - pointers[0][1].y,
          ),
          cameraDistance: this.distance,
        };
        this.drag = null;
      } else {
        this.drag = { pointerId: event.pointerId, ...point, mode: 'orbit' };
      }
      return;
    }

    this.drag = {
      pointerId: event.pointerId,
      ...point,
      mode: event.shiftKey || event.button === 1 || event.button === 2 ? 'translate' : 'orbit',
    };
    this.canvas.style.cursor = 'grabbing';
  }

  onPointerMove(event) {
    if (!this.enabled || !this.geometry) return;
    const point = this.eventPoint(event);
    if (this.zoomStart) {
      this.showZoomWindow(this.zoomStart, point);
      return;
    }

    if (event.pointerType === 'touch' && this.touchPointers.has(event.pointerId)) {
      event.preventDefault();
      this.touchPointers.set(event.pointerId, point);
      if (this.pinch) {
        const first = this.touchPointers.get(this.pinch.ids[0]);
        const second = this.touchPointers.get(this.pinch.ids[1]);
        if (!first || !second) return;
        const distance = Math.hypot(second.x - first.x, second.y - first.y);
        const factor = this.pinch.distance > 0 ? distance / this.pinch.distance : 1;
        this.distance = clamp(
          this.pinch.cameraDistance / Math.max(factor, 0.01),
          this.geometry.radius * 0.15,
          this.geometry.radius * 100,
        );
        this.requestDraw();
        return;
      }
    }

    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const deltaX = point.x - this.drag.x;
    const deltaY = point.y - this.drag.y;
    this.drag.x = point.x;
    this.drag.y = point.y;
    if (this.drag.mode === 'orbit') {
      this.yaw += deltaX * 0.008;
      this.pitch = clamp(this.pitch + deltaY * 0.008, -Math.PI / 2, Math.PI / 2);
    } else {
      const scale = 2 * this.distance * Math.tan(this.fieldOfView / 2) /
        Math.max(this.canvas.clientHeight, 1);
      this.panX += deltaX * scale;
      this.panY -= deltaY * scale;
    }
    this.requestDraw();
  }

  onPointerUp(event) {
    if (this.zoomStart) {
      const end = this.eventPoint(event);
      this.zoomToWindow(this.zoomStart, end);
      this.zoomStart = null;
      this.hideZoomWindow();
      this.options.onInteractionModeChange?.('pan');
      return;
    }

    if (event.pointerType === 'touch') {
      this.touchPointers.delete(event.pointerId);
      this.pinch = null;
      const remaining = this.touchPointers.entries().next().value;
      this.drag = remaining
        ? { pointerId: remaining[0], ...remaining[1], mode: 'orbit' }
        : null;
    } else {
      this.drag = null;
    }
    this.updateCursor();
  }

  showZoomWindow(start, end) {
    if (!this.zoomWindow) return;
    this.zoomWindow.style.left = Math.min(start.x, end.x) + 'px';
    this.zoomWindow.style.top = Math.min(start.y, end.y) + 'px';
    this.zoomWindow.style.width = Math.abs(end.x - start.x) + 'px';
    this.zoomWindow.style.height = Math.abs(end.y - start.y) + 'px';
    this.zoomWindow.style.display = 'block';
  }

  hideZoomWindow() {
    if (this.zoomWindow) this.zoomWindow.style.display = 'none';
    this.zoomStart = null;
  }

  zoomToWindow(start, end) {
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width < 8 || height < 8) return;
    const centerX = (start.x + end.x) / 2;
    const centerY = (start.y + end.y) / 2;
    const worldPerPixel = 2 * this.distance * Math.tan(this.fieldOfView / 2) /
      Math.max(this.canvas.clientHeight, 1);
    this.panX -= (centerX - this.canvas.clientWidth / 2) * worldPerPixel;
    this.panY += (centerY - this.canvas.clientHeight / 2) * worldPerPixel;
    const factor = Math.max(
      width / Math.max(this.canvas.clientWidth, 1),
      height / Math.max(this.canvas.clientHeight, 1),
    );
    this.distance = clamp(
      this.distance * factor / 0.9,
      this.geometry.radius * 0.15,
      this.geometry.radius * 100,
    );
    this.requestDraw();
  }

  resize() {
    if (!this.visible) return;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(this.canvas.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.canvas.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      this.requestDraw();
    }
  }

  requestDraw() {
    this.needsDraw = true;
  }

  loop() {
    if (this.visible && this.needsDraw) {
      this.draw();
      this.needsDraw = false;
    }
    this.animationFrame = requestAnimationFrame(() => this.loop());
  }

  draw() {
    const gl = this.gl;
    const background = hexToRgb(this.background);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(background[0], background[1], background[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.geometry) return;

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.useProgram(this.program);
    const aspect = this.canvas.width / Math.max(this.canvas.height, 1);
    const near = Math.max(this.geometry.radius * 0.001, 0.001);
    const far = Math.max(this.distance + this.geometry.radius * 20, near + 10);
    const projection = mat4Perspective(this.fieldOfView, aspect, near, far);
    const view = mat4Translation(this.panX, this.panY, -this.distance);
    const model = mat4Multiply(mat4RotationX(this.pitch), mat4RotationY(this.yaw));
    const normalMatrix = new Float32Array([
      model[0], model[1], model[2],
      model[4], model[5], model[6],
      model[8], model[9], model[10],
    ]);

    gl.uniformMatrix4fv(this.locations.projection, false, projection);
    gl.uniformMatrix4fv(this.locations.view, false, view);
    gl.uniformMatrix4fv(this.locations.model, false, model);
    gl.uniformMatrix3fv(this.locations.normalMatrix, false, normalMatrix);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
    gl.enableVertexAttribArray(this.locations.position);
    gl.vertexAttribPointer(this.locations.position, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
    gl.enableVertexAttribArray(this.locations.normal);
    gl.vertexAttribPointer(this.locations.normal, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
    gl.enableVertexAttribArray(this.locations.color);
    gl.vertexAttribPointer(this.locations.color, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, this.geometry.positions.length / 3);
  }

  destroy() {
    this.cancelImport();
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver.disconnect();
    this.gl.deleteBuffer(this.positionBuffer);
    this.gl.deleteBuffer(this.normalBuffer);
    this.gl.deleteBuffer(this.colorBuffer);
    this.gl.deleteProgram(this.program);
  }
}
