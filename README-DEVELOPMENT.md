# Développement mobile FAPFAP

## Versions

- Node.js 22.22.2
- Angular 20.3
- Ionic 8.8
- TypeScript 5.9

## Installation

```bash
nvm use
npm ci
```

## Lancement web

```bash
npm start
```

L'application est ensuite disponible sur `http://localhost:4200`.

## Vérifications

```bash
npm run build
npm test
npm audit --omit=dev
```

Le socle Cordova 9 a été retiré des dépendances. La cible mobile native devra être recréée avec Capacitor dans un incrément séparé.
