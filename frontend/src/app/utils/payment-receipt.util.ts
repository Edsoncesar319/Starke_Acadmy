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

function buildReceiptHtml(data: PaymentReceiptData): string {
  const issuedAt = formatDateTime(data.paidAt ?? data.createdAt);
  const amount = formatMoney(data.amountCents, data.currency);
  const reference = escapeHtml(data.providerReference ?? `COMPRA${data.purchaseId}`);

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
      max-width: 640px;
      margin: 0 auto;
      border: 2px solid #b8860b;
      border-radius: 12px;
      padding: 28px 32px;
    }
    .brand {
      text-align: center;
      border-bottom: 1px solid #ddd;
      padding-bottom: 16px;
      margin-bottom: 20px;
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
    }
    @media print {
      body { padding: 12px; }
      .receipt { border-width: 1px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="brand">
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
  <p class="no-print" style="text-align:center;margin-top:16px;font-size:12px;color:#666;">
    A janela de impressão abrirá automaticamente. Você pode fechar esta aba após imprimir.
  </p>
  <script>
    window.onload = function() {
      setTimeout(function() { window.print(); }, 300);
    };
  </script>
</body>
</html>`;
}

export function printPaymentReceipt(data: PaymentReceiptData): boolean {
  const html = buildReceiptHtml(data);
  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=900');
  if (!printWindow) {
    return false;
  }
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
