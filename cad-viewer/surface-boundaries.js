// Display boundaries come from CAD face adjacency, never tessellation diagonals.
// Coordinates are expanded with the triangle soup consumed by ModelViewer3D.
export function buildSurfaceBoundaryCoordinates(mesh) {
  const positions = mesh.attributes?.position?.array;
  const normals = mesh.attributes?.normal?.array;
  const indices = mesh.index?.array;
  const faces = mesh.brep_faces || [];
  if (!positions || !indices) return new Float32Array();
  const triangleCount = Math.floor(indices.length / 3);
  const coordinates = new Float32Array(triangleCount * 9).fill(1);
  if (!faces.length) return coordinates;

  const minimum = [Infinity, Infinity, Infinity], maximum = [-Infinity, -Infinity, -Infinity];
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], positions[offset + axis]);
      maximum[axis] = Math.max(maximum[axis], positions[offset + axis]);
    }
  }
  const tolerance = Math.max(...maximum.map((value, axis) => value - minimum[axis]), 1) * 1e-7;
  const welded = new Map(), vertexIds = new Uint32Array(positions.length / 3);
  for (let vertex = 0; vertex < vertexIds.length; vertex += 1) {
    const key = [0, 1, 2].map(axis => Math.round((positions[vertex * 3 + axis] - minimum[axis]) / tolerance)).join(',');
    if (!welded.has(key)) welded.set(key, welded.size);
    vertexIds[vertex] = welded.get(key);
  }
  const flags = new Uint8Array(triangleCount * 3), edges = new Map();
  const cosine = Math.cos(20 * Math.PI / 180);
  const normalDot = (first, second) => {
    if (!normals) return 1;
    const a = first * 3, b = second * 3;
    const length = Math.hypot(normals[a], normals[a + 1], normals[a + 2]) * Math.hypot(normals[b], normals[b + 1], normals[b + 2]);
    return length > 1e-12 ? (normals[a] * normals[b] + normals[a + 1] * normals[b + 1] + normals[a + 2] * normals[b + 2]) / length : 1;
  };
  let faceCursor = 0;
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    while (faceCursor < faces.length && triangle > faces[faceCursor].last) faceCursor += 1;
    const face = faces[faceCursor];
    if (!face || triangle < face.first) continue;
    const color = Array.from(face.color || mesh.color || []).join(',');
    for (let corner = 0; corner < 3; corner += 1) {
      // Barycentric component corner is zero on the opposite edge.
      let first = Number(indices[triangle * 3 + (corner + 1) % 3]);
      let second = Number(indices[triangle * 3 + (corner + 2) % 3]);
      if (vertexIds[first] > vertexIds[second]) [first, second] = [second, first];
      const key = vertexIds[first] + ':' + vertexIds[second];
      const previous = edges.get(key);
      const slot = triangle * 3 + corner;
      if (!previous) {
        edges.set(key, { first, second, face: faceCursor, color, slot });
        flags[slot] = 1;
      } else {
        const crease = previous.face !== faceCursor &&
          (normalDot(previous.first, first) + normalDot(previous.second, second)) * 0.5 < cosine;
        const boundary = crease || previous.color !== color;
        flags[previous.slot] = boundary ? 1 : 0;
        flags[slot] = boundary ? 1 : 0;
      }
    }
  }
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let component = 0; component < 3; component += 1) {
      if (!flags[triangle * 3 + component]) continue;
      for (let corner = 0; corner < 3; corner += 1) {
        coordinates[triangle * 9 + corner * 3 + component] = corner === component ? 1 : 0;
      }
    }
  }
  return coordinates;
}
