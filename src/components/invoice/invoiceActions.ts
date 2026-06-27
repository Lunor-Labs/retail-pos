import { InvoiceData } from './types';
import { BusinessProfile } from '../../contexts/BusinessProfileContext';
import logo from '../../assets/revonlak.jpeg';
import qrCode from '../../assets/QR.jpeg';

/**
 * Builds the WhatsApp share message for a sale and opens wa.me in a new tab.
 * Respects the showDiscount flag the same way the print receipt does.
 */
export function shareOnWhatsApp(invoiceData: InvoiceData, showDiscount: boolean, business: BusinessProfile): void {
    const money = (n: number) =>
        n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const displaySubtotal = !showDiscount
        ? invoiceData.subtotal - invoiceData.discount
        : invoiceData.subtotal;

    const lines: string[] = [];
    lines.push(`*${business.name}*`);
    if (business.tagline) lines.push(`_${business.tagline}_`);
    lines.push('');
    lines.push(`🧾 Invoice *${invoiceData.saleNumber}*`);
    lines.push(`📅 ${invoiceData.date}`);

    if (invoiceData.customerName) {
        lines.push('');
        lines.push(`👤 ${invoiceData.customerName}`);
        if (invoiceData.customerPhone) lines.push(`📱 ${invoiceData.customerPhone}`);
    }

    lines.push('');
    lines.push('*Items*');
    invoiceData.items.forEach((item, index) => {
        const unitPrice = !showDiscount && item.discountedUnitPrice !== undefined
            ? item.discountedUnitPrice : item.unitPrice;
        const subtotal = !showDiscount && item.discountedSubtotal !== undefined
            ? item.discountedSubtotal : item.subtotal;
        lines.push(`${index + 1}. ${item.name}${item.variantLabel ? ` — ${item.variantLabel}` : ''}`);
        lines.push(`   ${item.quantity} × ${money(unitPrice)} = *${money(subtotal)}*`);
    });

    lines.push('');
    const hasAdjustments =
        invoiceData.discount > 0 || invoiceData.tax > 0 || (invoiceData.serviceCharge ?? 0) > 0;
    if (hasAdjustments) {
        lines.push(`Subtotal   LKR ${money(displaySubtotal)}`);
        if (showDiscount && invoiceData.discount > 0)
            lines.push(`Discount   −LKR ${money(invoiceData.discount)}`);
        if (invoiceData.tax > 0)
            lines.push(`Tax   LKR ${money(invoiceData.tax)}`);
        if ((invoiceData.serviceCharge ?? 0) > 0)
            lines.push(`Service Charge   LKR ${money(invoiceData.serviceCharge as number)}`);
    }
    lines.push(`*Total   LKR ${money(invoiceData.total)}*`);

    lines.push('');
    const payLabel = invoiceData.paymentMethod.charAt(0).toUpperCase() + invoiceData.paymentMethod.slice(1);
    let payLine = `💳 ${payLabel}`;
    if (invoiceData.paymentMethod !== 'credit') {
        payLine += ` · Paid ${money(invoiceData.paidAmount)}`;
        if (invoiceData.changeAmount > 0) payLine += ` · Change ${money(invoiceData.changeAmount)}`;
    }
    lines.push(payLine);
    if (invoiceData.cashierName) lines.push(`🧑‍💼 Served by ${invoiceData.cashierName}`);

    lines.push('');
    lines.push('🙏 Thank you for shopping with us!');
    if (business.phone) lines.push(`📞 ${business.phone}`);
    if (business.address) lines.push(`📍 ${business.address}`);

    const message = lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

/**
 * Opens a popup window, writes the receipt HTML into it, and triggers print.
 *
 * Why popup window (not window.print() on the SPA):
 *   - Completely isolated document — only the receipt exists.
 *   - @page size rule works with no interference from app styles.
 *   - Single copy guaranteed. Auto-closes after print dialog.
 *
 * Popup dimensions:
 *   width  = 384 px ≈ 101.6 mm @ 96 dpi  (matches 4-inch driver width)
 *   height = 4000 px  so ALL content renders at natural height before the
 *            JS height measurement — prevents undercount on long receipts.
 */
export function openPrintPopup(
    invoiceData: InvoiceData,
    showDiscount: boolean,
    buildHTML: (data: InvoiceData, discount: boolean, logo: string, qr: string, business: BusinessProfile) => string,
    business: BusinessProfile,
): void {
    // Add cache-busting timestamp
    const cacheBust = Date.now();
    const logoUrl = new URL(logo, window.location.href).href + '?v=' + cacheBust;
    const qrUrl = new URL(qrCode, window.location.href).href + '?v=' + cacheBust;
    const html = buildHTML(invoiceData, showDiscount, logoUrl, qrUrl, business);

    const popup = window.open(
        '',
        '_blank',
        'width=384,height=4000,scrollbars=no,menubar=no,toolbar=no,location=no,status=no',
    );

    if (!popup) {
        alert('Please allow popups for this site to enable printing.');
        return;
    }

    popup.document.open();
    popup.document.write(html);
    popup.document.close();
}
