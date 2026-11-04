import { IonicSafeString } from '@ionic/angular';

interface PotState {
    stakeAmount?: number | string | null;
    pot?: number | string | {
        reservedAmount?: number | string | null;
        finalDistributedAmount?: number | string | null;
        companyFeeAmount?: number | string | null;
        status?: string | null;
    } | null;
    players?: unknown[];
}

/** The reserved pot is the gross pool, before the winner commission is deducted. */
export function grossPotAmount(state: PotState | null | undefined): number | null {
    const stake = Number(state?.stakeAmount ?? 0);
    if (!(stake > 0)) return null;

    if (typeof state?.pot === 'object' && state.pot !== null) {
        const distributed = state.pot.finalDistributedAmount;
        const fee = state.pot.companyFeeAmount;
        if (distributed !== undefined && distributed !== null && fee !== undefined && fee !== null) {
            const grossGain = Number(distributed) + Number(fee);
            return grossGain > 0 ? grossGain : null;
        }
        const reserved = Number(state.pot.reservedAmount ?? 0);
        if (reserved > 0) return reserved;
        if (state.pot.status === 'SETTLED' || state.pot.status === 'REFUNDED') return null;
    } else {
        const potValue = Number(state?.pot ?? 0);
        if (potValue > 0) return potValue;
    }

    const players = state?.players?.filter(player => (player as { status?: string | null })?.status !== 'WAITLISTED').length ?? 0;
    return players > 0 ? stake * players : null;
}

export function grossPotMessage(amount: number): IonicSafeString {
    return new IonicSafeString(
        `<div class="gross-pot-win" role="status" aria-live="polite">` +
        `<span class="gross-pot-label">POT BRUT · AVANT COMMISSION</span>` +
        `<strong class="gross-pot-amount" data-target="${amount}">0</strong>` +
        `<span class="gross-pot-currency">JETONS À GAGNER</span>` +
        `</div>`
    );
}

export function animateGrossPot(alert: HTMLIonAlertElement): void {
    const amountElement = alert.querySelector<HTMLElement>('.gross-pot-amount');
    const target = Number(amountElement?.dataset['target'] ?? 0);
    if (!amountElement || !(target > 0)) return;

    const duration = 1350;
    const start = performance.now();
    const formatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
    const tick = (now: number) => {
        if (!amountElement.isConnected) return;
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 4);
        amountElement.textContent = formatter.format(Math.round(target * eased));
        if (progress < 1) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
}
