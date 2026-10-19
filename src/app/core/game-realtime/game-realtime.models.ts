export type RealtimeGameStatus = 'WAITING' | 'READY' | 'PLAYING' | 'FINISHED' | 'CANCELLED';

export interface RealtimePlayerView {
    id: string;
    displayName: string;
    avatar: string | null;
    cardCount: number;
    hand: string[];
}

export interface RealtimePlay {
    playerId: string;
    card: string;
}

export interface RealtimeGameEvent {
    sequence: number;
    type: string;
    playerId: string;
    occurredAt: string;
    data: Record<string, unknown>;
}

export interface RealtimeGameState {
    id: string;
    name: string;
    status: RealtimeGameStatus;
    capacity: number;
    stake: number;
    maxKoratLevel: number;
    version: number;
    players: RealtimePlayerView[];
    commanderId: string | null;
    currentPlayerId: string | null;
    round: number;
    currentTrick: RealtimePlay[];
    winnerId: string | null;
    korat: { type: string; multiplier: number } | null;
    events: RealtimeGameEvent[];
}

export interface RealtimeGameError {
    code: string;
    message: string;
    occurredAt: string;
}

export interface PublicGamePlayer {
    id: string;
    displayName: string;
    avatar: string | null;
}

export interface PublicGameSummary {
    id: string;
    name: string;
    status: RealtimeGameStatus;
    capacity: number;
    playerCount: number;
    availableSeats: number;
    stake: number;
    maxKoratLevel: number;
    version: number;
    createdByBot: boolean;
    createdAt: string;
    players: PublicGamePlayer[];
}

export interface PublicGameList {
    games: PublicGameSummary[];
    total: number;
    offset: number;
    limit: number;
}

export interface LobbyGameEvent {
    type: 'GAME_CREATED' | 'GAME_UPDATED' | 'GAME_FINISHED' | 'GAME_CANCELLED';
    game: PublicGameSummary;
}

export type GameEventType = 'GAME_CREATED' | 'PLAYER_JOINED' | 'PLAYER_READY' | 'GAME_STARTED' |
    'PLAYER_KICKED' |
    'CARDS_DISTRIBUTED' | 'PRIVATE_HAND_UPDATED' | 'TURN_STARTED' | 'CARD_PLAYED' | 'MOVE_REJECTED' |
    'PLAYER_TIMED_OUT' | 'PLAYER_ELIMINATED' | 'ROUND_COMPLETED' | 'COMMANDER_CHANGED' |
    'GAME_STATE_UPDATED' | 'KORAT_DETECTED' | 'GAME_FINISHED' | 'POT_SETTLED' | 'GAME_CANCELLED';

export interface VersionedGameEvent<T = unknown> {
    eventId: string;
    eventType: GameEventType;
    gameId: string;
    gameVersion: number;
    occurredAt: string;
    payload: T;
}

export interface GamePlayerPublicDto {
    gamePlayerId: string; userId: string; username: string; userType: 'HUMAN' | 'AUTOMATIC'; seatNumber: number;
    avatarUrl: string;
    countryCode?: string;
    active: boolean; commander: boolean; connected: boolean; disconnectedAt: string | null; remainingCardCount: number; status: string; automaticMode:boolean;
}

export interface GameStateDto {
    gameId: string; gameType?:'FAFAP'|'PRESIDENT'|'UNO'|'COCHON_GRATTE'|'CHECK_GAMES'; createdByUserId: string; parentGameId: string | null; rematchGameId: string | null;
    accessType: 'PUBLIC' | 'PRIVATE';
    status: string; currentRound: number; totalRounds: 5; version: number; stakeAmount: number;
    commanderPlayerId: string | null; currentPlayerId: string | null; currentTurnDeadline: string | null;
    players: GamePlayerPublicDto[];
    tableCards: Array<{ id: string; suit: string; value: number; code: string; roundNumber: number; playedByGamePlayerId: string }>;
    currentRoundState: { roundNumber: number; openingCardId: string | null; requiredSuit: string | null; status: string } | null;
    pot: { reservedAmount?: number; finalDistributedAmount?: number; status?: string } | null;
    result: { winnerPlayerId: string; victoryType: string } | null;
}

export interface PrivateHandDto { gameId: string; gameVersion: number; cards: Array<{ id: string; suit: string; value: number; code: string }>; }
