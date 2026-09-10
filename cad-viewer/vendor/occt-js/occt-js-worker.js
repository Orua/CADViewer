importScripts('occt-js.js');

const importMethods = {
  step: 'ReadStepFile',
  iges: 'ReadIgesFile',
  brep: 'ReadBrepFile',
};

const identity = () => new Float64Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

function multiplyMatrix(left, right) {
  const output = new Float64Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      let value = 0;
      for (let index = 0; index < 4; index += 1) {
        value += left[index * 4 + row] * right[column * 4 + index];
      }
      output[column * 4 + row] = value;
    }
  }
  return output;
}

function colorArray(color) {
  return color ? [Number(color.r), Number(color.g), Number(color.b)] : null;
}

function transformedGeometry(geometry, matrix, name) {
  const sourcePositions = geometry.positions;
  const sourceNormals = geometry.normals;
  const positions = new Float32Array(sourcePositions.length);
  const normals = new Float32Array(sourceNormals.length);
  for (let offset = 0; offset < sourcePositions.length; offset += 3) {
    const x = sourcePositions[offset];
    const y = sourcePositions[offset + 1];
    const z = sourcePositions[offset + 2];
    positions[offset] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12];
    positions[offset + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13];
    positions[offset + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14];
    const nx = matrix[0] * sourceNormals[offset] + matrix[4] * sourceNormals[offset + 1] + matrix[8] * sourceNormals[offset + 2];
    const ny = matrix[1] * sourceNormals[offset] + matrix[5] * sourceNormals[offset + 1] + matrix[9] * sourceNormals[offset + 2];
    const nz = matrix[2] * sourceNormals[offset] + matrix[6] * sourceNormals[offset + 1] + matrix[10] * sourceNormals[offset + 2];
    const length = Math.hypot(nx, ny, nz) || 1;
    normals[offset] = nx / length;
    normals[offset + 1] = ny / length;
    normals[offset + 2] = nz / length;
  }
  return {
    name: name || geometry.name || '',
    attributes: {
      position: { array: positions },
      normal: { array: normals },
    },
    index: { array: geometry.indices },
    color: colorArray(geometry.color),
    brep_faces: geometry.faces.map((face) => ({
      first: Math.floor(face.firstIndex / 3),
      last: Math.floor((face.firstIndex + face.indexCount - 1) / 3),
      color: colorArray(face.color),
      stableFaceId: face.id,
    })),
    preserveSourceNormals: true,
  };
}

function adaptResult(result) {
  const meshes = [];
  const visit = (node, parentMatrix) => {
    const local = node.transform?.length === 16 ? node.transform : identity();
    const world = multiplyMatrix(parentMatrix, local);
    for (const geometryIndex of node.meshes || []) {
      const geometry = result.geometries?.[geometryIndex];
      if (geometry) meshes.push(transformedGeometry(geometry, world, node.name));
    }
    for (const child of node.children || []) visit(child, world);
  };
  for (const root of result.rootNodes || []) visit(root, identity());
  return {
    success: result.success,
    error: result.error,
    root: { name: '', meshes: meshes.map((_, index) => index), children: [] },
    meshes,
    occtVersion: '7.9.3',
  };
}

onmessage = async function (event) {
  try {
    const occt = await OcctJS({ locateFile: (path) => path });
    const methodName = importMethods[event.data.format];
    if (!methodName || typeof occt[methodName] !== 'function') {
      throw new Error('不支持的三维模型格式。');
    }
    const result = occt[methodName](event.data.buffer, {
      ...event.data.params,
      rootMode: 'one-shape',
      readNames: true,
      readColors: true,
    });
    if (!result || result.success === false) {
      throw new Error(result?.error || '三维模型解析失败。');
    }
    postMessage({ type: 'result', result: adaptResult(result) });
  } catch (error) {
    postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
