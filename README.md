# PwnyMarket.fr

Liberté. Égalité. Données éparpillées.

[PwnyMarket.fr](https://pwnymarket.fr/) est une parodie de marché prédictif consacrée aux mésaventures numériques de l’administration française. Marianne supervise les placements. Son nez rouge tient lieu d’agrément.

- Aucun argent, compte, portefeuille ni gain.
- Un vote par adresse IP et par marché ouvert, avec les limites habituelles des connexions partagées et des changements d’adresse.
- Des volumes PNY inventés, des oracles douteux et des courbes décoratives.
- Des archives documentaires séparées, fondées sur des publications officielles.

Le site est indépendant de Polymarket et de l’administration française. Les votes ne mesurent ni la sécurité ni la vulnérabilité d’un service.

## Faire tourner le site

Le dossier `runtime/` contient le site et son moteur de vote, sans dépendance npm à l’exécution. Avec une version LTS corrigée de Node.js :

```bash
npm run dev
```

La prévisualisation crée un registre temporaire et un secret éphémère. Pour lancer directement `runtime/server.mjs`, fournir `PWNYMARKET_SOCKET`, `PWNYMARKET_LEDGER`, `PWNYMARKET_PUBLIC_ORIGIN`, `VOTE_HASH_SECRET` et `VOTE_HASH_NAMESPACE`. Les deux chemins doivent être absolus. Le secret et l’espace de nommage doivent rester stables pendant toute la vie d’un registre de votes.

La prévisualisation écoute uniquement sur `http://127.0.0.1:4173`.
Un autre port local peut être choisi avec `npm run dev -- --port 4174`.
`npm run dev:runtime` reste un alias. `npm start` lance le serveur avec la
configuration fournie par l'environnement.

Le prototype React/Cloudflare a été retiré du projet actif. Son code reste
récupérable dans l'historique Git. Les seuls paquets npm conservés servent au
lint et au formatage ; `npm ci` les installe pour le développement.

`npm run build` vérifie la syntaxe JavaScript et crée une copie autonome du
runtime dans un nouveau dossier `dist/pwnymarket-*`, avec les licences et un
manifeste SHA-256. Les fichiers du site sont copiés sans transformation.
Le paquet généré ne contient ni dépendances npm, ni configuration privée.

## Dossiers, classement et bulletin

Chaque marché possède une page `/m/<identifiant>` et des partages directs.
Le marché du jour suit une rotation UTC parmi les urnes ouvertes. Les tris
utilisent les votes enregistrés ; les classements par partage des voix et
consensus exigent cinq bulletins. L’indice de déni vaut
`200 × min(OUI, NON) / total`, arrondi à l’unité, et reste absent sans vote.
Le flux `/feed.xml` publie le catalogue, les clôtures et les résolutions.
Son historique initial reprend l’instantané du catalogue du 3 septembre 2026.

## Clôturer un marché

Les décisions éditoriales sont ajoutées à `runtime/market-events.json`, puis
validées avec les tests. Le serveur ne propose aucune route d’administration.
Un événement `closed` contient `marketId`, `type`, `at` et `reason`. Un événement
`resolved` ultérieur contient `marketId`, `type`, `at`, `choice` (`yes` ou `no`),
`summary` et `source` (`url`, `title`, `publishedAt`). Les dates suivent le format
UTC `YYYY-MM-DDTHH:mm:ss.sssZ`.

La résolution exige une clôture préalable et une publication officielle
postérieure à l’ouverture qui satisfait le critère visible sur la page.
Les domaines de sources sont limités à `.gouv.fr` et aux éditeurs officiels déjà
vérifiés dans les archives. Cette validation d’URL complète la vérification
éditoriale du contenu de la source. Aucun résultat n’est généré automatiquement.

La fermeture prend effet lorsque la version contenant l’événement est publiée.
Les bulletins déjà acceptés sont conservés et le serveur refuse les suivants,
y compris depuis une page restée ouverte. Conserver les identifiants et les
événements antérieurs lors des évolutions. Ajouter `publishedAt` et, si nécessaire,
un `criteria` spécifique à chaque nouveau marché dans `runtime/public/markets.js`.

## Vérifications

```bash
npm ci
npm run test:runtime
npm run test:security
npm run test:dependencies
npm run lint
npm run build
npm audit
```

## Sources

Les [marchés achevés](https://pwnymarket.fr/archives) renvoient aux communications officielles. Le registre est non exhaustif ; les dates, unités et réserves des publications sont conservées. Aucun chiffre de fuite n’est inventé ou additionné à un total de victimes.

L’[inventaire administratif](exa-results/domaines-administration-francaise-2026-09-02) rassemble 396 domaines candidats et une sélection de 72 grands services. Sources : [DILA](https://www.data.gouv.fr/datasets/referentiel-de-lorganisation-administrative-de-letat), [Annuaire de l’administration](https://www.data.gouv.fr/dataservices/api-annuaire-de-ladministration-et-des-services-publics) et [ProConnect](https://github.com/proconnect-gouv/proconnect-identite/blob/main/packages/core/src/data/gouvfr-domains.ts). Les entrées issues uniquement de l’instantané ProConnect de 2024 restent historiques.

## Licence et crédits

Code sous [licence MIT](LICENSE). Manrope est auto-hébergée sous [SIL OFL 1.1](runtime/public/manrope-OFL.txt). Les illustrations ont été générées pour cette parodie.

powered by [@bluetouff](https://x.com/bluetouff) - [l0g.fr](https://l0g.fr/)
