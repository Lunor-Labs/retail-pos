/**
 * Re-export barrel — keeps all existing imports working.
 *
 * The Invoice feature has been split into:
 *   src/components/invoice/
 *     ├── types.ts           – InvoiceItem, InvoiceData, InvoiceProps
 *     ├── receiptCSS.ts      – thermal print CSS & auto-sizing JS strings
 *     ├── receiptHTML.ts     – buildReceiptHTML()
 *     ├── InvoicePreview.tsx – on-screen receipt preview component
 *     ├── invoiceActions.ts  – openPrintPopup(), shareOnWhatsApp()
 *     └── index.tsx          – Invoice modal component
 */
export type { InvoiceItem, InvoiceData, InvoiceProps } from './invoice/types';
export { Invoice } from './invoice/index';