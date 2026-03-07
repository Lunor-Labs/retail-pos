import { InvoiceData } from './types';
import logo from '../../assets/favicon.jpeg';
import qrCode from '../../assets/QR.jpeg';

/**
 * Builds the WhatsApp share message for a sale and opens wa.me in a new tab.
 * Respects the showDiscount flag the same way the print receipt does.
 */
export function shareOnWhatsApp(invoiceData: InvoiceData, showDiscount: boolean): void {
    const displaySubtotal = !showDiscount
        ? invoiceData.subtotal - invoiceData.discount
        : invoiceData.subtotal;

    let message = `🧾 *INVOICE: ${invoiceData.saleNumber}*\n`;
    message += `📅 Date: ${invoiceData.date}\n\n`;
    message += `🏢 *Gasith Motors*\n`;
    message += `📞 +94 77 6600 285/+94 47 2103 738\n\n`;

    if (invoiceData.customerName) {
        message += `👤 Customer: ${invoiceData.customerName}\n`;
        if (invoiceData.customerPhone) {
            message += `📱 Phone: ${invoiceData.customerPhone}\n`;
        }
        message += `\n`;
    }

    message += `*ITEMS*\n`;
    message += `--------------------------------\n`;

    invoiceData.items.forEach((item, index) => {
        message += `${index + 1}. ${item.name} ${item.batchNumber ? `(Batch: ${item.batchNumber})` : ''}\n`;
        if (item.warranty && item.warranty.duration > 0) {
            message += `   Warranty: ${item.warranty.duration} ${item.warranty.unit} ${item.warranty.type ? `(${item.warranty.type})` : ''}\n`;
        }
        const printUnitPrice =
            !showDiscount && item.discountedUnitPrice !== undefined
                ? item.discountedUnitPrice
                : item.unitPrice;
        const printSubtotal =
            !showDiscount && item.discountedSubtotal !== undefined
                ? item.discountedSubtotal
                : item.subtotal;
        message += `   ${item.quantity} x ${printUnitPrice.toFixed(2)} = LKR ${printSubtotal.toFixed(2)}\n\n`;
    });

    message += `--------------------------------\n`;

    if (
        invoiceData.discount > 0 ||
        invoiceData.tax > 0 ||
        (invoiceData.serviceCharge && invoiceData.serviceCharge > 0)
    ) {
        message += `Subtotal: LKR ${displaySubtotal.toFixed(2)}\n`;
        if (showDiscount && invoiceData.discount > 0)
            message += `Discount: -LKR ${invoiceData.discount.toFixed(2)}\n`;
        if (invoiceData.tax > 0)
            message += `Tax: LKR ${invoiceData.tax.toFixed(2)}\n`;
        if (invoiceData.serviceCharge && invoiceData.serviceCharge > 0)
            message += `Service Charge: LKR ${invoiceData.serviceCharge.toFixed(2)}\n`;
        message += `\n`;
    }

    message += `💰 *TOTAL: LKR ${invoiceData.total.toFixed(2)}*\n`;
    message += `--------------------------------\n\n`;
    message += `💳 Payment: ${invoiceData.paymentMethod.toUpperCase()}\n`;

    if (invoiceData.paymentMethod !== 'credit') {
        message += `💵 Paid: LKR ${invoiceData.paidAmount.toFixed(2)}\n`;
        if (invoiceData.changeAmount > 0)
            message += `🔄 Change: LKR ${invoiceData.changeAmount.toFixed(2)}\n`;
    }

    if (invoiceData.cashierName) {
        message += `\nServed by: ${invoiceData.cashierName}`;
    }

    message += `\n\nThank you for your business! 🙏`;

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
    buildHTML: (data: InvoiceData, discount: boolean, logo: string, qr: string) => string,
): void {
    // Add cache-busting timestamp
    const cacheBust = Date.now();
    const logoUrl = new URL(logo, window.location.href).href + '?v=' + cacheBust;
    const qrUrl = new URL(qrCode, window.location.href).href + '?v=' + cacheBust;
    const html = buildHTML(invoiceData, showDiscount, logoUrl, qrUrl);

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
