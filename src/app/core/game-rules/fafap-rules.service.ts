import { Injectable } from '@angular/core';
import {
    FafapCard,
    FafapIndex,
    FafapSuit,
    ImmediateWinReason,
    Settlement,
    TchiaDirectCard,
    TchiaDirectHandScore,
    TchiaDirectMultiplier,
    TchiaDirectRoundResult,
    TchiaDirectSuit,
    TrickPlay,
    TrickResult,
} from './fafap-rules.models';

@Injectable({ providedIn: 'root' })
export class FafapRulesService {
    private readonly suits: Record<FafapSuit, FafapIndex> = {
        S: 'BLACK', C: 'TCHAKA', H: 'KOUBI', D: 'ZINK'
    };

    parseCard(code: string): FafapCard {
        const match = /^(10|[3-9])([SCHD])$/.exec(String(code || '').toUpperCase());
        if (!match) throw new Error(`Carte FAFAP invalide : ${code}`);
        const suit = match[2] as FafapSuit;
        return { code: match[0], value: Number(match[1]), suit, index: this.suits[suit] };
    }

    legalCards(hand: string[], leadCard?: string | null): string[] {
        hand.forEach(card => this.parseCard(card));
        if (!leadCard) return [...hand];
        const leadSuit = this.parseCard(leadCard).suit;
        const matching = hand.filter(card => this.parseCard(card).suit === leadSuit);
        return matching.length ? matching : [...hand];
    }

    canPlayCard(hand: string[], card: string, leadCard?: string | null): boolean {
        return hand.includes(card) && this.legalCards(hand, leadCard).includes(card);
    }

    immediateWinReasons(hand: string[]): ImmediateWinReason[] {
        if (hand.length !== 5 || new Set(hand).size !== 5) throw new Error('Une main doit contenir 5 cartes uniques');
        const cards = hand.map(card => this.parseCard(card));
        const reasons: ImmediateWinReason[] = [];
        if (cards.reduce((sum, card) => sum + card.value, 0) < 21) reasons.push('HAND_UNDER_21');
        if (cards.filter(card => card.value === 7).length >= 3) reasons.push('THREE_SEVENS');
        return reasons;
    }

    resolveTrick(plays: TrickPlay[]): TrickResult {
        if (plays.length < 2 || plays.length > 4) throw new Error('Un tour doit contenir de 2 à 4 cartes');
        const leadSuit = this.parseCard(plays[0].card).suit;
        let winner = plays[0];
        for (const play of plays.slice(1)) {
            const card = this.parseCard(play.card);
            if (card.suit === leadSuit && card.value > this.parseCard(winner.card).value) winner = play;
        }
        return { winnerPlayerId: winner.playerId, winningCard: winner.card, leadSuit };
    }

    calculateSettlement(stake: number, playerCount: number, multiplier = 1): Settlement {
        if (stake <= 0 || playerCount < 2 || playerCount > 4) throw new Error('Paramètres de paiement invalides');
        return { paymentPerLoser: stake * multiplier, winnerGain: stake * multiplier * (playerCount - 1) };
    }

    requiredBalance(stake: number, maxKoratLevel: 0 | 1 | 2 | 3): number {
        return stake * [1, 2, 4, 8][maxKoratLevel];
    }

    tchiaDirectDeck(): TchiaDirectCard[] {
        const suits: TchiaDirectSuit[] = ['S', 'C', 'H', 'D'];
        const deck: TchiaDirectCard[] = [];
        for (const suit of suits) {
            for (let value = 3; value <= 10; value++) {
                deck.push({ code: `${value}${suit}`, value, suit, ace: false });
            }
        }
        deck.push({ code: 'AS', value: 11, suit: 'S', ace: true });
        deck.push({ code: 'AC', value: 11, suit: 'C', ace: true });
        return deck;
    }

    scoreTchiaDirectHand(hand: TchiaDirectCard[]): TchiaDirectHandScore {
        if (!hand.length) throw new Error('Une main TCHIA doit contenir au moins une carte');
        const special = hand.length === 2 && hand.every(card => card.ace);
        const total = hand.reduce((sum, card) => sum + card.value, 0);
        return { total, valid: special || total <= 21, special };
    }

    bestTchiaDirectSelection(initial: TchiaDirectCard[], openCards: TchiaDirectCard[]): TchiaDirectCard[] {
        const initialScore = this.scoreTchiaDirectHand(initial);
        if (initialScore.special) return [...initial];
        let best = [...initial];
        let bestTotal = initialScore.valid ? initialScore.total : -1;
        for (let mask = 0; mask < (1 << openCards.length); mask++) {
            const selection = openCards.filter((_, index) => (mask & (1 << index)) !== 0);
            const candidate = [...initial, ...selection];
            const score = this.scoreTchiaDirectHand(candidate);
            if (score.valid && !score.special && score.total > bestTotal) {
                best = candidate;
                bestTotal = score.total;
            }
        }
        return best;
    }

    resolveTchiaDirectRound(
        hands: Array<{ playerId: string | number; cards: TchiaDirectCard[] }>,
        multiplier: TchiaDirectMultiplier,
    ): TchiaDirectRoundResult {
        if (hands.length < 2 || hands.length > 6) throw new Error('TCHIA DIRECT accepte de 2 à 6 joueurs');
        const scored = hands.map(hand => ({ ...hand, score: this.scoreTchiaDirectHand(hand.cards) }));
        const specialWinnerIds = scored.filter(item => item.score.special).map(item => item.playerId);
        if (specialWinnerIds.length) {
            return { winnerIds: specialWinnerIds, bestTotal: 22, specialWinnerIds, multiplier, sharedAtMaximumLevel: false };
        }
        const valid = scored.filter(item => item.score.valid);
        const bestTotal = Math.max(...valid.map(item => item.score.total));
        const winnerIds = valid.filter(item => item.score.total === bestTotal).map(item => item.playerId);
        return { winnerIds, bestTotal, specialWinnerIds: [], multiplier, sharedAtMaximumLevel: multiplier === 8 && winnerIds.length > 1 };
    }

    nextTchiaDirectMultiplier(multiplier: TchiaDirectMultiplier): TchiaDirectMultiplier | null {
        if (multiplier === 1) return 2;
        if (multiplier === 2) return 4;
        if (multiplier === 4) return 8;
        return null;
    }
}
