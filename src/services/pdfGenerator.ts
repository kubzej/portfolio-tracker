import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Portfolio,
  TransactionWithStock,
  OptionTransaction,
} from '@/types';

// ASCII-only formatting functions for PDF (jsPDF doesn't support UTF-8 in standard fonts)

function removeDiacritics(str: string): string {
  const map: Record<string, string> = {
    á: 'a',
    č: 'c',
    ď: 'd',
    é: 'e',
    ě: 'e',
    í: 'i',
    ň: 'n',
    ó: 'o',
    ř: 'r',
    š: 's',
    ť: 't',
    ú: 'u',
    ů: 'u',
    ý: 'y',
    ž: 'z',
    Á: 'A',
    Č: 'C',
    Ď: 'D',
    É: 'E',
    Ě: 'E',
    Í: 'I',
    Ň: 'N',
    Ó: 'O',
    Ř: 'R',
    Š: 'S',
    Ť: 'T',
    Ú: 'U',
    Ů: 'U',
    Ý: 'Y',
    Ž: 'Z',
  };
  return str.replace(/[áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ]/g, (c) => map[c] || c);
}

function pdfFormatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function pdfFormatPrice(
  value: number | null | undefined,
  currency: string
): string {
  if (value === null || value === undefined) return '-';
  const num = pdfFormatNumber(value);
  return `${num} ${currency}`;
}

function pdfFormatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
}

interface PDFGeneratorOptions {
  portfolioName: string;
  dateFrom: string;
  dateTo: string;
  stockTransactions: TransactionWithStock[];
  optionTransactions: OptionTransaction[];
  summary: {
    stockTxCount: number;
    stockBuyCount: number;
    stockSellCount: number;
    totalStockBuyCzk: number;
    totalStockSellCzk: number;
    optionTxCount: number;
    optionPremiumIn: number;
    optionPremiumOut: number;
    optionNetPremium: number;
    optionFees: number;
  };
  portfolios: Portfolio[];
}

export async function generateTransactionsPDF(
  options: PDFGeneratorOptions
): Promise<void> {
  const {
    portfolioName,
    dateFrom,
    dateTo,
    stockTransactions,
    optionTransactions,
    summary,
    portfolios,
  } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let currentY = margin;

  // Helper to add new page if needed
  const checkNewPage = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - margin) {
      doc.addPage();
      currentY = margin;
      return true;
    }
    return false;
  };

  // ===== HEADER =====
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Transaction Report', margin, currentY);
  currentY += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Portfolio: ${removeDiacritics(portfolioName)}`, margin, currentY);
  currentY += 6;

  const dateRangeText = `Period: ${pdfFormatDate(dateFrom)} - ${pdfFormatDate(
    dateTo
  )}`;
  doc.text(dateRangeText, margin, currentY);
  currentY += 6;

  const generatedText = `Generated: ${pdfFormatDate(
    new Date().toISOString().split('T')[0]
  )}`;
  doc.text(generatedText, margin, currentY);
  currentY += 12;

  // ===== SUMMARY =====
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', margin, currentY);
  currentY += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  // Stock summary
  if (stockTransactions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Stocks:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;

    const stockSummaryData = [
      ['Total transactions', summary.stockTxCount.toString()],
      ['Buys', `${summary.stockBuyCount}x`],
      ['Sells', `${summary.stockSellCount}x`],
      ['Total bought (CZK)', pdfFormatPrice(summary.totalStockBuyCzk, 'CZK')],
      ['Total sold (CZK)', pdfFormatPrice(summary.totalStockSellCzk, 'CZK')],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [],
      body: stockSummaryData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 40 },
      },
      margin: { left: margin },
    });

    currentY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 8;
  }

  // Option summary
  if (optionTransactions.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Options:', margin, currentY);
    doc.setFont('helvetica', 'normal');
    currentY += 5;

    const optionSummaryData = [
      ['Total transactions', summary.optionTxCount.toString()],
      [
        'Premium received (USD)',
        pdfFormatPrice(summary.optionPremiumIn, 'USD'),
      ],
      ['Premium paid (USD)', pdfFormatPrice(summary.optionPremiumOut, 'USD')],
      ['Net premium (USD)', pdfFormatPrice(summary.optionNetPremium, 'USD')],
      ['Fees (USD)', pdfFormatPrice(summary.optionFees, 'USD')],
    ];

    autoTable(doc, {
      startY: currentY,
      head: [],
      body: optionSummaryData,
      theme: 'plain',
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 50 },
        1: { cellWidth: 40 },
      },
      margin: { left: margin },
    });

    currentY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ===== STOCK TRANSACTIONS TABLE =====
  if (stockTransactions.length > 0) {
    checkNewPage(30);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Stock Transactions (${stockTransactions.length})`,
      margin,
      currentY
    );
    currentY += 8;

    const stockTableData = stockTransactions.map((tx) => [
      pdfFormatDate(tx.date),
      tx.stock?.ticker || '-',
      removeDiacritics(tx.stock?.name || '-'),
      removeDiacritics(
        portfolios.find((p) => p.id === tx.portfolio_id)?.name || '-'
      ),
      tx.type === 'BUY' ? 'Buy' : 'Sell',
      tx.quantity.toString(),
      pdfFormatPrice(tx.price_per_share, tx.currency),
      pdfFormatPrice(tx.total_amount, tx.currency),
      tx.fees ? pdfFormatPrice(tx.fees, tx.currency) : '-',
      pdfFormatPrice(tx.total_amount_czk, 'CZK'),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'Date',
          'Ticker',
          'Name',
          'Portfolio',
          'Type',
          'Quantity',
          'Price',
          'Total',
          'Fees',
          'Total CZK',
        ],
      ],
      body: stockTableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 }, // Date
        1: { cellWidth: 18 }, // Ticker
        2: { cellWidth: 40 }, // Name
        3: { cellWidth: 25 }, // Portfolio
        4: { cellWidth: 14 }, // Type
        5: { cellWidth: 18, halign: 'right' }, // Quantity
        6: { cellWidth: 22, halign: 'right' }, // Price
        7: { cellWidth: 25, halign: 'right' }, // Total
        8: { cellWidth: 18, halign: 'right' }, // Fees
        9: { cellWidth: 28, halign: 'right' }, // Total CZK
      },
      margin: { left: margin, right: margin },
    });

    currentY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ===== OPTION TRANSACTIONS TABLE =====
  if (optionTransactions.length > 0) {
    checkNewPage(30);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `Option Transactions (${optionTransactions.length})`,
      margin,
      currentY
    );
    currentY += 8;

    const optionTableData = optionTransactions.map((tx) => [
      pdfFormatDate(tx.date),
      tx.symbol,
      tx.option_type.toUpperCase(),
      `$${tx.strike_price}`,
      pdfFormatDate(tx.expiration_date),
      tx.action,
      tx.contracts.toString(),
      tx.premium !== null ? pdfFormatPrice(tx.premium, 'USD') : '-',
      tx.total_premium !== null ? pdfFormatPrice(tx.total_premium, 'USD') : '-',
      tx.fees ? pdfFormatPrice(tx.fees, 'USD') : '-',
      removeDiacritics(
        portfolios.find((p) => p.id === tx.portfolio_id)?.name || '-'
      ),
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          'Date',
          'Symbol',
          'Type',
          'Strike',
          'Expiration',
          'Action',
          'Contracts',
          'Premium',
          'Total',
          'Fees',
          'Portfolio',
        ],
      ],
      body: optionTableData,
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: 255,
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 22 }, // Date
        1: { cellWidth: 18 }, // Symbol
        2: { cellWidth: 12 }, // Type
        3: { cellWidth: 18 }, // Strike
        4: { cellWidth: 22 }, // Expiration
        5: { cellWidth: 18 }, // Action
        6: { cellWidth: 18, halign: 'right' }, // Contracts
        7: { cellWidth: 22, halign: 'right' }, // Premium
        8: { cellWidth: 25, halign: 'right' }, // Total
        9: { cellWidth: 18, halign: 'right' }, // Fees
        10: { cellWidth: 25 }, // Portfolio
      },
      margin: { left: margin, right: margin },
    });

    currentY =
      (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable
        .finalY + 10;
  }

  // ===== FOOTER =====
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 10,
      { align: 'right' }
    );
    doc.text('Portfolio Tracker - Transaction Report', margin, pageHeight - 10);
  }

  // Generate filename
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const portfolioStr = removeDiacritics(portfolioName)
    .replace(/\s+/g, '_')
    .toLowerCase();
  const filename = `report_${portfolioStr}_${dateStr}.pdf`;

  // Save the PDF
  doc.save(filename);
}
