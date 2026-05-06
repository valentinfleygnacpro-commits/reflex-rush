# Reflex Rush

Reflex Rush est un jeu web arcade jouable directement dans le navigateur.

## Jouer en local

Ouvre `index.html` dans un navigateur, ou lance le serveur local :

```bash
node local-server.mjs
```

Puis va sur :

```text
http://localhost:4173
```

## Partager avec GitHub Pages

1. Cree un nouveau repository sur GitHub.
2. Envoie ce dossier sur GitHub.
3. Dans GitHub, va dans `Settings` -> `Pages`.
4. Dans `Build and deployment`, choisis :
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - dossier: `/root`
5. GitHub te donnera un lien public pour jouer au jeu.

## Fichiers importants

- `index.html` : structure du jeu
- `style.css` : design et animations
- `game.js` : logique du gameplay

