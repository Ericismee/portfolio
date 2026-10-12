import { DOMParser } from '@xmldom/xmldom';
import { unzipSync } from 'fflate';

const invalid = () => new Error('Unsupported or unsafe document / Tài liệu không hợp lệ hoặc không an toàn');
export function utf8(bytes: Uint8Array) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw invalid();
  return text;
}
function xml(text: string) {
  // No DTDs, entity declarations or stylesheet processing instructions.
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(text)) throw invalid();
  return new DOMParser({ onError: () => { throw invalid(); } }).parseFromString(text, 'application/xml');
}
export function validateSvg(bytes: Uint8Array) {
  if (bytes.byteLength > 1024 * 1024) throw new Error('SVG up to 1 MB / SVG tối đa 1 MB');
  const doc = xml(utf8(bytes));
  if (doc.documentElement?.localName !== 'svg' || doc.documentElement.namespaceURI !== 'http://www.w3.org/2000/svg') throw invalid();
  const tags = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','defs','linearGradient','radialGradient','stop','clipPath','mask','use']);
  const attrs = new Set(['xmlns','xmlns:xlink','id','viewBox','width','height','x','y','x1','x2','y1','y2','cx','cy','r','rx','ry','d','points','fill','fill-rule','fill-opacity','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-miterlimit','stroke-dasharray','stroke-dashoffset','stroke-opacity','opacity','transform','preserveAspectRatio','offset','stop-color','stop-opacity','gradientUnits','gradientTransform','spreadMethod','fx','fy','fr','clip-path','clip-rule','clipPathUnits','mask','maskUnits','maskContentUnits','font-size','font-family','font-weight','text-anchor','dominant-baseline','dx','dy','href','xlink:href']);
  const nodes = doc.getElementsByTagName('*');
  if (nodes.length > 10000) throw invalid();
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes.item(i)!;
    if (!tags.has(node.tagName) || node.namespaceURI !== 'http://www.w3.org/2000/svg') throw invalid();
    for (let j = 0; j < node.attributes.length; j++) {
      const a = node.attributes.item(j)!;
      if (!attrs.has(a.name) || /[\\\x00-\x1f]/.test(a.value)) throw invalid();
      if (a.name.endsWith('href') && !/^#[\w.-]+$/.test(a.value)) throw invalid();
      if (/url\s*\(/i.test(a.value) && !/^url\(#[\w.-]+\)$/.test(a.value)) throw invalid();
      if (/javascript:|data:|https?:|@import|expression\s*\(/i.test(a.value) && !a.name.startsWith('xmlns')) throw invalid();
    }
  }
}
export function docxText(bytes: Uint8Array) {
  // Inspect every central-directory entry before allocating its expanded contents.
  let expanded = 0, count = 0;
  const entries = unzipSync(bytes, { filter: (entry) => {
    expanded += entry.originalSize;
    if (++count > 512 || expanded > 40 * 1024 * 1024 || entry.originalSize > 8 * 1024 * 1024 || /(?:^|\/)\.\.(?:\/|$)|\\|vbaProject|activeX|embeddings/i.test(entry.name)) throw invalid();
    return ['[Content_Types].xml', 'word/document.xml'].includes(entry.name);
  } });
  if (!entries['[Content_Types].xml'] || !entries['word/document.xml']) throw invalid();
  const types = xml(utf8(entries['[Content_Types].xml']));
  if (!Array.from(types.getElementsByTagName('Override')).some(n => n.getAttribute('PartName') === '/word/document.xml' && n.getAttribute('ContentType') === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')) throw invalid();
  const doc = xml(utf8(entries['word/document.xml']));
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  if (doc.documentElement.localName !== 'document' || doc.documentElement.namespaceURI !== ns) throw invalid();
  const paragraphs = doc.getElementsByTagNameNS(ns, 'p');
  const result: string[] = [];
  let length = 0;
  for (let i = 0; i < paragraphs.length && length < 100000; i++) {
    const texts = paragraphs.item(i)!.getElementsByTagNameNS(ns, 't');
    const text = Array.from(texts).map(n => n.textContent || '').join('');
    result.push(text); length += text.length;
  }
  return result.join('\n\n').slice(0, 100000);
}
