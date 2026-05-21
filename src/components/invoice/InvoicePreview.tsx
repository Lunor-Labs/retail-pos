import qrCode from '../../assets/QR.jpeg';
import { InvoiceData } from './types';

interface Props {
    invoiceData: InvoiceData;
    showDiscount: boolean;
}

/**
 * On-screen receipt preview rendered inside the Invoice modal.
 * Uses inline styles (not the thermal CSS) so it renders nicely on screen
 * without affecting the popup print document.
 */
export function InvoicePreview({ invoiceData, showDiscount }: Props) {
    const displaySubtotal = !showDiscount
        ? invoiceData.subtotal - invoiceData.discount
        : invoiceData.subtotal;

    return (
        <div style={{ maxWidth: '80mm', margin: '0 auto', fontFamily: 'monospace', fontSize: '12px' }}>

            {/* Header */}
            <div className="text-center mb-3">
                <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '0.1em' }}>RIVONLAK</div>
                <div style={{ fontSize: 11, color: '#555' }}>Fashion Retail</div>
            </div>
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Meta */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Invoice:</span><b>{invoiceData.saleNumber}</b>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Date:</span><span>{invoiceData.date}</span>
            </div>
            {invoiceData.customerName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Customer:</span><span>{invoiceData.customerName}</span>
                </div>
            )}
            {invoiceData.customerPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Phone:</span><span>{invoiceData.customerPhone}</span>
                </div>
            )}
            {invoiceData.cashierName && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span>Cashier:</span><span>{invoiceData.cashierName}</span>
                </div>
            )}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Items */}
            {invoiceData.items.map((item, i) => {
                const up = !showDiscount && item.discountedUnitPrice !== undefined
                    ? item.discountedUnitPrice
                    : item.unitPrice;
                const st = !showDiscount && item.discountedSubtotal !== undefined
                    ? item.discountedSubtotal
                    : item.subtotal;

                return (
                    <div key={i} style={{ marginBottom: 6 }}>
                        <div style={{ fontWeight: 600, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{i + 1}. {item.name}</span>
                        </div>
                        {item.variantLabel && (
                            <div style={{ fontSize: 10, paddingLeft: 12, color: '#555' }}>
                                {item.variantLabel}
                            </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12 }}>
                            <span>{item.quantity} x {up.toFixed(2)}</span>
                            <b>LKR {st.toFixed(2)}</b>
                        </div>
                    </div>
                );
            })}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Subtotal:</span><span>LKR {displaySubtotal.toFixed(2)}</span>
            </div>
            {showDiscount && invoiceData.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Discount:</span><span>-LKR {invoiceData.discount.toFixed(2)}</span>
                </div>
            )}
            {invoiceData.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tax:</span><span>LKR {invoiceData.tax.toFixed(2)}</span>
                </div>
            )}
            {invoiceData.serviceCharge !== undefined && invoiceData.serviceCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Service Charge:</span><span>LKR {invoiceData.serviceCharge.toFixed(2)}</span>
                </div>
            )}
            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 14 }}>
                <span>TOTAL:</span><span>LKR {invoiceData.total.toFixed(2)}</span>
            </div>
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Payment */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Payment:</span>
                <span style={{ textTransform: 'uppercase' }}>{invoiceData.paymentMethod}</span>
            </div>
            {invoiceData.paymentMethod !== 'credit' && (
                <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Paid:</span><span>LKR {invoiceData.paidAmount.toFixed(2)}</span>
                    </div>
                    {invoiceData.changeAmount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span>Change:</span>
                            <span style={{ color: '#16a34a' }}>LKR {invoiceData.changeAmount.toFixed(2)}</span>
                        </div>
                    )}
                </>
            )}
            <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

            {/* Footer */}
            <div className="text-center" style={{ paddingBottom: 6 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Shop Again at RIVONLAK</div>
                <img
                    src={qrCode}
                    alt="QR Code"
                    style={{ height: 80, width: 80, objectFit: 'contain', margin: '0 auto' }}
                />
                <div style={{ marginTop: 6, color: '#555', fontSize: 11 }}>Thank you for your business!</div>
                <div style={{ marginTop: 4, fontSize: 9, color: '#aaa' }}>
                    System Powered by <b>Lunor Labs</b>
                </div>
            </div>

        </div>
    );
}
