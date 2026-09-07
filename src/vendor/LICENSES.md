# Licences des dépendances vendorisées

Ce dossier contient le code source de bibliothèques tierces, copié directement
dans le dépôt — zéro CDN, zéro appel réseau à l'exécution (voir `CLAUDE.md`,
règle absolue n°1).

Les 20 avatars de profil (`avatars/`, dessins OpenMoji) suivent la même règle
mais ont leur propre fichier de licence : `avatars/LICENSE.md`.

## ZzFX (`zzfx.js`)

- Source : https://github.com/KilledByAPixel/ZzFX (édition « Micro »,
  `ZzFXMicro.js`)
- Version d'origine : 1.3.2
- Licence : MIT — Copyright (c) 2019 Frank Force

**Modification par rapport à l'original** : le `AudioContext` (`zzfxX`) est créé
paresseusement au premier usage (fonction interne `zzfxContext()`), au lieu
d'une instanciation `const zzfxX = new AudioContext` au chargement du module.
Deux raisons :

1. L'original casse tout import sous Node/Vitest (`AudioContext` n'existe pas
   dans l'environnement de test `node`).
2. Ça rend la règle CLAUDE.md « l'`AudioContext` se débloque au premier tap,
   jamais au chargement » vraie mécaniquement, plutôt que vraie par chance.

Le reste — l'algorithme de synthèse — est inchangé.

Texte de licence complet :

```
MIT License

Copyright (c) 2019 Frank Force

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## canvas-confetti (`confetti.js`)

- Source : https://github.com/catdad/canvas-confetti
- Version : 1.9.4 (build ESM `dist/confetti.module.mjs`)
- Licence : ISC — Copyright (c) 2020, Kiril Vatev

Copié sans modification (seul un commentaire d'en-tête a été ajouté).

Texte de licence complet :

```
ISC License

Copyright (c) 2020, Kiril Vatev

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
