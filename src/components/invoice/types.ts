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
    /** Store credit or gift voucher put towards this sale. */
    creditApplied?: number;
    creditCode?: string;
    /** True when the code was issued by a return rather than sold as a gift voucher. */
    creditIsReturn?: boolean;
    /** Still on the code after this sale — printed so the customer knows they hold it. */
    creditRemaining?: number;
    /** Cash handed back from the credit. Not change from a payment. */
    cashPaidOut?: number;
}

/** Props accepted by the top-level Invoice modal component. */
export interface InvoiceProps {
    invoiceData: InvoiceData;
    onClose: () => void;
}
