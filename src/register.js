const fs = require('fs');
const path = require('path');

const REGISTER_PATH = path.join(__dirname, '..', 'content', 'content-register.csv');

function csvEscape(value) {
  const s = String(value == null ? '' : value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function loadRegister() {
  if (!fs.existsSync(REGISTER_PATH)) {
    return [];
  }
  const lines = fs.readFileSync(REGISTER_PATH, 'utf8').split('\n').filter(Boolean);
  const headers = lines[0].split(',');
  const titleIndex = headers.indexOf('ArticleTitle');
  const statusIndex = headers.indexOf('PublishingStatus');
  if (titleIndex < 0) return [];
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      title: cols[titleIndex] || '',
      status: statusIndex >= 0 ? cols[statusIndex] || '' : '',
    };
  });
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cols.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cols.push(cur);
  return cols;
}

async function loadRegisterTitles() {
  const rows = await loadRegister();
  return rows.map((r) => r.title).filter(Boolean);
}

async function addRegisterEntry(entry) {
  const headers = [
    'PublicationDate',
    'ArticleTitle',
    'URL',
    'PrimaryKeyword',
    'SupportingKeywords',
    'SearchIntent',
    'TopicCategory',
    'InternalPagesLinked',
    'PublishingStatus',
    'PerformanceResults',
  ];
  const line = headers.map((h) => csvEscape(entry[h] || '')).join(',');
  fs.appendFileSync(REGISTER_PATH, '\n' + line);
}

module.exports = { loadRegister, loadRegisterTitles, addRegisterEntry };
