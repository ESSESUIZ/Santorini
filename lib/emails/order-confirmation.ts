type EmailItem = { sku: string; name: string; color: string; size: string; quantity: number; unitPriceArs: number };
type ConfirmedOrderEmail = { orderNumber: string; customerName: string; totalArs: number; items: EmailItem[] };

const money = (value: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
const escape = (value: string) => value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!);

export function buildOrderConfirmationEmail(order: ConfirmedOrderEmail) {
  const firstName = order.customerName.trim().split(/\s+/)[0] || 'hola';
  const items = order.items.map((item) => `<tr><td style="padding:12px 0;border-bottom:1px solid #e5e0d5"><strong>${escape(item.name)}</strong><br><span style="color:#6b6f75;font-size:13px">${escape(item.sku)} · ${escape(item.color)} · Talle ${escape(item.size)} · x${item.quantity}</span></td><td style="padding:12px 0;border-bottom:1px solid #e5e0d5;text-align:right;font-weight:700">${money(Number(item.unitPriceArs) * item.quantity)}</td></tr>`).join('');
  return {
    subject: `Pago confirmado · Pedido ${order.orderNumber}`,
    html: `<main style="max-width:620px;margin:0 auto;background:#fffcf6;color:#12246b;font-family:Arial,Helvetica,sans-serif"><header style="padding:30px 36px;background:#12246b;color:#fffcf6"><strong style="font-size:22px;letter-spacing:-.04em">SANTORINI</strong></header><section style="padding:42px 36px"><p style="margin:0 0 12px;font-size:11px;font-weight:700;letter-spacing:.14em">PEDIDO ${escape(order.orderNumber)}</p><h1 style="margin:0 0 22px;font-size:38px;line-height:1">Recibimos tu pago.</h1><p style="margin:0 0 28px;color:#4c5361;line-height:1.6">Hola ${escape(firstName)}, confirmamos el pago de tu pedido. Coordinaremos por WhatsApp el horario y la dirección exacta para tu retiro en Recoleta.</p><div style="padding:18px;border:1px solid #d5c594;background:#f5edda;margin-bottom:28px"><strong>Retiro en persona · Recoleta</strong><br><span style="display:block;margin-top:6px;color:#4c5361;line-height:1.5">El equipo de Santorini se pondrá en contacto para coordinar la entrega.</span></div><table style="width:100%;border-collapse:collapse">${items}</table><div style="display:flex;justify-content:space-between;gap:20px;padding:22px 0 0;font-size:19px"><strong>Total</strong><strong>${money(Number(order.totalArs))}</strong></div></section><footer style="padding:22px 36px;border-top:1px solid #e5e0d5;color:#6b6f75;font-size:12px;line-height:1.5">Santorini · Urban essentials</footer></main>`,
  };
}
