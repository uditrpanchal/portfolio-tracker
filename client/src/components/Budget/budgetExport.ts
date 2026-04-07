import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { BudgetCategory, BudgetStore } from './types';
import { toMonthly, getSymbol, MONTHS } from './budgetHelpers';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmt(value: number, symbol: string) {
  return `${symbol}${value.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function catTotal(cat: BudgetCategory, field: 'target' | 'actual') {
  return cat.items.reduce((s, it) => {
    const raw = parseFloat(field === 'target' ? it.targetRaw : it.actualRaw) || 0;
    return s + toMonthly(raw, it.frequency);
  }, 0);
}

function buildRows(cats: BudgetCategory[]) {
  return cats.map(cat => ({
    cat,
    target: catTotal(cat, 'target'),
    actual: catTotal(cat, 'actual'),
  }));
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

export function exportCSV(
  store: BudgetStore,
  monthKey: string,
  carryForward: number,
) {
  const { currency, months } = store;
  const symbol = getSymbol(currency);
  const data = months[monthKey];
  const [year, mon] = monthKey.split('-');
  const monthLabel = `${MONTHS[parseInt(mon) - 1]} ${year}`;

  const rows: string[][] = [];

  // Header
  rows.push([`Budget Planner — ${monthLabel}`]);
  rows.push([`Currency: ${currency}`]);
  rows.push([]);

  for (const cat of (data?.categories ?? [])) {
    rows.push([cat.label.toUpperCase()]);
    rows.push(['Category', 'Item', 'Frequency', 'Monthly Target', 'Actual Spent', 'Difference']);
    for (const it of cat.items) {
      const tgt = toMonthly(parseFloat(it.targetRaw) || 0, it.frequency);
      const act = toMonthly(parseFloat(it.actualRaw) || 0, it.frequency);
      const diff = cat.type === 'income' ? act - tgt : tgt - act;
      if (tgt === 0 && act === 0) continue;
      rows.push([
        cat.label,
        it.label,
        it.frequency,
        fmt(tgt, symbol),
        fmt(act, symbol),
        fmt(diff, symbol),
      ]);
    }
    const ct = catTotal(cat, 'target');
    const ca = catTotal(cat, 'actual');
    rows.push(['', `SUBTOTAL`, '', fmt(ct, symbol), fmt(ca, symbol), '']);
    rows.push([]);
  }

  // Summary
  const cats = data?.categories ?? [];
  const income = cats.filter(c => c.type === 'income');
  const expenses = cats.filter(c => c.type === 'expense');
  const totalIncome = income.reduce((s, c) => s + catTotal(c, 'actual'), 0);
  const totalExpenses = expenses.reduce((s, c) => s + catTotal(c, 'actual'), 0);
  const net = totalIncome + carryForward - totalExpenses;

  rows.push(['SUMMARY']);
  rows.push(['Total Income', fmt(totalIncome, symbol)]);
  rows.push(['Total Expenses', fmt(totalExpenses, symbol)]);
  if (carryForward !== 0) rows.push(['Carry Forward', fmt(carryForward, symbol)]);
  rows.push(['Net Balance', fmt(net, symbol)]);

  const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-${monthKey}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF ─────────────────────────────────────────────────────────────────────

export function exportPDF(
  store: BudgetStore,
  monthKey: string,
  carryForward: number,
) {
  const { currency, months } = store;
  const symbol = getSymbol(currency);
  const data = months[monthKey];
  const [year, mon] = monthKey.split('-');
  const monthLabel = `${MONTHS[parseInt(mon) - 1]} ${year}`;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Title block ─────────────────────────────────────────────────────────
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Budget Planner', 14, 12);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text(`${monthLabel}   ·   ${currency}`, 14, 20);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageW - 14, 20, { align: 'right' });

  let y = 36;

  const cats = data?.categories ?? [];
  const incomes = cats.filter(c => c.type === 'income');
  const expenses = cats.filter(c => c.type === 'expense');
  const totalIncome = incomes.reduce((s, c) => s + catTotal(c, 'actual'), 0);
  const totalExpenses = expenses.reduce((s, c) => s + catTotal(c, 'actual'), 0);
  const net = totalIncome + carryForward - totalExpenses;

  // ── Summary row ─────────────────────────────────────────────────────────
  const summaryData = [
    ['Total Income', fmt(totalIncome, symbol)],
    ['Total Expenses', fmt(totalExpenses, symbol)],
    ...(carryForward !== 0 ? [['Carry Forward', fmt(carryForward, symbol)]] : []),
    ['Net Balance', fmt(net, symbol)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Summary', 'Amount']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 0: { cellWidth: 120 }, 1: { cellWidth: 50, halign: 'right' } },
    didParseCell(hookData) {
      if (hookData.section === 'body') {
        const label = hookData.row.raw as string[];
        if (label[0] === 'Net Balance') {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.textColor = net >= 0 ? [16, 185, 129] : [239, 68, 68];
        }
      }
    },
    margin: { left: 14, right: 14 },
  });

  y = (doc as any).lastAutoTable.finalY + 10;

  // ── Category tables ─────────────────────────────────────────────────────
  for (const cat of cats) {
    const rows: (string | number)[][] = [];
    for (const it of cat.items) {
      const tgt = toMonthly(parseFloat(it.targetRaw) || 0, it.frequency);
      const act = toMonthly(parseFloat(it.actualRaw) || 0, it.frequency);
      if (tgt === 0 && act === 0) continue;
      const diff = cat.type === 'income' ? act - tgt : tgt - act;
      rows.push([it.label, it.frequency.charAt(0).toUpperCase() + it.frequency.slice(1), fmt(tgt, symbol), fmt(act, symbol), fmt(diff, symbol)]);
    }
    if (rows.length === 0) continue;

    // section header colour: green for income, indigo for expense
    const headerColor: [number, number, number] = cat.type === 'income' ? [5, 150, 105] : [79, 70, 229];

    autoTable(doc, {
      startY: y,
      head: [[{ content: cat.label, colSpan: 5, styles: { halign: 'left', fontStyle: 'bold' } }], ['Item', 'Frequency', 'Target / mo', 'Actual / mo', 'Diff']],
      body: rows as string[][],
      foot: [['', 'SUBTOTAL', fmt(catTotal(cat, 'target'), symbol), fmt(catTotal(cat, 'actual'), symbol), '']],
      theme: 'striped',
      headStyles: { fillColor: headerColor, textColor: 255, fontSize: 8, fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 30, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: 14, right: 14 },
    });

    y = (doc as any).lastAutoTable.finalY + 6;

    // page break guard
    if (y > doc.internal.pageSize.getHeight() - 30) {
      doc.addPage();
      y = 20;
    }
  }

  // footer
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Budget Planner · ${monthLabel} · Page ${i} of ${totalPages}`, pageW / 2, doc.internal.pageSize.getHeight() - 6, { align: 'center' });
  }

  doc.save(`budget-${monthKey}.pdf`);
}
