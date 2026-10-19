export type GameTutorialType = 'FAFAP' | 'UNO' | 'COCHON_GRATTE' | 'CHECK_GAMES' | 'TCHIA_DIRECT' | 'TCHIA_IMPOT' | 'TCHIA_GARAME';
export interface GameTutorialSlide { title: string; text: string; example?: string; image: string; cards?: string[]; visual?: 'hand' | 'trick' | 'rules' | 'win'; highlight?: number; highlights?: number[]; }
export interface GameTutorialDefinition { type: GameTutorialType; name: string; slides: GameTutorialSlide[]; }
const image = (name: string) => `/assets/images/game-types/${name}.webp`;

export const GAME_TUTORIALS: Record<GameTutorialType, GameTutorialDefinition> = {
  FAFAP: { type: 'FAFAP', name: 'FapFap', slides: [
    { title: 'Le but du jeu', text: 'Recevez 5 cartes. Une victoire immédiate est possible si votre main contient au moins trois 7 ou si la somme des 5 cartes est strictement inférieure à 21 ; sinon, il faut jouer les cinq plis.', image: image('fafap'), cards: ['7S', '7C', '7H', '4D', '6S'], visual: 'hand', highlights: [0, 1, 2], example: 'Trois 7 dans la main : victoire immédiate selon la priorité de la partie.' },
    { title: 'Le déroulement d’un tour', text: 'Le joueur désigné commence le pli. Les autres jouent dans l’ordre de la table, puis le gagnant du pli devient le prochain joueur à commencer.', image: image('fafap'), cards: ['3S', '7C', '5S', '9H'], visual: 'trick', highlight: 1, example: 'Le 3♠ demande la famille ♠.' },
    { title: 'Familles et revendications', text: 'Si vous avez la famille demandée, elle est obligatoire ; sinon, vous pouvez jouer n’importe quelle carte. Pendant votre tour, une main de 5 cartes peut aussi être revendiquée si elle totalise au plus 21, contient au moins trois 3, trois 7, quatre cartes de même valeur ou cinq cartes de la même famille.', image: image('fafap'), cards: ['3S', '8S', '3C', '7H'], visual: 'rules', highlight: 1, example: 'Avec 3♠ demandé, 8♠ bat 3♠ ; 3♣ et 7♥ ne gagnent pas ce pli.' },
    { title: 'KORAT et victoire finale', text: 'Après 5 plis, le joueur qui remporte le dernier pli gagne normalement. Pour un KORAT, le même joueur doit gagner un pli où il ouvre un 3, personne ne suit sa famille, et cela se répète : 1 fois KORAT, 2 fois DOUBLE KORAT, 3 fois TRIPLE KORAT.', image: image('fafap'), cards: ['3S', '3C', '3H'], visual: 'win', example: 'Conseil : surveillez les 3 ouverts et les familles déjà jouées.' }
  ]},
  CHECK_GAMES: { type: 'CHECK_GAMES', name: 'Tcheck Game', slides: [
    { title: 'Le but', text: 'Débarrassez-vous de toutes vos cartes avant les autres joueurs.', image: image('check-games'), cards: ['7S', '4H', '10C'], visual: 'hand' },
    { title: 'Votre tour', text: 'Jouez une carte compatible avec la carte visible ou appliquez son effet spécial. Si aucune carte ne convient, piochez.', image: image('check-games'), cards: ['7S', '7H', '3C'], visual: 'trick', highlight: 1 },
    { title: 'Les cartes spéciales', text: 'L’As saute le joueur suivant, le 7 impose une pénalité de 2 cartes, le Valet commande une famille et le Joker impose une pénalité de 4 cartes.', image: image('check-games'), cards: ['AS', '7S', 'JS', 'JOKER_BLACK'], visual: 'rules' },
    { title: 'Dernière carte', text: 'Annoncez votre dernière carte quand il ne vous en reste plus qu’une. Le premier joueur sans carte gagne la manche.', image: image('check-games'), cards: ['7D'], visual: 'win' }
  ]},
  UNO: { type: 'UNO', name: 'Uno', slides: [
    { title: 'Le but', text: 'Soyez le premier à ne plus avoir de carte en main.', image: image('uno'), cards: ['RED_7', 'YELLOW_2', 'BLUE_9'], visual: 'hand' },
    { title: 'Jouer', text: 'À votre tour, posez une carte de la même couleur, du même chiffre ou du même symbole que la carte visible.', image: image('uno'), cards: ['RED_7', 'RED_SKIP', 'BLUE_3'], visual: 'trick', highlight: 1 },
    { title: 'Cartes spéciales', text: 'Les cartes Action changent la couleur ou pénalisent le joueur suivant. S’il ne vous reste qu’une carte, pensez à annoncer UNO.', image: image('uno'), cards: ['RED_DRAW_TWO', 'BLUE_REVERSE', 'WILD_DRAW_FOUR'], visual: 'rules' }
  ]},
  COCHON_GRATTE: { type: 'COCHON_GRATTE', name: 'Cochon Gratté', slides: [
    { title: 'Le but', text: 'Construisez votre combinaison en échangeant intelligemment les cartes proposées.', image: image('cochon-gratte'), cards: ['7S', '7C', '7H', '7D'], visual: 'hand' },
    { title: 'Le tour', text: 'Le joueur qui possède cinq cartes choisit une carte et la donne au joueur suivant. La carte reçue ne peut pas être redonnée immédiatement.', image: image('cochon-gratte'), cards: ['4S', '8C', 'QH', 'KD', '7S'], visual: 'trick', highlight: 4 },
    { title: 'Fin de manche', text: 'Si vos quatre cartes restantes appartiennent toutes à la même famille, vous gagnez immédiatement.', image: image('cochon-gratte'), cards: ['7S', '8S', '9S', '10S'], visual: 'win' }
  ]},
  TCHIA_DIRECT: { type: 'TCHIA_DIRECT', name: '21 Direct', slides: [
    { title: 'Le but', text: 'Composez la meilleure main possible sans dépasser 21.', image: image('21-direct'), cards: ['7S', '8C'], visual: 'hand' },
    { title: 'Boxing et sélection', text: 'Le boxer ouvre des cartes dans la banque, dans la limite prévue. Puis chaque joueur sélectionne les cartes qui formeront sa main.', image: image('21-direct'), cards: ['3S', '6H', '10D'], visual: 'trick', highlight: 1 },
    { title: '21 Direct : la Piquire', text: 'Deux As reçus dans les deux cartes initiales forment une Piquire. Cette main spéciale gagne directement la manche, même si son total est affiché comme 22.', image: image('21-direct'), cards: ['AS', 'AC'], visual: 'rules', highlights: [0, 1], example: 'Les deux As initiaux sont la seule combinaison spéciale de 21 Direct.' },
    { title: 'Victoire et égalité', text: 'Sans Piquire, le meilleur total inférieur ou égal à 21 gagne. Une main au-dessus de 21 est invalide ; une égalité relance une manche entre les joueurs concernés.', image: image('21-direct'), cards: ['10S', '8H', '4D'], visual: 'win', example: 'Conseil : 19 valide peut gagner contre une main dépassée.' }
  ]},
  TCHIA_IMPOT: { type: 'TCHIA_IMPOT', name: '21 Impôt', slides: [
    { title: 'Le but', text: 'Sélectionnez une main proche de 21 sans la dépasser, dans la mécanique de boxing et de sélection.', image: image('21-impot'), cards: ['8S', '9C'], visual: 'hand' },
    { title: 'Boxing', text: 'Le boxer ouvre les cartes de la banque, sans dépasser la limite autorisée. Les joueurs choisissent ensuite leur main à tour de rôle.', image: image('21-impot'), cards: ['3D', '6H', '8C'], visual: 'trick', highlight: 2 },
    { title: '21 Direct : la Piquire', text: 'Deux As reçus dans les deux cartes initiales forment une Piquire. Elle gagne directement la manche et met les autres joueurs en situation de KORAT de jeu.', image: image('21-impot'), cards: ['AS', 'AC'], visual: 'rules', highlights: [0, 1] },
    { title: 'KORAT et victoire', text: 'Une main terminée sous 18 est KORATÉE et applique l’impôt prévu, sans gagner automatiquement. Sans Piquire, le meilleur total valide inférieur ou égal à 21 gagne ; si toutes les mains sont sous 18, le meilleur total reste gagnant.', image: image('21-impot'), cards: ['10S', '6C', '3H'], visual: 'win', example: '17 est inférieur à 18 : la main peut gagner si toutes les mains sont sous 18, mais elle subit l’impôt.' }
  ]},
  TCHIA_GARAME: { type: 'TCHIA_GARAME', name: '21 Garame', slides: [
    { title: 'Le but', text: 'Formez la meilleure main valide autour de 21 après le challenge et la sélection.', image: image('21-garame'), cards: ['7S', '8C', '4H'], visual: 'hand' },
    { title: 'Challenge et KORAT', text: 'La première carte ouverte détermine la famille demandée. Si cette carte est un 3 et qu’un seul joueur suit cette famille, ce joueur réalise un KORAT.', image: image('21-garame'), cards: ['3S', '8S', '7C', '10H'], visual: 'trick', highlight: 1, example: 'Le 3♠ est ouvert : un seul joueur qui joue ♠ remporte le KORAT.' },
    { title: 'Sélection', text: 'Le gagnant du challenge choisit en premier parmi les cartes ouvertes, puis les autres joueurs sélectionnent à leur tour.', image: image('21-garame'), cards: ['4D', '6C', '9H', '3S'], visual: 'rules', highlight: 2 },
    { title: '21 Directs et calcul', text: 'Trois 7 dans la main finale donnent une victoire directe. Sinon, une main dépassant 21 est invalide et le meilleur total inférieur ou égal à 21 gagne ; la carte du challenge ne compte pas dans le total.', image: image('21-garame'), cards: ['7S', '7C', '7H'], visual: 'win', highlights: [0, 1, 2], example: 'Trois 7 après la sélection : victoire immédiate.' }
  ]}
};
