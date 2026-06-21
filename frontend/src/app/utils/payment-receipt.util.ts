import { Purchase } from '../services/portal-data.service';

export interface PaymentReceiptData {
  purchaseId: number;
  courseTitle: string;
  studentName: string;
  studentEmail: string;
  amountCents: number;
  currency: string;
  status: string;
  provider: string;
  providerReference: string | null;
  paidAt: string | null;
  createdAt: string;
}

export function purchaseToReceiptData(
  purchase: Purchase,
  student: { name: string; email: string },
  courseTitle: string,
): PaymentReceiptData {
  return {
    purchaseId: purchase.id,
    courseTitle,
    studentName: student.name,
    studentEmail: student.email,
    amountCents: purchase.amount_cents,
    currency: purchase.currency,
    status: purchase.status,
    provider: purchase.provider,
    providerReference: purchase.provider_reference,
    paidAt: purchase.paid_at,
    createdAt: purchase.created_at,
  };
}

export function findPurchaseIdFromReceiptSubject(subject: string): number | null {
  const match = subject.match(/#(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function isReceiptMessage(subject: string): boolean {
  return /comprovante de pagamento/i.test(subject);
}

export function receiptDataFromMessage(
  message: { subject: string; details: string; courseId: number | null },
  student: { name: string; email: string },
  courseTitle: string,
): PaymentReceiptData | null {
  const purchaseId = findPurchaseIdFromReceiptSubject(message.subject);
  if (!purchaseId) return null;

  const amountMatch = message.details.match(/Valor pago:\s*(R\$\s*[\d.,]+)/i);
  const referenceMatch = message.details.match(/Referência PIX:\s*(.+)/i);
  const dateMatch = message.details.match(/Data da confirmação:\s*(.+)/i);

  let amountCents = 0;
  if (amountMatch) {
    const normalized = amountMatch[1].replace(/[^\d,]/g, '').replace(',', '.');
    amountCents = Math.round(Number.parseFloat(normalized) * 100);
  }

  const paidAtRaw = dateMatch?.[1]?.trim();
  let paidAt: string | null = null;
  if (paidAtRaw) {
    const parsed = paidAtRaw.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
    if (parsed) {
      const [, day, month, year, hour, minute] = parsed;
      paidAt = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
      ).toISOString();
    }
  }

  return {
    purchaseId,
    courseTitle,
    studentName: student.name,
    studentEmail: student.email,
    amountCents,
    currency: 'BRL',
    status: 'paid',
    provider: 'pix',
    providerReference: referenceMatch?.[1]?.trim() ?? null,
    paidAt,
    createdAt: paidAt ?? new Date().toISOString(),
  };
}

function formatMoney(amountCents: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(
    (amountCents || 0) / 100,
  );
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    paid: 'PAGO',
    approved: 'PAGAMENTO RECEBIDO',
    pending: 'PENDENTE',
    cancelled: 'CANCELADO',
    rejected: 'RECUSADO',
  };
  return labels[status] ?? status.toUpperCase();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildReceiptHtml(data: PaymentReceiptData, logoDataUrl = ''): string {
  const issuedAt = formatDateTime(data.paidAt ?? data.createdAt);
  const amount = formatMoney(data.amountCents, data.currency);
  const reference = escapeHtml(data.providerReference ?? `COMPRA${data.purchaseId}`);
  const logoMarkup = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="" class="watermark-logo" />`
    : '';
  const brandLogoMarkup = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="Starke Academy" class="brand-logo" />`
    : '';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Comprovante #${data.purchaseId} — Starke Academy</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      color: #111;
      background: #fff;
      margin: 0;
      padding: 32px;
      line-height: 1.5;
    }
    .receipt {
      position: relative;
      overflow: hidden;
      max-width: 640px;
      margin: 0 auto;
      border: 2px solid #b8860b;
      border-radius: 12px;
      padding: 28px 32px;
      background: #fff;
    }
    .watermark {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 0;
    }
    .watermark-logo {
      width: 72%;
      max-width: 420px;
      opacity: 0.1;
      transform: rotate(-24deg);
      object-fit: contain;
    }
    .receipt-content {
      position: relative;
      z-index: 1;
    }
    .brand {
      text-align: center;
      border-bottom: 1px solid #ddd;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .brand-logo {
      display: block;
      height: 72px;
      width: auto;
      margin: 0 auto 12px;
      object-fit: contain;
    }
    .brand h1 {
      margin: 0;
      font-size: 22px;
      color: #8b6914;
      letter-spacing: 0.04em;
    }
    .brand p { margin: 4px 0 0; font-size: 12px; color: #666; }
    h2 {
      margin: 0 0 16px;
      font-size: 16px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid #eee;
      vertical-align: top;
      background: rgba(255, 255, 255, 0.72);
    }
    th { width: 38%; color: #555; font-weight: 600; }
    .status-paid {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 999px;
      background: #ecfdf5;
      color: #047857;
      font-weight: 700;
      font-size: 12px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed #ccc;
      font-size: 11px;
      color: #666;
      text-align: center;
      background: rgba(255, 255, 255, 0.72);
    }
    @media print {
      body { padding: 12px; }
      .receipt { border-width: 1px; }
      .watermark-logo { opacity: 0.12; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="watermark" aria-hidden="true">${logoMarkup}</div>
    <div class="receipt-content">
      <div class="brand">
        ${brandLogoMarkup}
        <h1>Starke Academy</h1>
        <p>Comprovante de pagamento</p>
      </div>
      <h2>Recibo de transação</h2>
      <table>
        <tr><th>Comprovante nº</th><td>${data.purchaseId}</td></tr>
        <tr><th>Aluno</th><td>${escapeHtml(data.studentName)}<br /><small>${escapeHtml(data.studentEmail)}</small></td></tr>
        <tr><th>Curso</th><td>${escapeHtml(data.courseTitle)}</td></tr>
        <tr><th>Valor pago</th><td><strong>${amount}</strong></td></tr>
        <tr><th>Referência</th><td>${reference}</td></tr>
        <tr><th>Provedor</th><td>${escapeHtml(data.provider)}</td></tr>
        <tr><th>Data da confirmação</th><td>${issuedAt}</td></tr>
        <tr><th>Status</th><td><span class="status-paid">${formatStatus(data.status)}</span></td></tr>
      </table>
      <div class="footer">
        Documento emitido em ${issuedAt}.<br />
        Este comprovante comprova o pagamento do curso indicado na Starke Academy.
      </div>
    </div>
  </div>
  <p class="no-print" style="text-align:center;margin-top:16px;font-size:12px;color:#666;">
    A janela de impressão abrirá automaticamente. Você pode fechar esta aba após imprimir.
  </p>
</body>
</html>`;
}

async function resolveLogoDataUrl(): Promise<string> {
  const paths = ['assets/logo-login.png', 'assets/logo-academy.png'];
  for (const path of paths) {
    try {
      const response = await fetch(`${window.location.origin}/${path}`);
      if (!response.ok) continue;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('logo read failed'));
        reader.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    } catch {
      // try next asset
    }
  }
  return '';
}

function printViaIframe(html: string): boolean {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Comprovante de pagamento');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const doc = iframe.contentDocument ?? frameWindow?.document;
  if (!doc || !frameWindow) {
    iframe.remove();
    return false;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = (): void => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(() => iframe.remove(), 1000);
  };

  if (doc.readyState === 'complete') {
    window.setTimeout(triggerPrint, 150);
  } else {
    iframe.onload = () => window.setTimeout(triggerPrint, 150);
  }

  return true;
}

export async function printPaymentReceipt(data: PaymentReceiptData): Promise<boolean> {
  const logoDataUrl = await resolveLogoDataUrl();
  const html = buildReceiptHtml(data, logoDataUrl);

  try {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, '_blank', 'width=720,height=900');
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.focus();
        printWindow.print();
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      };
      return true;
    }
    URL.revokeObjectURL(url);
  } catch {
    // fallback below
  }

  const printWindow = window.open('', '_blank', 'width=720,height=900');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
    return true;
  }

  return printViaIframe(html);
}
