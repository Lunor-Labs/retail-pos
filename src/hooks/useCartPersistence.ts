import { useState, useEffect, useCallback } from 'react';
import { CartItem, Customer, ReferralAgent } from '../types';

const STORAGE_KEY = 'pos_cart_state';

interface PersistedCartState {
    cart: CartItem[];
    selectedCustomerId: string | null;
    selectedReferralAgentId: string | null;
    paymentMethod: 'cash' | 'card' | 'credit' | 'mixed';
    paidAmount: number;
    serviceCharge: number;
    taxRate: number;
}

const DEFAULT_STATE: PersistedCartState = {
    cart: [],
    selectedCustomerId: null,
    selectedReferralAgentId: null,
    paymentMethod: 'cash',
    paidAmount: 0,
    serviceCharge: 0,
    taxRate: 0,
};

function loadFromStorage(): PersistedCartState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_STATE;
        const parsed = JSON.parse(raw) as PersistedCartState;
        return { ...DEFAULT_STATE, ...parsed };
    } catch {
        return DEFAULT_STATE;
    }
}

function saveToStorage(state: PersistedCartState) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Storage quota exceeded or unavailable — fail silently
    }
}

/**
 * Manages POS cart state with localStorage persistence.
 * The cart survives navigating away from and back to the POS page.
 *
 * Pass in the full lists of `customers` and `referralAgents` (loaded from the DB)
 * so that the hook can resolve IDs back to full objects on rehydration.
 */
export function useCartPersistence(
    customers: Customer[],
    referralAgents: ReferralAgent[],
) {
    const [persisted, setPersisted] = useState<PersistedCartState>(loadFromStorage);

    // Resolved objects from IDs
    const selectedCustomer =
        customers.find((c) => c.id === persisted.selectedCustomerId) ?? null;
    const selectedReferralAgent =
        referralAgents.find((a) => a.id === persisted.selectedReferralAgentId) ?? null;

    // Persist any time state changes
    useEffect(() => {
        saveToStorage(persisted);
    }, [persisted]);

    // ── Setters ──────────────────────────────────────────────────────────────

    const setCart = useCallback((cartOrUpdater: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
        setPersisted((prev) => ({
            ...prev,
            cart: typeof cartOrUpdater === 'function' ? cartOrUpdater(prev.cart) : cartOrUpdater,
        }));
    }, []);

    const setSelectedCustomer = useCallback((customer: Customer | null) => {
        setPersisted((prev) => ({
            ...prev,
            selectedCustomerId: customer?.id ?? null,
            // If switching to a non-credit customer, reset payment method if it was credit
            paymentMethod:
                !customer && prev.paymentMethod === 'credit' ? 'cash' : prev.paymentMethod,
        }));
    }, []);

    const setSelectedReferralAgent = useCallback((agent: ReferralAgent | null) => {
        setPersisted((prev) => ({
            ...prev,
            selectedReferralAgentId: agent?.id ?? null,
        }));
    }, []);

    const setPaymentMethod = useCallback((method: 'cash' | 'card' | 'credit' | 'mixed') => {
        setPersisted((prev) => ({ ...prev, paymentMethod: method }));
    }, []);

    const setPaidAmount = useCallback((amount: number) => {
        setPersisted((prev) => ({ ...prev, paidAmount: amount }));
    }, []);

    const setServiceCharge = useCallback((charge: number) => {
        setPersisted((prev) => ({ ...prev, serviceCharge: charge }));
    }, []);

    const setTaxRate = useCallback((rate: number) => {
        setPersisted((prev) => ({ ...prev, taxRate: rate }));
    }, []);

    /** Clears cart and all sale-specific state (called after a sale is completed). */
    const clearCart = useCallback(() => {
        setPersisted({
            ...DEFAULT_STATE,
        });
    }, []);

    return {
        // State values
        cart: persisted.cart,
        selectedCustomer,
        selectedReferralAgent,
        paymentMethod: persisted.paymentMethod,
        paidAmount: persisted.paidAmount,
        serviceCharge: persisted.serviceCharge,
        taxRate: persisted.taxRate,

        // Setters
        setCart,
        setSelectedCustomer,
        setSelectedReferralAgent,
        setPaymentMethod,
        setPaidAmount,
        setServiceCharge,
        setTaxRate,
        clearCart,
    };
}
