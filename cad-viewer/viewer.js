const canvas = document.querySelector('#fastCanvas');
const context = canvas.getContext('2d', { alpha: false });
const openButton = document.querySelector('#persistentOpenButton');
const fitButton = document.querySelector('#fitButton');
const fileInput = document.querySelector('#fileInputElement');
const status = document.querySelector('#status');
const metrics = document.querySelector('#metrics');
const centerOpenButton = document.querySelector('#centerOpenButton');
const emptyState = document.querySelector('#emptyState');
const loadingOverlay = document.querySelector('#mlcad-loading');
const toolOpenButton = document.querySelector('#toolOpenButton');
const toolPanButton = document.querySelector('#toolPanButton');
const toolFitButton = document.querySelector('#toolFitButton');
const toolZoomWindowButton = document.querySelector('#toolZoomWindowButton');
const toolSidebarButton = document.querySelector('#toolSidebarButton');
const toolBackgroundButton = document.querySelector('#toolBackgroundButton');
const fileSidebarColumn = document.querySelector('#fileSidebarColumn');
const zoomWindow = document.querySelector('#zoomWindow');
const configuredDataBaseUrl = window.CAD_VIEWER_CONFIG?.dataBaseUrl;
window.cadViewerFontState = { dataBaseUrl: configuredDataBaseUrl, phase: 'idle' };

const STAGES = [
  { key: 'outline', label: '轮廓直线' },
  { key: 'curves', label: '圆弧和曲线' },
  { key: 'annotation', label: '尺寸和引线' },
  { key: 'text', label: '文字' },
  { key: 'hatch', label: '填充边界' },
];

let worker;
let stagePaths;
let visibleStages;
let blocks;
let pendingReferences;
let textItems;
let textLayoutMode;
let bounds;
let batchBounds;
let camera;
let renderPending = false;
let openedAt = 0;
let firstPaintAt = 0;
let entityCount = 0;
let unsupportedCount = 0;
let unresolvedCount = 0;
let layerColors;
let fontEngine;
let loadGeneration = 0;
let drag;
let hasOpenedFile = false;
let interactionMode = 'pan';
let zoomWindowStart;
let backgroundColor = '#090b0e';

function setInteractionMode(mode) {
  interactionMode = mode;
  toolPanButton.classList.toggle('is-active', mode === 'pan');
  toolZoomWindowButton.classList.toggle('is-active', mode === 'zoom-window');
  canvas.style.cursor = mode === 'zoom-window' ? 'crosshair' : 'grab';
}

function setZoomWindowBox(start, end) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  zoomWindow.style.left = `${left}px`;
  zoomWindow.style.top = `${top}px`;
  zoomWindow.style.width = `${Math.abs(end.x - start.x)}px`;
  zoomWindow.style.height = `${Math.abs(end.y - start.y)}px`;
  zoomWindow.style.display = 'block';
}

function zoomToWindow(start, end) {
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  if (width < 8 || height < 8) return;
  const worldLeft = (Math.min(start.x, end.x) - camera.x) / camera.scale;
  const worldRight = (Math.max(start.x, end.x) - camera.x) / camera.scale;
  const worldTop = (camera.y - Math.min(start.y, end.y)) / camera.scale;
  const worldBottom = (camera.y - Math.max(start.y, end.y)) / camera.scale;
  const worldWidth = Math.max(worldRight - worldLeft, 1e-9);
  const worldHeight = Math.max(worldTop - worldBottom, 1e-9);
  camera.scale = Math.min(canvas.clientWidth / worldWidth, canvas.clientHeight / worldHeight) * 0.92;
  camera.x = canvas.clientWidth / 2 - (worldLeft + worldRight) / 2 * camera.scale;
  camera.y = canvas.clientHeight / 2 + (worldTop + worldBottom) / 2 * camera.scale;
  scheduleRender();
}

function setLoading(isLoading) {
  loadingOverlay.hidden = !isLoading;
  emptyState.classList.toggle('hidden', isLoading || hasOpenedFile);
}

function emptyBounds() {
  return { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
}

function freshPathMap() {
  return Object.fromEntries(STAGES.filter((stage) => stage.key !== 'text').map((stage) => [stage.key, new Map()]));
}

function freshBoundsMap() {
  return Object.fromEntries(STAGES.filter((stage) => stage.key !== 'text').map((stage) => [stage.key, emptyBounds()]));
}

function resetViewer() {
  worker?.terminate();
  loadGeneration += 1;
  stagePaths = new Map(STAGES.map((stage) => [stage.key, []]));
  visibleStages = new Set(['outline']);
  blocks = new Map();
  pendingReferences = [];
  textItems = [];
  textLayoutMode = 'fast';
  bounds = emptyBounds();
  batchBounds = [];
  camera = { scale: 1, x: 0, y: 0 };
  entityCount = 0;
  unsupportedCount = 0;
  unresolvedCount = 0;
  layerColors = new Map();
  firstPaintAt = 0;
  metrics.textContent = '';
  fitButton.disabled = true;
  scheduleRender();
}

function rgbToCss(value) {
  return `#${Math.max(0, Math.min(0xffffff, Math.round(value))).toString(16).padStart(6, '0')}`;
}

function aciToCss(index) {
  const basics = ['#ffffff', '#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ffffff', '#808080', '#c0c0c0'];
  if (index >= 0 && index < basics.length) return basics[index];
  if (index >= 250 && index <= 255) {
    const gray = [51, 80, 105, 130, 190, 255][index - 250];
    return rgbToCss((gray << 16) | (gray << 8) | gray);
  }
  if (index < 10 || index > 249) return '#ffffff';
  const offset = index - 10;
  const hue = Math.floor(offset / 10) * 15;
  const shade = offset % 10;
  const value = [1, 1, 0.8, 0.8, 0.6, 0.6, 0.5, 0.5, 0.3, 0.3][shade];
  const saturation = shade % 2 === 0 ? 1 : 0.5;
  const chroma = value * saturation;
  const segment = hue / 60;
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1));
  const minimum = value - chroma;
  let red = 0;
  let green = 0;
  let blue = 0;
  if (segment < 1) [red, green] = [chroma, secondary];
  else if (segment < 2) [red, green] = [secondary, chroma];
  else if (segment < 3) [green, blue] = [chroma, secondary];
  else if (segment < 4) [green, blue] = [secondary, chroma];
  else if (segment < 5) [red, blue] = [secondary, chroma];
  else [red, blue] = [chroma, secondary];
  const color = (Math.floor((red + minimum) * 255) << 16)
    | (Math.floor((green + minimum) * 255) << 8)
    | Math.floor((blue + minimum) * 255);
  return rgbToCss(color);
}

function colorStyleForEntity(entity) {
  if (Number.isFinite(entity.color)) return `rgb:${entity.color}`;
  if (entity.colorIndex === 0) return 'byblock';
  if (entity.colorIndex === 256 || entity.colorIndex === 7 || entity.colorIndex == null) return `layer:${entity.layer || '0'}`;
  return `aci:${entity.colorIndex}`;
}

function inheritColorStyle(style, reference) {
  if (style === 'byblock') return colorStyleForEntity(reference);
  if (style === 'layer:0' && reference.layer && reference.layer !== '0') return `layer:${reference.layer}`;
  return style;
}

function resolveCssColor(style) {
  if (style.startsWith('rgb:')) return rgbToCss(Number(style.slice(4)));
  if (style.startsWith('aci:')) return aciToCss(Number(style.slice(4)));
  if (style.startsWith('layer:')) {
    const layer = layerColors.get(style.slice(6));
    if (layer) {
      if (layer.colorIndex >= 1 && layer.colorIndex <= 255) return aciToCss(layer.colorIndex);
      if (Number.isFinite(layer.color)) return rgbToCss(layer.color);
    }
  }
  return '#ffffff';
}

function styledPath(paths, stage, style) {
  let path = paths[stage].get(style);
  if (!path) {
    path = new Path2D();
    paths[stage].set(style, path);
  }
  return path;
}

function appendStyledPath(target, source, matrix, style) {
  let path = target.get(style);
  if (!path) {
    path = new Path2D();
    target.set(style, path);
  }
  path.addPath(source, matrix);
}

function includePoint(target, point, matrix) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
  const transformed = matrix ? matrix.transformPoint(point) : point;
  target.minX = Math.min(target.minX, transformed.x);
  target.minY = Math.min(target.minY, transformed.y);
  target.maxX = Math.max(target.maxX, transformed.x);
  target.maxY = Math.max(target.maxY, transformed.y);
}

function includeBounds(target, source, matrix) {
  if (!source || !Number.isFinite(source.minX)) return;
  includePoint(target, { x: source.minX, y: source.minY }, matrix);
  includePoint(target, { x: source.maxX, y: source.minY }, matrix);
  includePoint(target, { x: source.maxX, y: source.maxY }, matrix);
  includePoint(target, { x: source.minX, y: source.maxY }, matrix);
}

function addPolyline(path, points, closed, localBounds) {
  const valid = points?.filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (!valid?.length) return false;
  path.moveTo(valid[0].x, valid[0].y);
  includePoint(localBounds, valid[0]);
  for (let index = 1; index < valid.length; index += 1) {
    path.lineTo(valid[index].x, valid[index].y);
    includePoint(localBounds, valid[index]);
  }
  if (closed) path.closePath();
  return true;
}

function evaluateBSpline(t, degree, controlPoints, knots, weights) {
  const pointCount = controlPoints.length;
  if (pointCount === 0 || degree < 1 || degree > pointCount - 1) return null;
  const safeWeights = weights?.length === pointCount ? weights : new Array(pointCount).fill(1);
  const safeKnots = knots?.length === pointCount + degree + 1
    ? knots
    : Array.from({ length: pointCount + degree + 1 }, (_, index) => index);
  const domainStart = degree;
  const domainEnd = safeKnots.length - 1 - degree;
  const low = safeKnots[domainStart];
  const high = safeKnots[domainEnd];
  const knot = Math.max(low, Math.min(high, t * (high - low) + low));
  let span = domainStart;
  for (; span < domainEnd; span += 1) {
    if (knot >= safeKnots[span] && knot <= safeKnots[span + 1]) break;
  }
  const values = controlPoints.map((point, index) => [
    point.x * safeWeights[index],
    point.y * safeWeights[index],
    safeWeights[index],
  ]);
  for (let level = 1; level <= degree + 1; level += 1) {
    for (let index = span; index > span - degree - 1 + level; index -= 1) {
      const denominator = safeKnots[index + degree + 1 - level] - safeKnots[index];
      const alpha = denominator === 0 ? 0 : (knot - safeKnots[index]) / denominator;
      for (let axis = 0; axis < 3; axis += 1) {
        values[index][axis] = (1 - alpha) * values[index - 1][axis] + alpha * values[index][axis];
      }
    }
  }
  const divisor = values[span][2];
  return divisor ? { x: values[span][0] / divisor, y: values[span][1] / divisor } : null;
}

function sampleSpline(entity) {
  const controlPoints = entity.controlPoints ?? [];
  if (controlPoints.length <= (entity.degree || 0)) return entity.fitPoints?.length ? entity.fitPoints : controlPoints;
  const knotSpanCount = Math.max(1, new Set(entity.knots ?? []).size - 1);
  const sampleCount = Math.min(200, Math.max(32, knotSpanCount * 16));
  const sampled = [];
  for (let index = 0; index <= sampleCount; index += 1) {
    const point = evaluateBSpline(index / sampleCount, entity.degree, controlPoints, entity.knots, entity.weights);
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) sampled.push(point);
  }
  return sampled.length > 1 ? sampled : (entity.fitPoints?.length ? entity.fitPoints : controlPoints);
}

function ellipsePoint(center, radiusX, radiusY, rotation, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const rotationCosine = Math.cos(rotation);
  const rotationSine = Math.sin(rotation);
  return {
    x: center.x + radiusX * cosine * rotationCosine - radiusY * sine * rotationSine,
    y: center.y + radiusX * cosine * rotationSine + radiusY * sine * rotationCosine,
  };
}

function stageForEntity(entity) {
  if (['LINE', 'LWPOLYLINE', 'POLYLINE2D', 'POLYLINE3D', '3DFACE', 'SOLID'].includes(entity.type)) return 'outline';
  if (['CIRCLE', 'ARC', 'ELLIPSE', 'SPLINE', 'POINT'].includes(entity.type)) return 'curves';
  if (['DIMENSION', 'LEADER'].includes(entity.type)) return 'annotation';
  if (['TEXT', 'MTEXT', 'ATTDEF', 'ATTRIB'].includes(entity.type)) return 'text';
  if (entity.type === 'HATCH') return 'hatch';
  if (entity.type === 'INSERT') return 'reference';
  return 'unsupported';
}

function addHatchBoundary(path, entity, localBounds) {
  let drawn = false;
  for (const boundary of entity.boundaryPaths ?? []) {
    if (boundary.vertices) {
      drawn = addPolyline(path, boundary.vertices, boundary.isClosed, localBounds) || drawn;
      continue;
    }
    for (const edge of boundary.edges ?? []) {
      if (edge.type === 1) {
        path.moveTo(edge.start.x, edge.start.y);
        path.lineTo(edge.end.x, edge.end.y);
        includePoint(localBounds, edge.start);
        includePoint(localBounds, edge.end);
        drawn = true;
      } else if (edge.type === 2) {
        path.moveTo(edge.center.x + Math.abs(edge.radius) * Math.cos(edge.startAngle), edge.center.y + Math.abs(edge.radius) * Math.sin(edge.startAngle));
        path.arc(edge.center.x, edge.center.y, Math.abs(edge.radius), edge.startAngle, edge.endAngle, edge.isCCW === false);
        includePoint(localBounds, { x: edge.center.x - edge.radius, y: edge.center.y - edge.radius });
        includePoint(localBounds, { x: edge.center.x + edge.radius, y: edge.center.y + edge.radius });
        drawn = true;
      } else if (edge.type === 3) {
        const major = Math.hypot(edge.end.x, edge.end.y);
        const minor = Math.abs(edge.lengthOfMinorAxis);
        const rotation = Math.atan2(edge.end.y, edge.end.x);
        const start = ellipsePoint(edge.center, major, minor, rotation, edge.startAngle);
        path.moveTo(start.x, start.y);
        path.ellipse(edge.center.x, edge.center.y, major, minor, rotation, edge.startAngle, edge.endAngle, edge.isCCW === false);
        includePoint(localBounds, { x: edge.center.x - major, y: edge.center.y - major });
        includePoint(localBounds, { x: edge.center.x + major, y: edge.center.y + major });
        drawn = true;
      } else if (edge.type === 4) {
        drawn = addPolyline(path, edge.fitDatum?.length ? edge.fitDatum : edge.controlPoints, false, localBounds) || drawn;
      }
    }
  }
  return drawn;
}

function addGeometry(path, entity, localBounds) {
  if (!entity || entity.isVisible === false) return false;
  switch (entity.type) {
    case 'LINE':
      path.moveTo(entity.startPoint.x, entity.startPoint.y);
      path.lineTo(entity.endPoint.x, entity.endPoint.y);
      includePoint(localBounds, entity.startPoint);
      includePoint(localBounds, entity.endPoint);
      return true;
    case 'LWPOLYLINE':
      return addPolyline(path, entity.vertices, Boolean(entity.flag & 512), localBounds);
    case 'POLYLINE2D':
    case 'POLYLINE3D':
      return addPolyline(path, entity.vertices, Boolean(entity.flag & 1), localBounds);
    case 'CIRCLE':
      path.moveTo(entity.center.x + entity.radius, entity.center.y);
      path.arc(entity.center.x, entity.center.y, Math.abs(entity.radius), 0, Math.PI * 2);
      includePoint(localBounds, { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius });
      includePoint(localBounds, { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius });
      return true;
    case 'ARC':
      path.moveTo(entity.center.x + Math.abs(entity.radius) * Math.cos(entity.startAngle), entity.center.y + Math.abs(entity.radius) * Math.sin(entity.startAngle));
      path.arc(entity.center.x, entity.center.y, Math.abs(entity.radius), entity.startAngle, entity.endAngle);
      includePoint(localBounds, { x: entity.center.x - entity.radius, y: entity.center.y - entity.radius });
      includePoint(localBounds, { x: entity.center.x + entity.radius, y: entity.center.y + entity.radius });
      return true;
    case 'ELLIPSE': {
      const axis = entity.majorAxisEndPoint;
      const radiusX = Math.hypot(axis.x, axis.y);
      const radiusY = radiusX * Math.abs(entity.axisRatio);
      const rotation = Math.atan2(axis.y, axis.x);
      const start = ellipsePoint(entity.center, radiusX, radiusY, rotation, entity.startAngle);
      path.moveTo(start.x, start.y);
      path.ellipse(entity.center.x, entity.center.y, radiusX, radiusY, rotation, entity.startAngle, entity.endAngle);
      includePoint(localBounds, { x: entity.center.x - radiusX, y: entity.center.y - radiusX });
      includePoint(localBounds, { x: entity.center.x + radiusX, y: entity.center.y + radiusX });
      return true;
    }
    case 'SPLINE':
      return addPolyline(path, sampleSpline(entity), Boolean(entity.flag & 1), localBounds);
    case '3DFACE':
    case 'SOLID':
      return addPolyline(path, [entity.corner1, entity.corner2, entity.corner3, entity.corner4].filter(Boolean), true, localBounds);
    case 'POINT': {
      const point = entity.point ?? entity;
      path.moveTo(point.x - 1, point.y);
      path.lineTo(point.x + 1, point.y);
      path.moveTo(point.x, point.y - 1);
      path.lineTo(point.x, point.y + 1);
      includePoint(localBounds, point);
      return true;
    }
    case 'LEADER':
      return addPolyline(path, entity.vertices, false, localBounds);
    case 'HATCH':
      return addHatchBoundary(path, entity, localBounds);
    default:
      return false;
  }
}

function cleanCadText(value) {
  return String(value ?? '')
    .replace(/\\U\+([0-9A-Fa-f]{4})/g, (_, hex) => {
      try { return String.fromCodePoint(Number.parseInt(hex, 16)); } catch { return '▯'; }
    })
    .replace(/\\P/gi, '\n')
    .replace(/\\~/g, ' ')
    .replace(/%%d/gi, '°')
    .replace(/%%p/gi, '±')
    .replace(/%%c/gi, 'Ø')
    .replace(/\\[A-Za-z][^;]*;/g, '')
    .replace(/[{}]/g, '')
    .trim();
}

function textFromEntity(entity, matrix) {
  const insertionPoint = entity.type === 'MTEXT' ? entity.insertionPoint : entity.startPoint;
  if (!insertionPoint || !entity.text) return null;
  const hasAlignmentPoint = entity.type !== 'MTEXT'
    && entity.endPoint
    && Number.isFinite(entity.endPoint.x)
    && Number.isFinite(entity.endPoint.y)
    && (entity.halign || entity.valign)
    && (entity.endPoint.x !== 0 || entity.endPoint.y !== 0);
  const point = hasAlignmentPoint ? entity.endPoint : insertionPoint;
  const transformed = matrix ? matrix.transformPoint(point) : point;
  const fastPoint = matrix ? matrix.transformPoint(insertionPoint) : insertionPoint;
  const matrixScale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
  const matrixRotation = matrix ? Math.atan2(matrix.b, matrix.a) : 0;
  return {
    text: cleanCadText(entity.text),
    x: transformed.x,
    y: transformed.y,
    fastX: fastPoint.x,
    fastY: fastPoint.y,
    height: Math.max(Math.abs(entity.textHeight || 1) * matrixScale, 1e-9),
    rotation: (entity.rotation || 0) + matrixRotation,
    type: entity.type,
    halign: entity.halign || 0,
    valign: entity.valign || 0,
    attachmentPoint: entity.attachmentPoint || 1,
    widthFactor: entity.xScale || 1,
    generationFlag: entity.generationFlag || 0,
    styleName: entity.styleName || 'STANDARD',
    style: colorStyleForEntity(entity),
  };
}

function transformTextItem(item, matrix, style) {
  const precise = matrix.transformPoint(item);
  const fast = matrix.transformPoint({ x: item.fastX, y: item.fastY });
  return {
    ...item,
    x: precise.x,
    y: precise.y,
    fastX: fast.x,
    fastY: fast.y,
    height: item.height * Math.hypot(matrix.a, matrix.b),
    rotation: item.rotation + Math.atan2(matrix.b, matrix.a),
    style,
  };
}

function ensureBlock(batch) {
  let block = blocks.get(batch.blockName);
  if (!block) {
    block = {
      basePoint: batch.basePoint,
      directPaths: freshPathMap(),
      directBounds: freshBoundsMap(),
      directTexts: [],
      references: [],
      materialized: null,
    };
    blocks.set(batch.blockName, block);
  }
  return block;
}

function consumeBlockBatch(batch) {
  const block = ensureBlock(batch);
  for (const entity of batch.entities) {
    const stage = stageForEntity(entity);
    if (stage === 'reference' || entity.type === 'DIMENSION') {
      block.references.push(entity);
    } else if (stage === 'text') {
      const item = textFromEntity(entity);
      if (item) block.directTexts.push(item);
    } else if (block.directPaths[stage]) {
      addGeometry(styledPath(block.directPaths, stage, colorStyleForEntity(entity)), entity, block.directBounds[stage]);
    } else {
      unsupportedCount += 1;
    }
  }
}

function consumeModelBatch(batch) {
  const paths = freshPathMap();
  const localBounds = freshBoundsMap();
  const directTexts = [];
  for (const entity of batch.entities) {
    const stage = stageForEntity(entity);
    if (stage === 'reference' || entity.type === 'DIMENSION') pendingReferences.push(entity);
    else if (stage === 'text') {
      const item = textFromEntity(entity);
      if (item) directTexts.push(item);
    } else if (paths[stage] && addGeometry(styledPath(paths, stage, colorStyleForEntity(entity)), entity, localBounds[stage])) {
      // Added to its stage.
    } else unsupportedCount += 1;
  }
  for (const stage of STAGES) {
    if (stage.key === 'text') continue;
    if (Number.isFinite(localBounds[stage.key].minX)) {
      for (const [style, path] of paths[stage.key]) stagePaths.get(stage.key).push({ style, path });
      includeBounds(bounds, localBounds[stage.key]);
      if (stage.key === 'outline') batchBounds.push({ ...localBounds[stage.key] });
    }
  }
  textItems.push(...directTexts);
  if (!firstPaintAt && Number.isFinite(localBounds.outline.minX)) {
    firstPaintAt = performance.now();
    fitView();
  }
  scheduleRender();
}

function consumeBatch(batch) {
  entityCount += batch.entities.length;
  if (batch.kind === 'block') consumeBlockBatch(batch);
  else consumeModelBatch(batch);
  metrics.textContent = `${entityCount.toLocaleString()} 图元`;
}

function referenceMatrices(entity, block) {
  if (entity.type === 'DIMENSION') return [new DOMMatrix().translate(-(block.basePoint?.x || 0), -(block.basePoint?.y || 0))];
  const matrices = [];
  const rows = Math.max(1, Math.min(entity.rowCount || 1, 100));
  const columns = Math.max(1, Math.min(entity.columnCount || 1, 100));
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      matrices.push(new DOMMatrix()
        .translate(entity.insertionPoint.x + column * (entity.columnSpacing || 0), entity.insertionPoint.y + row * (entity.rowSpacing || 0))
        .rotate((entity.rotation || 0) * 180 / Math.PI)
        .scale(entity.xScale || 1, entity.yScale || 1)
        .translate(-(block.basePoint?.x || 0), -(block.basePoint?.y || 0)));
    }
  }
  return matrices;
}

function materializeBlock(name, stack = new Set()) {
  const block = blocks.get(name);
  if (!block) return null;
  if (block.materialized) return block.materialized;
  if (stack.has(name)) return null;
  stack.add(name);
  const result = {
    paths: Object.fromEntries(Object.entries(block.directPaths).map(([key, paths]) => [key, new Map([...paths].map(([style, path]) => [style, new Path2D(path)]))])),
    bounds: Object.fromEntries(Object.entries(block.directBounds).map(([key, value]) => [key, { ...value }])),
    texts: block.directTexts.map((item) => ({ ...item })),
  };
  for (const reference of block.references) {
    const childBlock = blocks.get(reference.name);
    const child = materializeBlock(reference.name, stack);
    if (!child || !childBlock) continue;
    for (const matrix of referenceMatrices(reference, childBlock)) {
      if (reference.type === 'DIMENSION') {
        for (const stage of ['outline', 'curves', 'annotation']) {
          for (const [style, path] of child.paths[stage]) appendStyledPath(result.paths.annotation, path, matrix, inheritColorStyle(style, reference));
          includeBounds(result.bounds.annotation, child.bounds[stage], matrix);
        }
      } else {
        for (const stage of STAGES) {
          if (stage.key === 'text') continue;
          for (const [style, path] of child.paths[stage.key]) appendStyledPath(result.paths[stage.key], path, matrix, inheritColorStyle(style, reference));
          includeBounds(result.bounds[stage.key], child.bounds[stage.key], matrix);
        }
      }
      for (const item of child.texts) {
        result.texts.push(transformTextItem(item, matrix, inheritColorStyle(item.style, reference)));
      }
    }
  }
  stack.delete(name);
  block.materialized = result;
  return result;
}

function appendReference(reference, chunkPaths, chunkBounds, chunkTexts) {
  const sourceBlock = blocks.get(reference.name);
  const block = materializeBlock(reference.name);
  if (!block || !sourceBlock) {
    unresolvedCount += 1;
    return;
  }
  for (const matrix of referenceMatrices(reference, sourceBlock)) {
    if (reference.type === 'DIMENSION') {
      for (const sourceStage of ['outline', 'curves', 'annotation']) {
        for (const [style, path] of block.paths[sourceStage]) appendStyledPath(chunkPaths.annotation, path, matrix, inheritColorStyle(style, reference));
        includeBounds(chunkBounds.annotation, block.bounds[sourceStage], matrix);
      }
    } else {
      for (const stage of STAGES) {
        if (stage.key === 'text') continue;
        for (const [style, path] of block.paths[stage.key]) appendStyledPath(chunkPaths[stage.key], path, matrix, inheritColorStyle(style, reference));
        includeBounds(chunkBounds[stage.key], block.bounds[stage.key], matrix);
      }
    }
    for (const item of block.texts) {
      chunkTexts.push(transformTextItem(item, matrix, inheritColorStyle(item.style, reference)));
    }
  }
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function resolveReferences(generation) {
  const chunkSize = 250;
  for (let offset = 0; offset < pendingReferences.length; offset += chunkSize) {
    if (generation !== loadGeneration) return false;
    const chunkPaths = freshPathMap();
    const chunkBounds = freshBoundsMap();
    const chunkTexts = [];
    for (const reference of pendingReferences.slice(offset, offset + chunkSize)) appendReference(reference, chunkPaths, chunkBounds, chunkTexts);
    for (const stage of STAGES) {
      if (stage.key === 'text') continue;
      if (Number.isFinite(chunkBounds[stage.key].minX)) {
        for (const [style, path] of chunkPaths[stage.key]) stagePaths.get(stage.key).push({ style, path });
        includeBounds(bounds, chunkBounds[stage.key]);
        if (stage.key === 'outline') batchBounds.push({ ...chunkBounds[stage.key] });
      }
    }
    textItems.push(...chunkTexts);
    status.textContent = '正在解析...组合图块…';
    scheduleRender();
    await nextFrame();
  }
  return true;
}

async function revealStages(generation, timing, summary) {
  if (!(await resolveReferences(generation)) || generation !== loadGeneration) return;
  fitView();
  for (let index = 1; index < STAGES.length; index += 1) {
    if (generation !== loadGeneration) return;
    const stage = STAGES[index];
    visibleStages.add(stage.key);
    status.textContent = `正在解析...显示${stage.label}…`;
    scheduleRender();
    await nextFrame();
    if (stage.key === 'text') {
      await new Promise((resolve) => setTimeout(resolve, 180));
      if (generation !== loadGeneration) return;
      status.textContent = '正在解析...校正文字位置…';
      textLayoutMode = 'precise';
      scheduleRender();
      await nextFrame();
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  if (textItems.length && generation === loadGeneration) {
    status.textContent = '正在解析...载入图纸字体…';
    try {
      if (!fontEngine) {
        const { CadFontEngine } = await import('./font-engine.js?v=20260818-fonts-2');
        fontEngine = new CadFontEngine({ dataBaseUrl: configuredDataBaseUrl });
      }
      await fontEngine.prepare(textItems, summary.textStyles ?? []);
      if (generation !== loadGeneration) return;
      window.cadViewerFontState = fontEngine.snapshot();
      status.textContent = '正在解析...使用图纸字体重绘文字…';
      textLayoutMode = 'font';
      fontEngine.state.rerendered = true;
      window.cadViewerFontState = fontEngine.snapshot();
      scheduleRender();
      await nextFrame();
    } catch (error) {
      console.warn('字体加载失败，继续使用系统字体。', error);
      window.cadViewerFontState = {
        ...(fontEngine?.snapshot?.() ?? { dataBaseUrl: configuredDataBaseUrl }),
        fatalError: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const seconds = ((performance.now() - openedAt) / 1000).toFixed(2);
  const parseSeconds = (timing.totalMs / 1000).toFixed(2);
  const remainder = unsupportedCount + unresolvedCount;
  status.textContent = `全部完成：${seconds}s（解析 ${parseSeconds}s）${remainder ? `，仍有 ${remainder.toLocaleString()} 个无法显示` : ''}`;
  openButton.disabled = false;
}

function resize() {
  const ratio = Math.min(devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  scheduleRender();
}

function robustFitBounds() {
  if (batchBounds.length < 12) return bounds;
  const xs = batchBounds.flatMap((item) => [item.minX, item.maxX]).filter(Number.isFinite).sort((a, b) => a - b);
  const ys = batchBounds.flatMap((item) => [item.minY, item.maxY]).filter(Number.isFinite).sort((a, b) => a - b);
  const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.floor(values.length * fraction))];
  const candidate = { minX: percentile(xs, 0.02), maxX: percentile(xs, 0.98), minY: percentile(ys, 0.02), maxY: percentile(ys, 0.98) };
  const fullWidth = bounds.maxX - bounds.minX;
  const fullHeight = bounds.maxY - bounds.minY;
  const candidateWidth = candidate.maxX - candidate.minX;
  const candidateHeight = candidate.maxY - candidate.minY;
  return fullWidth > candidateWidth * 10 || fullHeight > candidateHeight * 10 ? candidate : bounds;
}

function fitView() {
  if (!Number.isFinite(bounds.minX)) return;
  const target = robustFitBounds();
  const width = Math.max(target.maxX - target.minX, 1e-9);
  const height = Math.max(target.maxY - target.minY, 1e-9);
  camera.scale = Math.min(canvas.clientWidth / width, canvas.clientHeight / height) * 0.92;
  camera.x = canvas.clientWidth / 2 - (target.minX + target.maxX) / 2 * camera.scale;
  camera.y = canvas.clientHeight / 2 + (target.minY + target.maxY) / 2 * camera.scale;
  fitButton.disabled = false;
  scheduleRender();
}

function scheduleRender() {
  if (renderPending) return;
  renderPending = true;
  requestAnimationFrame(render);
}

function renderTexts(ratio) {
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  for (const item of textItems) {
    const x = camera.x + (textLayoutMode === 'fast' ? item.fastX : item.x) * camera.scale;
    const y = camera.y - (textLayoutMode === 'fast' ? item.fastY : item.y) * camera.scale;
    const fontSize = Math.abs(item.height * camera.scale);
    if (fontSize < 2.5 || x < -200 || y < -200 || x > canvas.clientWidth + 200 || y > canvas.clientHeight + 200) continue;
    context.save();
    context.fillStyle = resolveCssColor(item.style);
    context.translate(x, y);
    context.rotate(-item.rotation);
    context.font = fontEngine
      ? fontEngine.canvasFontStack(item, fontSize)
      : `${Math.min(Math.max(fontSize, 3), 160)}px "Microsoft YaHei", sans-serif`;
    if (textLayoutMode === 'fast') {
      context.textAlign = 'left';
      context.textBaseline = 'alphabetic';
      item.text.split('\n').slice(0, 20).forEach((line, index) => {
        const lineY = index * fontSize * 1.2;
        if (!fontEngine?.drawShxLine(context, line, item, fontSize, lineY)) context.fillText(line, 0, lineY);
      });
    } else {
      const lines = item.text.split('\n').slice(0, 20);
      const isMText = item.type === 'MTEXT';
      const attachment = Number(item.attachmentPoint) || 1;
      const horizontal = isMText ? (attachment - 1) % 3 : Number(item.halign) || 0;
      const vertical = isMText ? Math.floor((attachment - 1) / 3) : Number(item.valign) || 0;
      context.textAlign = horizontal === 1 || horizontal === 4 ? 'center' : horizontal === 2 ? 'right' : 'left';
      context.textBaseline = isMText ? 'top' : (vertical === 1 ? 'bottom' : vertical === 2 ? 'middle' : vertical === 3 ? 'top' : 'alphabetic');
      const lineHeight = fontSize * 1.2;
      const totalHeight = lines.length * lineHeight;
      const yOffset = isMText ? (vertical === 1 ? -totalHeight / 2 : vertical === 2 ? -totalHeight : 0) : 0;
      const widthFactor = Math.max(0.01, Math.abs(Number(item.widthFactor) || 1));
      const mirrorX = Number(item.generationFlag) & 2 ? -1 : 1;
      const mirrorY = Number(item.generationFlag) & 4 ? -1 : 1;
      context.scale(widthFactor * mirrorX, mirrorY);
      lines.forEach((line, index) => {
        const lineY = yOffset + index * lineHeight;
        if (!fontEngine?.drawShxLine(context, line, item, fontSize, lineY)) context.fillText(line, 0, lineY);
      });
    }
    context.restore();
  }
}

function render() {
  renderPending = false;
  const ratio = Math.min(devicePixelRatio || 1, 2);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.setTransform(camera.scale * ratio, 0, 0, -camera.scale * ratio, camera.x * ratio, camera.y * ratio);
  context.lineWidth = 1 / Math.max(camera.scale, 1e-9);
  for (const stage of STAGES) {
    if (stage.key === 'text' || !visibleStages.has(stage.key)) continue;
    for (const { style, path } of stagePaths.get(stage.key)) {
      context.strokeStyle = resolveCssColor(style);
      context.stroke(path);
    }
  }
  context.restore();
  if (visibleStages.has('text')) renderTexts(ratio);
}

async function openBuffer(name, buffer) {
  resetViewer();
  const generation = loadGeneration;
  openButton.disabled = true;
  setLoading(true);
  openedAt = performance.now();
  status.textContent = `正在解析...读取 ${name}…`;
  worker = new Worker('./parser-worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (generation !== loadGeneration) return;
    if (data.type === 'phase') status.textContent = data.phase === 'decode' ? '正在解析...解码 DWG…' : '正在解析...初始化解析器…';
    if (data.type === 'batch') {
      consumeBatch(data.batch);
      hasOpenedFile = true;
      setLoading(false);
      status.textContent = '正在解析...载入轮廓线…';
    }
    if (data.type === 'done') {
      layerColors = new Map((data.summary.layers ?? []).map((layer) => [layer.name, layer]));
      hasOpenedFile = true;
      document.title = name;
      revealStages(generation, data.timing, data.summary);
    }
    if (data.type === 'error') {
      status.textContent = `打开失败：${data.message}${data.errorCode === 'worker_oom' ? '（内存不足）' : ''}`;
      openButton.disabled = false;
      setLoading(false);
    }
  };
  worker.onerror = (event) => {
    status.textContent = `Worker 错误：${event.message}`;
    openButton.disabled = false;
    setLoading(false);
  };
  worker.postMessage({ type: 'open', buffer }, [buffer]);
}

async function openFile(file) {
  try {
    window.cadViewerDrawingList?.openLocal(file.name);
    await openBuffer(file.name, await file.arrayBuffer());
  } catch (error) {
    status.textContent = `打开失败：${error instanceof Error ? error.message : String(error)}`;
    openButton.disabled = false;
    setLoading(false);
  }
}

async function openUrl(url) {
  const name = decodeURIComponent(new URL(url, window.location.href).pathname.split('/').pop() || '图纸文件');
  try {
    window.cadViewerDrawingList?.openUrl(url);
    setLoading(true);
    status.textContent = `正在解析...下载 ${name}…`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    await openBuffer(name, await response.arrayBuffer());
  } catch (error) {
    status.textContent = `打开失败：${error instanceof Error ? error.message : String(error)}`;
    openButton.disabled = false;
    setLoading(false);
  }
}

openButton.addEventListener('click', () => fileInput.click());
centerOpenButton.addEventListener('click', () => fileInput.click());
toolOpenButton.addEventListener('click', () => fileInput.click());
toolPanButton.addEventListener('click', () => setInteractionMode('pan'));
toolFitButton.addEventListener('click', fitView);
toolZoomWindowButton.addEventListener('click', () => setInteractionMode('zoom-window'));
toolSidebarButton.addEventListener('click', () => {
  const isVisible = !fileSidebarColumn.classList.toggle('is-hidden');
  toolSidebarButton.classList.toggle('is-active', isVisible);
});
toolBackgroundButton.addEventListener('click', () => {
  backgroundColor = backgroundColor === '#090b0e' ? '#f8fafc' : '#090b0e';
  toolBackgroundButton.classList.toggle('is-active', backgroundColor !== '#090b0e');
  scheduleRender();
});
fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0];
  if (file) openFile(file);
  fileInput.value = '';
});
document.querySelector('#predefinedFileList').addEventListener('click', (event) => {
  const button = event.target.closest('.file-list-item');
  if (!button) return;
  const url = button.dataset.fileUrl;
  if (url) {
    openUrl(url);
    return;
  }
  if (button.dataset.localHistory === 'true') {
    fileInput.click();
  }
});
fitButton.addEventListener('click', fitView);
canvas.addEventListener('wheel', (event) => {
  event.preventDefault();
  const factor = Math.exp(-event.deltaY * 0.001);
  const worldX = (event.offsetX - camera.x) / camera.scale;
  const worldY = (camera.y - event.offsetY) / camera.scale;
  camera.scale = Math.max(1e-8, Math.min(1e8, camera.scale * factor));
  camera.x = event.offsetX - worldX * camera.scale;
  camera.y = event.offsetY + worldY * camera.scale;
  scheduleRender();
}, { passive: false });
canvas.addEventListener('pointerdown', (event) => {
  if (interactionMode === 'zoom-window') {
    zoomWindowStart = { x: event.offsetX, y: event.offsetY };
    setZoomWindowBox(zoomWindowStart, zoomWindowStart);
    canvas.setPointerCapture(event.pointerId);
    return;
  }
  drag = { x: event.clientX, y: event.clientY, cameraX: camera.x, cameraY: camera.y };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', (event) => {
  if (zoomWindowStart) {
    setZoomWindowBox(zoomWindowStart, { x: event.offsetX, y: event.offsetY });
    return;
  }
  if (!drag) return;
  camera.x = drag.cameraX + event.clientX - drag.x;
  camera.y = drag.cameraY + event.clientY - drag.y;
  scheduleRender();
});
canvas.addEventListener('pointerup', (event) => {
  if (zoomWindowStart) {
    zoomToWindow(zoomWindowStart, { x: event.offsetX, y: event.offsetY });
    zoomWindowStart = undefined;
    zoomWindow.style.display = 'none';
    setInteractionMode('pan');
    return;
  }
  drag = undefined;
  canvas.classList.remove('dragging');
});
window.addEventListener('resize', resize);
resetViewer();
resize();
