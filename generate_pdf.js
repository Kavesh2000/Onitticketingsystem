const fs = require('fs');
const PDFDocument = require('pdfkit');

const input = 'DOCUMENTATION.md';
const output = 'DOCUMENTATION.pdf';

if (!fs.existsSync(input)) {
  console.error('Input file not found:', input);
  process.exit(1);
}

const md = fs.readFileSync(input, 'utf8');
const doc = new PDFDocument({ margin: 50 });
const stream = fs.createWriteStream(output);
doc.pipe(stream);

const lines = md.split(/\r?\n/);
let bulletIndent = 20;

lines.forEach((raw) => {
  const line = raw.trimRight();
  if (!line) {
    doc.moveDown(0.5);
    return;
  }

  if (line.startsWith('# ')) {
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(18).text(line.replace(/^#\s+/, ''), { continued: false });
    doc.moveDown(0.2);
    return;
  }
  if (line.startsWith('## ')) {
    doc.font('Helvetica-Bold').fontSize(14).text(line.replace(/^##\s+/, ''), { continued: false });
    doc.moveDown(0.1);
    return;
  }
  if (line.startsWith('- ')) {
    doc.font('Helvetica').fontSize(11).text('• ' + line.replace(/^-\s+/, ''), { indent: bulletIndent, paragraphGap: 2 });
    return;
  }

  // Inline code spans: keep backticks as-is or strip
  doc.font('Helvetica').fontSize(11).text(line, { paragraphGap: 2 });
});

doc.end();

stream.on('finish', () => {
  console.log('Created', output);
});
