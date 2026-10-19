import { FafapRulesService } from './fafap-rules.service';

describe('FafapRulesService · 21 Direct', () => {
    const rules = new FafapRulesService();

    it('construit un paquet de 34 cartes', () => {
        const deck = rules.tchiaDirectDeck();
        expect(deck.length).toBe(34);
        expect(deck.filter(card => card.ace).length).toBe(2);
        expect(deck.filter(card => !card.ace).length).toBe(32);
    });

    it('reconnaît les deux As comme main spéciale à 22', () => {
        const deck = rules.tchiaDirectDeck();
        const aces = deck.filter(card => card.ace);
        expect(rules.scoreTchiaDirectHand(aces)).toEqual({ total: 22, valid: true, special: true });
    });

    it('choisit la meilleure combinaison sans dépasser 21', () => {
        const deck = rules.tchiaDirectDeck();
        const initial = [deck.find(card => card.code === '3S')!, deck.find(card => card.code === '8C')!];
        const open = [deck.find(card => card.code === '10H')!, deck.find(card => card.code === '4D')!, deck.find(card => card.code === '5S')!];
        expect(rules.bestTchiaDirectSelection(initial, open).map(card => card.code)).toEqual(['3S', '8C', '10H']);
    });

    it('partage au niveau maximal et double les niveaux précédents', () => {
        expect(rules.nextTchiaDirectMultiplier(1)).toBe(2);
        expect(rules.nextTchiaDirectMultiplier(2)).toBe(4);
        expect(rules.nextTchiaDirectMultiplier(4)).toBe(8);
        expect(rules.nextTchiaDirectMultiplier(8)).toBeNull();

        const deck = rules.tchiaDirectDeck();
        const result = rules.resolveTchiaDirectRound([
            { playerId: 'a', cards: [deck.find(card => card.code === '10S')!, deck.find(card => card.code === '10C')!] },
            { playerId: 'b', cards: [deck.find(card => card.code === '10H')!, deck.find(card => card.code === '10D')!] },
        ], 8);
        expect(result.winnerIds).toEqual(['a', 'b']);
        expect(result.sharedAtMaximumLevel).toBe(true);
    });
});
