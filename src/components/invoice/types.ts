/** One line-item on the invoice / receipt. */
export interface InvoiceItem {
    name: string;
    quantity: number;
    unitPrice: number;
    discountedUnitPrice?: number;
    subtotal: number;
    discountedSubtotal?: number;
    batchNumber: string;
    isManual?: boolean;
    variantLabel?: string;
}

/** Full invoice / sale record passed into the Invoice component. */
export interface InvoiceData {
    saleNumber: string;
    date: string;
    customerName?: string;
    customerPhone?: string;
    items: InvoiceItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    paidAmount: number;
    changeAmount: number;
    serviceCharge?: number;
    paymentMethod: string;
    cashierName?: string;
}

/** Props accepted by the top-level Invoice modal component. */
export interface InvoiceProps {
    invoiceData: InvoiceData;
    onClose: () => void;
}
