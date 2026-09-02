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
npm ci
npm run dev:runtime
```

La prévisualisation crée un registre temporaire et un secret éphémère. Pour lancer directement `runtime/server.mjs`, fournir `PWNYMARKET_SOCKET`, `PWNYMARKET_LEDGER`, `PWNYMARKET_PUBLIC_ORIGIN`, `VOTE_HASH_SECRET` et `VOTE_HASH_NAMESPACE`. Les deux chemins doivent être absolus. Le secret et l’espace de nommage doivent rester stables pendant toute la vie d’un registre de votes.

Le prototype React est conservé dans `app/` et se lance avec `npm run dev`.

## Vérifications

```bash
npm run test:runtime
npm run test:security
npm run lint
npm run build
```

## Sources

Les [marchés achevés](https://pwnymarket.fr/archives) renvoient aux communications officielles. Le registre est non exhaustif ; les dates, unités et réserves des publications sont conservées. Aucun chiffre de fuite n’est inventé ou additionné à un total de victimes.

L’[inventaire administratif](exa-results/domaines-administration-francaise-2026-09-02) rassemble 396 domaines candidats et une sélection de 72 grands services. Sources : [DILA](https://www.data.gouv.fr/datasets/referentiel-de-lorganisation-administrative-de-letat), [Annuaire de l’administration](https://www.data.gouv.fr/dataservices/api-annuaire-de-ladministration-et-des-services-publics) et [ProConnect](https://github.com/proconnect-gouv/proconnect-identite/blob/main/packages/core/src/data/gouvfr-domains.ts). Les entrées issues uniquement de l’instantané ProConnect de 2024 restent historiques.

## Licence et crédits

Code sous [licence MIT](LICENSE). Manrope est auto-hébergée sous [SIL OFL 1.1](runtime/public/manrope-OFL.txt). Les illustrations ont été générées pour cette parodie.

powered by [@bluetouff](https://x.com/bluetouff) - [l0g.fr](https://l0g.fr/)
