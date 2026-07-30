'use strict';

const fs = require('fs-extra');
const path = require('path');
const dayjs = require('dayjs');
const XLSX = require('xlsx');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { ROOT } = require('../config/constants');

async function exportToExcel({ fileName, title, sheets, lang = 'ar' }) {
  await fs.ensureDir(ROOT.exports);
  const safe = String(fileName || 'report').replace(/[\\/:*?"<>|]/g, '_');
  const outPath = path.join(ROOT.exports, `${safe}-${dayjs().format('YYYYMMDD-HHmmss')}.xlsx`);
  const wb = XLSX.utils.book_new();

  const dataSheets = Array.isArray(sheets) ? sheets.filter(Boolean) : (sheets ? [sheets] : []);
  if (!dataSheets.length) throw new Error('No data to export');

  for (const sheet of dataSheets) {
    const columns = Array.isArray(sheet.columns) ? sheet.columns : [];
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    const header = columns.map((c) => (typeof c.label === 'object' ? c.label[lang] || c.label.en : c.label));
    const body = rows.map((row) => {
      const r = {};
      for (const c of columns) r[typeof c.label === 'object' ? (c.label[lang] || c.label.en) : c.label] = row[c.key];
      return r;
    });
    if (!body.length) continue;
    const ws = XLSX.utils.json_to_sheet(body, { header });
    ws['!cols'] = columns.map(() => ({ wch: 20 }));
    XLSX.utils.book_append_sheet(wb, ws, (sheet.name && (sheet.name[lang] || sheet.name.en)) || 'Sheet');
  }

  if (!wb.SheetNames.length) throw new Error('Workbook is empty');

  XLSX.writeFile(wb, outPath);
  return { path: outPath, fileName: path.basename(outPath) };
}

async function exportToPdf({ fileName, title, meta = [], columns = [], rows = [], lang = 'ar' }) {
  await fs.ensureDir(ROOT.exports);
  const safe = String(fileName || 'report').replace(/[\\/:*?"<>|]/g, '_');
  const outPath = path.join(ROOT.exports, `${safe}-${dayjs().format('YYYYMMDD-HHmmss')}.pdf`);

  const doc = await PDFDocument.create();
  let font;
  const fontCandidates = [
    path.join(__dirname, '..', 'assets', 'fonts', 'Rubik-Regular.ttf'),
    path.join(__dirname, '..', 'assets', 'fonts', 'Cairo-Regular.ttf'),
    'C:\\Windows\\Fonts\\arial.ttf',
    'C:\\Windows\\Fonts\\segoeui.ttf',
  ];
  for (const candidate of fontCandidates) {
    try {
      if (await fs.pathExists(candidate)) {
        font = await doc.embedFont(await fs.readFile(candidate));
        break;
      }
    } catch (_) {}
  }
  if (!font) {
    font = await doc.embedFont(StandardFonts.Helvetica);
  }

  const pageWidth = 595.28;
  const margin = 40;
  let page = doc.addPage([pageWidth, 841.89]);
  let y = 800;
  const lineH = 18;

  const draw = (text, x, yy, size = 11, opts = {}) => {
    page.drawText(String(text ?? ''), { x, y: yy, size, font, color: rgb(0.1, 0.1, 0.1), ...opts });
  };

  draw((title && (title[lang] || title.en)) || 'Report', margin, y, 16);
  y -= lineH;
  for (const m of meta) {
    draw((m.label[lang] || m.label.en) + ': ' + m.value, margin, y, 10);
    y -= 14;
  }
  y -= 6;
  draw(''.padEnd(90, '-'), margin, y, 9, { color: rgb(0.6, 0.6, 0.6) });
  y -= lineH;

  const colX = [];
  let cursor = margin;
  const colWidth = (pageWidth - margin * 2) / Math.max(columns.length, 1);
  for (const c of columns) { colX.push(cursor); cursor += colWidth; }

  draw(''.padEnd(90, '-'), margin, y, 9, { color: rgb(0.6, 0.6, 0.6) });
  y -= lineH;
  for (const row of rows) {
    if (y < margin + lineH) { page = doc.addPage([pageWidth, 841.89]); y = 800; }
    columns.forEach((c, i) => {
      draw(row[c.key], colX[i], y, 9);
    });
    y -= lineH;
  }

  const bytes = await doc.save();
  await fs.writeFile(outPath, bytes);
  return { path: outPath, fileName: path.basename(outPath) };
}

module.exports = { exportToExcel, exportToPdf };
