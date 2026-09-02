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

La production `pwnymarket.fr` utilise cette variante. Le prototype Sites/Vinext reste séparé ; son build n’est pas l’artefact déployé sur Zen. Pour prévisualiser le vrai front de production sur macOS : `npm run dev:zen` ouvre un serveur limité à `127.0.0.1:4173`, avec des votes temporaires isolés et un secret éphémère. Aucune écriture de production n’est effectuée.

Le dossier `zen/` contient une variante sans dépendance npm pour Debian. La production requiert une branche LTS corrigée : Node 22.23.2+ ou 24.18.1+ (minimum revu le 2 septembre 2026). L’installateur reçoit un chemin explicite vers un binaire existant, exige que lui et ses répertoires parents soient détenus par root sans écriture groupe/autres, puis vérifie sa version. Systemd répète la vérification au démarrage. Aucun runtime partagé n’est mis à niveau. L’application sert l’interface et l’API à travers un socket Unix, avec un registre append-only en `0600`. Apache supprime les en-têtes d’IP fournis par le client avant d’ajouter l’adresse réseau observée ; Node la transforme immédiatement par HMAC et ne la journalise pas.

Les fichiers `deploy/zen/` préparent une release immuable sous `/var/www/html/pwnymarket`, un service systemd cloisonné et un vhost HTTPS. Un refus d’accès Apache global protège le répertoire avant toute copie : seuls les fichiers publics explicitement autorisés par le runtime sont servis par le proxy. L’activation publique refuse de continuer sans DNS résolu, certificat valide pour `pwnymarket.fr`, service sain et configuration Apache valide. La CSP n’autorise ni script inline, ni évaluation dynamique, ni ressource tierce.

Le registre est limité à 64 Mio. Une erreur d’écriture ou de synchronisation suspend les nouvelles écritures jusqu’à intervention ; le redémarrage refuse tout registre tronqué. Les compteurs de consultation sont calculés en temps constant, sans parcourir les votes à chaque requête.

Les douze marchés ouverts sont déclarés dans `zen/public/markets.js`. Les identifiants existants et l’espace HMAC historique sont conservés. Une IP peut voter indépendamment dans chacun. Les marchés sont sans échéance ni résolution automatique ; les oracles sont satiriques. Les volumes et indices sont inventés et explicitement marqués comme tels. Les cotes reprennent les votes arrondis, ou 50/50 à zéro vote ; elles n’ont aucune valeur monétaire.

## Statistiques privées GoAccess

Après installation du runtime et activation HTTPS, exécuter en administrateur `deploy/zen/install-stats.sh` avec le même chemin Node validé. GoAccess et `apache2-utils` doivent déjà être installés. Le script crée un compte technique isolé et demande interactivement un mot de passe pour `/stats/` (utilisateur `bluetouff`). Ne jamais mettre le mot de passe dans une commande, une issue ou le dépôt.

Apache ne transmet au collecteur que l’horodatage, le statut, les octets et une catégorie de route fixe. Aucun IP, URI libre, paramètre, agent utilisateur, référent ou corps n’est collecté. Le collecteur abandonne les privilèges root avant toute lecture, valide les lignes et borne les fichiers à 2 Mio par jour, pendant au maximum 14 jours calendaires UTC. La purge a lieu au changement de jour et lors de la génération toutes les 15 minutes ; un plafond atteint est signalé comme une période incomplète.

GoAccess reçoit en mémoire un hôte constant uniquement pour son parseur. Le rapport ne reprend aucun compteur de visiteurs uniques, pays, OS ou navigateur : les requêtes incluent aussi les robots. Les journaux ne contiennent même pas cet hôte constant. Le rapport statique est servi hors de la racine web commune, avec authentification Basic, `no-store`, `noindex`, sans JavaScript ni exception CSP. Aucun serveur WebSocket n’est lancé. Le service de génération est isolé du réseau et limité en mémoire.

Contrôles : `systemctl status pwnymarket-stats.timer`, `systemctl status pwnymarket-stats.service`, puis `/stats/` doit répondre 401 sans authentification. Un test authentifié se fait avec le vrai compte et une saisie interactive, jamais avec un faux mot de passe. Références : [manuel GoAccess](https://goaccess.io/man), [variables de route Apache](https://httpd.apache.org/docs/2.4/mod/mod_setenvif.html).

## Contrôles

```bash
npm run test:security
npm run test:zen
npm run lint
npm run build
npm audit
```

Après activation sur Zen, `npm run test:live:headers` vérifie en lecture seule les en-têtes réellement servis sur `pwnymarket.fr`, pour l’accueil, la santé et une réponse 404. Les valeurs manquantes ou dupliquées font échouer ce contrôle.

## Limites du vote par IP

Cette protection légère réduit les doubles votes ordinaires, mais ne constitue pas une identité forte : plusieurs personnes derrière un même NAT partagent potentiellement un vote, tandis qu’un changement d’IP ou un VPN peut permettre un autre vote. Cette concession évite comptes, cookies persistants et collecte de données personnelles supplémentaires.

## Licence

[MIT](LICENSE)

La police Manrope Medium est auto-hébergée et conserve sa [licence SIL OFL 1.1](zen/public/manrope-OFL.txt), distincte de la licence du code. Source : [Manrope dans Google Fonts](https://github.com/google/fonts/tree/main/ofl/manrope). Les illustrations de Marianne au nez rouge et la carte sociale ont été générées pour cette parodie, sans affiliation officielle.
