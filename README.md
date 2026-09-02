# PwnyMarket

PwnyMarket est une parodie de marché prédictif sur les annonces publiques de mésaventures numériques de l’administration française.

- aucun argent, portefeuille, compte, dépôt ou gain ;
- un vote par adresse IP et par marché actif ;
- aucune adresse IP conservée : seule une empreinte HMAC secrète et propre au marché est stockée ;
- aucune cote ne mesure la sécurité ou la vulnérabilité réelle d’un service ;
- aucun tracker ni contenu tiers chargé par l’application.

Le nom et l’interface sont satiriques. Le projet n’est affilié ni à Polymarket ni à l’administration française.

## Inventaire public

Le dossier [`exa-results/domaines-administration-francaise-2026-09-02`](exa-results/domaines-administration-francaise-2026-09-02) contient :

- `domaines-gouv-fr.csv` : 396 domaines publics candidats, issus de l’union du référentiel courant de la DILA et d’un instantané ProConnect de 2024 ;
- `grands-sites-administratifs.csv` : une sélection éditoriale de 72 grands services administratifs français.

Il n’existe pas, à notre connaissance, de registre public exhaustif et continuellement à jour de tous les sous-domaines `.gouv.fr`. Cette liste est donc un catalogue de services publics, pas une cartographie de sécurité ni une invitation à tester ces sites. Les entrées `proconnect_snapshot_only` sont historiques et ne doivent pas être considérées comme vérifiées en 2026.

Sources principales :

- [Référentiel de l’organisation administrative de l’État — DILA](https://www.data.gouv.fr/datasets/referentiel-de-lorganisation-administrative-de-letat)
- [API Annuaire de l’administration et des services publics](https://www.data.gouv.fr/dataservices/api-annuaire-de-ladministration-et-des-services-publics)
- [Liste ProConnect des domaines publics](https://github.com/proconnect-gouv/proconnect-identite/blob/main/packages/core/src/data/gouvfr-domains.ts)

## Développement local

Prérequis : Node.js 22.13 ou ultérieur.

```bash
npm install
cp .env.example .env
openssl rand -hex 32
```

Copier la valeur aléatoire dans `VOTE_HASH_SECRET` du fichier `.env`, puis :

```bash
npm run dev
```

La migration D1 se trouve dans `drizzle/0000_right_bug.sql`. Les fichiers `.env*`, la base locale Wrangler et les artefacts de build sont ignorés par Git.

## Runtime Zen

Le dossier `zen/` contient une variante sans dépendance npm pour Debian/Node 20. Elle sert l’interface et l’API à travers un socket Unix, avec un registre append-only en `0600`. Apache supprime les en-têtes d’IP fournis par le client avant d’ajouter l’adresse réseau observée ; Node la transforme immédiatement par HMAC et ne la journalise pas.

Les fichiers `deploy/zen/` préparent une release immuable sous `/var/www/html/pwnymarket`, un service systemd cloisonné et un vhost HTTPS. Un refus d’accès Apache global protège le répertoire avant toute copie : seuls les fichiers publics explicitement autorisés par le runtime sont servis par le proxy. L’activation publique refuse de continuer sans DNS résolu, certificat valide pour `pwnymarket.l0g.fr`, service sain et configuration Apache valide. La CSP n’autorise ni script inline, ni évaluation dynamique, ni ressource tierce.

Le registre est limité à 64 Mio. Une erreur d’écriture ou de synchronisation suspend les nouvelles écritures jusqu’à intervention ; le redémarrage refuse tout registre tronqué. Les compteurs de consultation sont calculés en temps constant, sans parcourir les votes à chaque requête.

## Contrôles

```bash
npm run test:security
npm run test:zen
npm run lint
npm run build
npm audit
```

## Limites du vote par IP

Cette protection légère réduit les doubles votes ordinaires, mais ne constitue pas une identité forte : plusieurs personnes derrière un même NAT partagent potentiellement un vote, tandis qu’un changement d’IP ou un VPN peut permettre un autre vote. Cette concession évite comptes, cookies persistants et collecte de données personnelles supplémentaires.

## Licence

[MIT](LICENSE)
