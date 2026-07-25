import { DatabaseAdapter } from '../repositories/base/DatabaseAdapter';
import { logger } from '../lib/logger';

/** A credit or gift voucher as the counter needs to see it. */
export interface StoreCredit {
    id: string;
    code: string;
    /** Face value when issued. */
    amount: number;
    /** What is still spendable — this, not `amount`, is what may be applied. */
    balance: number;
    status: 'active' | 'used' | 'voided' | 'returned';
    source: 'sold' | 'reward' | 'return_credit';
    expires_at: string | null;
    /** True for credit issued by a return, false for a gift voucher. */
    isReturnCredit: boolean;
}

export interface IssuedCredit {
    code: string;
    amount: number;
    expires_at: string;
    return_number: string;
    return_id: string;
    item_count: number;
}

export interface ReturnLineInput {
    batch_id: string;
    quantity: number;
    /** Refund for the whole line, not per unit. */
    amount: number;
}

/** Raised when a database function reports a PIN problem rather than succeeding. */
export class ApprovalError extends Error {
    constructor(public readonly code: 'PIN_INVALID' | 'PIN_LOCKED', message: string) {
        super(message);
        this.name = 'ApprovalError';
    }
}

// ── Shapes returned by the database functions ──────────────────────────────

interface VoucherRow {
    id: string;
    code: string;
    amount: number;
    balance: number;
    status: StoreCredit['status'];
    issued_source: StoreCredit['source'];
    expires_at: string | null;
}

/** A PIN-gated call that was refused. Returned, not raised — see throwIfApprovalFailed. */
interface ApprovalFailure {
    ok: false;
    error: 'PIN_INVALID' | 'PIN_LOCKED';
}

interface IssueSuccess {
    ok: true;
    code: string;
    amount: number;
    expires_at: string;
    return_number: string;
    return_id: string;
    item_count: number;
}

interface RedeemSuccess {
    ok: true;
    remaining: number;
}

interface PayoutSuccess {
    ok: true;
    remaining: number;
    approved_by: string | null;
}

/**
 * A PIN problem arrives as `{ok: false}` rather than a raised error, because raising
 * would roll back the record of the failed attempt that the lockout counts. Callers
 * check this and turn it into an ApprovalError, so the rest of the app sees one shape.
 */
function isApprovalFailure(result: { ok: boolean }): result is ApprovalFailure {
    return result.ok === false;
}

const PIN_MESSAGES: Record<string, string> = {
    PIN_INVALID: 'Incorrect PIN.',
    PIN_LOCKED: 'Too many incorrect PINs. Try again in 15 minutes.',
};

/**
 * Store credit issued by a return, and gift vouchers, which share one mechanism.
 *
 * Every call here is a single database function, deliberately: the amount checks, the
 * PIN check and the balance decrement all have to be indivisible. A balance read in
 * the browser and written back would let two counters spend the same credit, the same
 * way stock was being oversold before `deduct_batch_stock`.
 */
export class StoreCreditService {
    constructor(private adapter: DatabaseAdapter) { }

    /**
     * Look a code up for the counter. Returns null when there is no such code, so the
     * caller can say "not found" rather than treating it as an error.
     */
    async lookup(code: string): Promise<StoreCredit | null> {
        const normalised = code.trim().toUpperCase();
        if (!normalised) return null;

        const rows = await this.adapter.query<VoucherRow>('gift_vouchers', {
            select: 'id, code, amount, balance, status, issued_source, expires_at',
            where: [{ field: 'code', operator: '=', value: normalised }],
            limit: 1,
        });

        const row = rows[0];
        if (!row) return null;

        return {
            id: row.id,
            code: row.code,
            amount: Number(row.amount),
            balance: Number(row.balance),
            status: row.status,
            source: row.issued_source,
            expires_at: row.expires_at,
            isReturnCredit: row.issued_source === 'return_credit',
        };
    }

    /**
     * Why a credit cannot be used right now, or null when it can be.
     * Checked here for a helpful message; the database enforces the same rules on
     * redemption regardless of what the browser thinks.
     */
    unusableReason(credit: StoreCredit): string | null {
        if (credit.status === 'used') return 'This code has already been fully used.';
        if (credit.status === 'voided') return 'This code has been cancelled.';
        if (credit.status === 'returned') return 'This voucher was refunded.';
        if (credit.balance <= 0) return 'This code has nothing left on it.';
        if (credit.expires_at && credit.expires_at < new Date().toISOString().split('T')[0]) {
            return `This code expired on ${credit.expires_at}.`;
        }
        return null;
    }

    /**
     * Take items back and issue a credit — the returns desk action. One transaction:
     * the return, its lines, the stock going back, and the credit.
     */
    async issueReturnCredit(input: {
        items: ReturnLineInput[];
        reason: string;
        phone?: string | null;
        customerId?: string | null;
        pin?: string | null;
    }): Promise<IssuedCredit> {
        try {
            logger.info('Issuing return credit', { itemCount: input.items.length });

            const result = await this.adapter.rpc<IssueSuccess | ApprovalFailure>('issue_return_credit', {
                p_items: input.items.map(i => ({
                    batch_id: i.batch_id,
                    quantity: i.quantity,
                    amount: i.amount,
                })),
                p_reason: input.reason,
                p_phone: input.phone ?? null,
                p_customer_id: input.customerId ?? null,
                p_pin: input.pin ?? null,
            });

            if (isApprovalFailure(result)) {
                throw new ApprovalError(result.error, PIN_MESSAGES[result.error]);
            }

            logger.info('Return credit issued', { code: result.code, amount: result.amount });

            return {
                code: result.code,
                amount: Number(result.amount),
                expires_at: result.expires_at,
                return_number: result.return_number,
                return_id: result.return_id,
                item_count: Number(result.item_count),
            };
        } catch (error) {
            throw this.translate(error, 'Could not complete this return.');
        }
    }

    /** Spend part or all of a credit against a sale. Returns what is left on it. */
    async redeemToSale(code: string, amount: number, saleId: string | null): Promise<number> {
        try {
            const result = await this.adapter.rpc<RedeemSuccess>('redeem_credit_to_sale', {
                p_code: code.trim().toUpperCase(),
                p_amount: amount,
                p_sale_id: saleId,
            });
            return Number(result.remaining);
        } catch (error) {
            throw this.translate(error, 'Could not apply this credit.');
        }
    }

    /**
     * Hand part or all of a credit back as cash. `pin` is only needed above the
     * configured limit — the database decides, so the caller may pass null and retry
     * with a PIN if it comes back as an approval failure.
     */
    async payoutCash(input: {
        code: string;
        amount: number;
        saleId?: string | null;
        pin?: string | null;
    }): Promise<{ remaining: number; approvedBy: string | null }> {
        try {
            const result = await this.adapter.rpc<PayoutSuccess | ApprovalFailure>('payout_credit_cash', {
                p_code: input.code.trim().toUpperCase(),
                p_amount: input.amount,
                p_sale_id: input.saleId ?? null,
                p_pin: input.pin ?? null,
            });

            if (isApprovalFailure(result)) {
                throw new ApprovalError(result.error, PIN_MESSAGES[result.error]);
            }

            logger.info('Credit paid out in cash', { amount: input.amount, remaining: result.remaining });

            return { remaining: Number(result.remaining), approvedBy: result.approved_by ?? null };
        } catch (error) {
            throw this.translate(error, 'Could not pay out this credit.');
        }
    }

    /** Set the calling admin's own approval PIN. */
    async setAdminPin(pin: string): Promise<void> {
        try {
            await this.adapter.rpc<null>('set_admin_pin', { p_pin: pin });
        } catch (error) {
            throw this.translate(error, 'Could not save the PIN.');
        }
    }

    /** Turn a tagged database message into something a cashier can act on. */
    private translate(error: unknown, fallback: string): Error {
        if (error instanceof ApprovalError) return error;

        const message = error instanceof Error ? error.message : String(error);
        logger.error('Store credit operation failed', error as Error);

        if (message.includes('CREDIT_UNAVAILABLE')) {
            return new Error('This code cannot cover that amount — it may already be used or expired.');
        }
        if (message.includes('AMOUNT_ABOVE_TAG')) {
            return new Error('The refund cannot be more than the price on the item. Lower the amount, or get an admin to approve it.');
        }
        if (message.includes('BATCH_NOT_FOUND')) {
            return new Error('That stock batch no longer exists. Re-scan the item.');
        }
        if (message.includes('NO_REASON')) return new Error('Enter a reason for the return.');
        if (message.includes('NO_ITEMS')) return new Error('Scan at least one item.');
        if (message.includes('INVALID_QUANTITY')) return new Error('Quantity must be more than zero.');
        if (message.includes('INVALID_AMOUNT')) return new Error('Enter a valid refund amount.');
        if (message.includes('PIN_FORMAT')) return new Error('The PIN must be exactly 4 digits.');
        if (message.includes('PIN_TAKEN')) return new Error('Another admin already uses this PIN — choose a different one.');
        if (message.includes('NOT_ADMIN')) return new Error('Only an admin can set an approval PIN.');

        return new Error(fallback);
    }
}
