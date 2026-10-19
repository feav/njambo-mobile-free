export type FafapSuit = 'S' | 'C' | 'H' | 'D';
export type FafapIndex = 'BLACK' | 'TCHAKA' | 'KOUBI' | 'ZINK';
export type ImmediateWinReason = 'HAND_UNDER_21' | 'THREE_SEVENS';
export type KoratResult = 'KORAT' | 'DOUBLE_KORAT' | 'TRIPLE_KORAT';

export interface FafapCard {
    code: string;
    value: number;
    suit: FafapSuit;
    index: FafapIndex;
}

export interface TrickPlay {
    playerId: string | number;
    card: string;
}

export interface TrickResult {
    winnerPlayerId: string | number;
    winningCard: string;
    leadSuit: FafapSuit;
}

export interface Settlement {
    paymentPerLoser: number;
    winnerGain: number;
}

export type TchiaDirectSuit = 'S' | 'C' | 'H' | 'D';
export type TchiaDirectMultiplier = 1 | 2 | 4 | 8;

export interface TchiaDirectCard {
    code: string;
    value: number;
    suit: TchiaDirectSuit;
    ace: boolean;
}

export interface TchiaDirectHandScore {
    total: number;
    valid: boolean;
    special: boolean;
}

export interface TchiaDirectRoundResult {
    winnerIds: Array<string | number>;
    bestTotal: number;
    specialWinnerIds: Array<string | number>;
    multiplier: TchiaDirectMultiplier;
    sharedAtMaximumLevel: boolean;
}
