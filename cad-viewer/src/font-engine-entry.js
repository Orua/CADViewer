import { ShxFont, ShxFontType } from '@mlightcad/shx-parser';
import iconv from 'iconv-lite';

const NORMALIZED_SHX_SIZE = 100;
const SYSTEM_FONT_STACK = '"Microsoft YaHei", "SimSun", sans-serif';

function normalizeName(value) {
  return String(value || '')
    .trim()
    .replace(/^.*[\\/]/, '')
    .replace(/\.(shx|ttf|otf|woff2?)$/i, '')
    .toLocaleLowerCase();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeBaseUrl(value) {
  const url = new URL(value || '../cad-data/', document.baseURI);
  if (!url.pathname.endsWith('/')) url.pathname += '/';
  return url.href;
}

function resolveFontsBaseUrl(dataBaseUrl) {
  const normalized = normalizeBaseUrl(dataBaseUrl);
  return /\/fonts\/$/i.test(new URL(normalized).pathname)
    ? normalized
    : new URL('fonts/', normalized).href;
}

function safeFamilyName(name) {
  return `CadViewer_${normalizeName(name).replace(/[^a-z0-9_-]/g, '_') || 'font'}`;
}

export class CadFontEngine {
  constructor(options = {}) {
    this.dataBaseUrl = normalizeBaseUrl(options.dataBaseUrl);
    this.fontsBaseUrl = resolveFontsBaseUrl(this.dataBaseUrl);
    this.metadata = [];
    this.aliasMap = new Map();
    this.loaded = new Map();
    this.inFlight = new Map();
    this.styleMap = new Map();
    this.state = {
      dataBaseUrl: this.dataBaseUrl,
      metadataUrl: new URL('fonts.json', this.fontsBaseUrl).href,
      requested: [],
      loaded: [],
      failed: [],
      rerendered: false,
    };
  }

  async loadMetadata() {
    if (this.metadata.length) return this.metadata;
    const response = await fetch(this.state.metadataUrl, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`字体清单 HTTP ${response.status}`);
    const metadata = await response.json();
    if (!Array.isArray(metadata)) throw new Error('字体清单格式无效');
    this.metadata = metadata;
    for (const entry of metadata) {
      const aliases = unique([
        ...(Array.isArray(entry.name) ? entry.name : []),
        entry.file,
      ].map(normalizeName));
      for (const alias of aliases) this.aliasMap.set(alias, entry);
    }
    return metadata;
  }

  setTextStyles(styles = []) {
    this.styleMap.clear();
    for (const style of styles) {
      const key = normalizeName(style.name);
      if (key) this.styleMap.set(key, style);
    }
  }

  findEntry(name) {
    return this.aliasMap.get(normalizeName(name));
  }

  async loadEntry(entry) {
    const key = normalizeName(entry.file || entry.name?.[0]);
    if (!key) return null;
    if (this.loaded.has(key)) return this.loaded.get(key);
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const pending = (async () => {
      const url = new URL(entry.file, this.fontsBaseUrl).href;
      const response = await fetch(url, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`${entry.file} HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      let loadedFont;
      if (entry.type === 'shx' || /\.shx$/i.test(entry.file)) {
        loadedFont = {
          type: 'shx',
          key,
          entry,
          url,
          encoding: entry.encoding,
          font: new ShxFont(buffer),
        };
      } else {
        const family = safeFamilyName(key);
        const face = new FontFace(family, buffer);
        await face.load();
        document.fonts.add(face);
        loadedFont = { type: 'mesh', key, entry, url, family, face };
      }
      const aliases = unique([
        key,
        entry.file,
        ...(Array.isArray(entry.name) ? entry.name : []),
      ].map(normalizeName));
      for (const alias of aliases) this.loaded.set(alias, loadedFont);
      return loadedFont;
    })();

    this.inFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      this.inFlight.delete(key);
    }
  }

  styleForItem(item) {
    return this.styleMap.get(normalizeName(item.styleName));
  }

  requestedNames(textItems) {
    const names = new Set(['simsun']);
    for (const item of textItems) {
      const style = this.styleForItem(item);
      if (style?.font) names.add(normalizeName(style.font));
      if (style?.bigFont) names.add(normalizeName(style.bigFont));
      if (!style?.font && item.styleName) names.add(normalizeName(item.styleName));
    }
    return [...names].filter(Boolean);
  }

  async prepare(textItems, textStyles) {
    this.state.rerendered = false;
    this.setTextStyles(textStyles);
    await this.loadMetadata();
    const names = this.requestedNames(textItems);
    this.state.requested = names;
    const results = await Promise.allSettled(names.map(async (name) => {
      const entry = this.findEntry(name);
      if (!entry) throw new Error(`${name} 不在字体清单中`);
      const loaded = await this.loadEntry(entry);
      return { name, loaded };
    }));
    this.state.loaded = [];
    this.state.failed = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') this.state.loaded.push(names[index]);
      else this.state.failed.push({ name: names[index], message: String(result.reason?.message || result.reason) });
    });
    return this.snapshot();
  }

  snapshot() {
    return JSON.parse(JSON.stringify(this.state));
  }

  loadedByName(name) {
    return this.loaded.get(normalizeName(name));
  }

  candidatesForItem(item) {
    const style = this.styleForItem(item);
    return unique([
      style?.font,
      style?.bigFont,
      item.styleName,
      'simsun',
    ].map(normalizeName)).map((name) => this.loadedByName(name)).filter(Boolean);
  }

  canvasFontStack(item, fontSize) {
    const families = unique(this.candidatesForItem(item)
      .filter((font) => font.type === 'mesh')
      .map((font) => `"${font.family}"`));
    families.push(SYSTEM_FONT_STACK);
    return `${Math.min(Math.max(fontSize, 3), 160)}px ${families.join(', ')}`;
  }

  shxCode(font, char) {
    const type = font.font.fontData.header.fontType;
    if (type === ShxFontType.BIGFONT && font.encoding) {
      const encoded = iconv.encode(char, font.encoding);
      if (iconv.decode(encoded, font.encoding) !== char) return -1;
      let code = 0;
      for (const byte of encoded) code = (code << 8) | byte;
      return code;
    }
    return char.codePointAt(0) ?? -1;
  }

  shxGlyph(font, char) {
    if (font.type !== 'shx') return null;
    const code = this.shxCode(font, char);
    if (code < 0) return null;
    const shape = font.font.getLayoutCharShape(code, NORMALIZED_SHX_SIZE);
    if (!shape) return null;
    const advance = Number(shape.lastPoint?.x);
    return {
      font,
      shape,
      advance: Number.isFinite(advance) && advance > 0
        ? advance
        : Math.max(NORMALIZED_SHX_SIZE * 0.5, shape.bbox.maxX - shape.bbox.minX),
    };
  }

  layoutShx(text, item) {
    const shxFonts = this.candidatesForItem(item).filter((font) => font.type === 'shx');
    if (!shxFonts.length) return null;
    const glyphs = [];
    let x = 0;
    let hasShx = false;
    for (const char of text) {
      if (char === ' ') {
        const advance = NORMALIZED_SHX_SIZE * 0.5;
        glyphs.push({ char, x, advance, glyph: null });
        x += advance;
        continue;
      }
      let glyph = null;
      for (const font of shxFonts) {
        glyph = this.shxGlyph(font, char);
        if (glyph) break;
      }
      const advance = glyph?.advance || NORMALIZED_SHX_SIZE * 0.62;
      glyphs.push({ char, x, advance, glyph });
      x += advance;
      hasShx ||= Boolean(glyph);
    }
    return hasShx ? { glyphs, width: x } : null;
  }

  drawShxLine(context, text, item, fontSize, y = 0) {
    const layout = this.layoutShx(text, item);
    if (!layout) return false;
    const scale = fontSize / NORMALIZED_SHX_SIZE;
    let offsetX = 0;
    if (context.textAlign === 'center') offsetX = -layout.width * scale / 2;
    else if (context.textAlign === 'right' || context.textAlign === 'end') offsetX = -layout.width * scale;
    const baselineShift = context.textBaseline === 'top'
      ? fontSize * 0.82
      : context.textBaseline === 'middle'
        ? fontSize * 0.32
        : context.textBaseline === 'bottom'
          ? -fontSize * 0.18
          : 0;
    const path = new Path2D();
    const missing = [];
    for (const placed of layout.glyphs) {
      if (!placed.glyph) {
        if (placed.char !== ' ') missing.push(placed);
        continue;
      }
      for (const polyline of placed.glyph.shape.polylines) {
        if (polyline.length < 2) continue;
        path.moveTo(offsetX + (placed.x + polyline[0].x) * scale, y + baselineShift - polyline[0].y * scale);
        for (let index = 1; index < polyline.length; index += 1) {
          path.lineTo(offsetX + (placed.x + polyline[index].x) * scale, y + baselineShift - polyline[index].y * scale);
        }
      }
    }
    context.save();
    context.strokeStyle = context.fillStyle;
    context.lineWidth = Math.max(0.65, fontSize * 0.035);
    context.stroke(path);
    context.font = this.canvasFontStack(item, fontSize);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    for (const placed of missing) {
      context.fillText(placed.char, offsetX + placed.x * scale, y + baselineShift);
    }
    context.restore();
    return true;
  }
}
