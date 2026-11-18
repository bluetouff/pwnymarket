const shellPublication = {
  publishedAt: '2026-11-18T15:18:00.000Z',
  criteria:
    'OUI : une publication officielle postérieure à l’ouverture atteste précisément la scène administrative décrite dans la question. NON : elle en établit explicitement le contraire. La présence d’une technologie, un avis de sécurité ou une panne ne suffisent pas à confirmer la scène. Sans preuve, le résultat reste en attente.',
};
const javaContext =
  'Java4Shell (CVE-2026-114938), publiée le 17 novembre 2026, touche le décodage Base64 de certaines JVM sur processeurs x86-64 avec AVX-512 VBMI. La seule présence de Java ne démontre aucune exposition.';
const nodeContext =
  'L’avis Node.js du 21 octobre 2026 décrit CVE-2026-111497, la faille Brotli surnommée Node4Shell. Son exploitation suppose que l’application décompresse des données hostiles avec une version affectée.';
const phpContext =
  'PHP2Shell désigne CVE-2026-109618 et CVE-2026-109619, corrigées par PHP le 21 octobre 2026. Le moteur PHP est concerné ; Drupal ne permet pas de connaître la version ni les correctifs du serveur.';
const javaAdvisory = {
  title: 'Calif : Java4Shell, recherche originale du 17 novembre 2026',
  url: 'https://calif.io/java4shell/',
};
const nodeAdvisory = {
  title: 'Node.js : avis de sécurité du 21 octobre 2026, CVE-2026-111497',
  url: 'https://nodejs.org/en/blog/vulnerability/october-2026-security-releases',
};
const phpAdvisory = {
  title: 'PHP : avis officiel du 21 octobre 2026',
  url: 'https://www.php.net/archive/2026.php#2026-10-21-5',
};
const franceTravailStack = {
  title:
    'France Travail : offre DGA Tech du 6 novembre 2026, Java et proxy Node.js',
  url: 'https://recrute.francetravail.org/offre-de-emploi/emploi-product-manager-f-h_90914.aspx',
};

export const MARKETS = Object.freeze([
  {
    id: 'impots-next-official-notice',
    category: 'Cyber-loto',
    symbol: '€',
    service: 'impots.gouv.fr',
    title:
      'Impots.gouv.fr sera-t-il cité dans le prochain communiqué officiel parlant d’une fuite de données ?',
    oracle: 'Screenshot Twitter d’un stagiaire',
    detail: 'Plan B : pile ou face. La pièce appartient au Trésor public.',
    volume: '12 345',
  },
  {
    ...shellPublication,
    id: 'france-travail-java4shell-cdi',
    category: 'Cyber-loto',
    symbol: 'JVM',
    service: 'France Travail · environnement Java',
    title:
      'France Travail proposera-t-il à Java4Shell un CDI « prise de poste immédiate, accès à tout » ?',
    oracle: 'Un conseiller en reconversion de processus',
    detail:
      'La JVM cherche un emploi. Le shell exige deux jours de télétravail et tous les droits dès l’intégration.',
    volume: '17 017',
    context:
      'Une offre de la DGA Tech de France Travail cite Java, Quarkus et Spring Boot parmi les compétences recherchées. Elle ne décrit pas tout le SI. ' +
      javaContext,
    sources: [franceTravailStack, javaAdvisory],
  },
  {
    ...shellPublication,
    id: 'insee-queen-java4shell-recensement',
    category: 'Cyber-loto',
    symbol: 'JVM',
    service: 'Insee · Queen Back Office',
    title:
      'L’Insee ajoutera-t-il Java4Shell au questionnaire de Queen, rubrique « autres occupants du serveur » ?',
    oracle: 'Un enquêteur qui compte les processus à domicile',
    detail:
      'Un shell de plus au foyer. Merci de préciser s’il réside en mémoire à titre principal.',
    volume: '64 064',
    context:
      'Le dépôt officiel Queen Back Office de l’Insee documente une API Java, Spring Boot et PostgreSQL pour les interfaces Queen/Stromae. ' +
      javaContext,
    sources: [
      {
        title: 'Insee : code et prérequis de Queen Back Office',
        url: 'https://github.com/InseeFr/Queen-Back-Office',
      },
      javaAdvisory,
    ],
  },
  {
    ...shellPublication,
    id: 'proconnect-node4shell-siret',
    category: 'Cyber-loto',
    symbol: 'OIDC',
    service: 'DINUM · ProConnect Identité',
    title:
      'Node4Shell devra-t-il fournir un SIRET pour se faire reconnaître par ProConnect Identité ?',
    oracle: 'Un shell en profession libérale',
    detail:
      'Activité déclarée : exécution de commandes. La chambre des métiers hésite entre informatique et ouverture de portes.',
    volume: '14 014',
    context:
      'Le dépôt officiel décrit ProConnect Identité comme un fournisseur d’identité de la DINUM, avec une application Node.js/Express et des comptes liés à une organisation disposant d’un SIRET. ' +
      nodeContext,
    sources: [
      {
        title: 'DINUM : architecture et fonctionnement de ProConnect Identité',
        url: 'https://github.com/proconnect-gouv/proconnect-identite',
      },
      nodeAdvisory,
    ],
  },
  {
    ...shellPublication,
    id: 'dinum-grist-node4shell-cellule',
    category: 'Solutions souveraines',
    symbol: 'CELL',
    service: 'DINUM · Grist de La Suite numérique',
    title:
      'La DINUM suivra-t-elle Node4Shell dans Grist avec une colonne « responsable » intégralement vide ?',
    oracle: 'La cellule B42, promue cellule de crise',
    detail:
      'La cellule « correctif » attend sa formule. La cellule de crise a déjà son onglet.',
    volume: '65 536',
    context:
      'La Suite numérique propose une instance interministérielle de Grist. Le code de Grist documente un serveur Node.js et un moteur de formules Python isolé. ' +
      nodeContext,
    sources: [
      {
        title:
          'La Suite numérique : présentation de Grist et instance interministérielle',
        url: 'https://lasuite.numerique.gouv.fr/services/grist',
      },
      {
        title:
          'Grist Labs : architecture du serveur Node.js et du moteur Python',
        url: 'https://github.com/gristlabs/grist-core/blob/main/documentation/overview.md',
      },
      nodeAdvisory,
    ],
  },
  {
    ...shellPublication,
    id: 'france-travail-node4shell-proxy',
    category: 'Cyber-loto',
    symbol: 'BR',
    service: 'France Travail · proxy Node.js / TypeScript',
    title:
      'Chez France Travail, Node4Shell sera-t-il réorienté vers le proxy parce que son dossier est trop compressé ?',
    oracle: 'Brotli, demandeur de décompression',
    detail:
      'Brotli est convoqué à un entretien. Motif : décompression sans projet professionnel.',
    volume: '22 024',
    context:
      'Une offre de la DGA Tech de France Travail mentionne explicitement le maintien en condition opérationnelle d’une brique de proxy Node.js/TypeScript. ' +
      nodeContext,
    sources: [franceTravailStack, nodeAdvisory],
  },
  {
    ...shellPublication,
    id: 'impots-php2shell-revenus',
    category: 'Cyber-loto',
    symbol: 'PHP',
    service: 'DGFiP · portail éditorial impots.gouv.fr',
    title:
      'Les impôts demanderont-ils à PHP2Shell de déclarer son shell dans la case « revenus non salariés » ?',
    oracle: 'Un inspecteur des privilèges non déclarés',
    detail:
      'Drupal prépare la 2042-RCE. Le barème des privilèges sera publié après arbitrage de Bercy.',
    volume: '20 042',
    context:
      'La déclaration d’accessibilité d’impots.gouv.fr cite Drupal, un CMS PHP, pour le portail public. Cela ne décrit pas la stack des espaces fiscaux authentifiés. ' +
      phpContext,
    sources: [
      {
        title: 'DGFiP : technologies déclarées pour le portail impots.gouv.fr',
        url: 'https://www.impots.gouv.fr/accessibilite',
      },
      phpAdvisory,
    ],
  },
  {
    ...shellPublication,
    id: 'eduscol-php2shell-baccalaureat',
    category: 'Cyber-loto',
    symbol: 'PHP',
    service: 'Éducation nationale · Éduscol STI',
    title:
      'Éduscol STI mettra-t-il PHP2Shell au programme du bac, option « accès au serveur sans lever la main » ?',
    oracle: 'Un jury qui exige de rendre le shell en fin d’épreuve',
    detail:
      'Le sujet porte sur PHP. Toute réponse justifiée par « ça marchait l’année dernière » vaut zéro.',
    volume: '20 020',
    context:
      'Les mentions légales d’Éduscol STI indiquent Drupal 7. Cette déclaration concerne ce sous-site pédagogique ; elle ne décrit pas tous les services de l’Éducation nationale. ' +
      phpContext,
    sources: [
      {
        title: 'Éduscol STI : mentions légales et CMS déclaré',
        url: 'https://sti.eduscol.education.fr/mentions_legales',
      },
      phpAdvisory,
    ],
  },
  {
    ...shellPublication,
    id: 'bercy-php2shell-prestataire',
    category: 'Bureaucratie',
    symbol: 'PHP',
    service: 'Bercy · portail economie.gouv.fr',
    title:
      'Bercy inscrira-t-il PHP2Shell comme prestataire Drupal au lieu de le faire sortir du portail ?',
    oracle: 'Un bon de commande avec accès root',
    detail:
      'Le shell a fourni son RIB. Le bon de commande dit « maintenance évolutive en autonomie complète ».',
    volume: '40 000',
    context:
      'La formation officielle de l’IGPDE pour les responsables éditoriaux d’economie.gouv.fr décrit des sites sous Drupal, un CMS PHP. Ce périmètre éditorial ne décrit pas les applications financières de Bercy. ' +
      phpContext,
    sources: [
      {
        title:
          'IGPDE : formation au portail economie.gouv.fr et environnement Drupal',
        url: 'https://catalogue.igpde.finances.gouv.fr/1881-etre-responsable-editorial-sur-le-portail-economiegouvfr.html',
      },
      phpAdvisory,
    ],
  },
  {
    id: 'printer-runs-doom',
    category: 'Culture geek',
    symbol: 'DOOM',
    service: 'Bureau des toners possédés',
    title:
      'L’imprimante du ministère fera-t-elle tourner DOOM avant d’imprimer une attestation ?',
    oracle: 'Un speedrunner de catégorie C',
    detail:
      'Le boss final exige un justificatif de domicile de moins de trois mois.',
    volume: '66 666',
  },
  {
    id: 'vim-before-retirement',
    category: 'Culture geek',
    symbol: ':q!',
    service: 'Direction des sorties impossibles',
    title: 'L’agent entré dans Vim en 2009 en sortira-t-il avant sa retraite ?',
    oracle: 'Un collègue qui utilise nano',
    detail: 'Sa demande de départ contient 4 812 fois « :q ».',
    volume: '4 812',
  },
  {
    id: 'ransomware-needs-siret',
    category: 'Bureaucratie',
    symbol: 'RIB',
    service: 'Rançongiciel, service fournisseurs',
    title:
      'Le rançongiciel abandonnera-t-il après qu’on lui aura demandé un SIRET, un RIB et une attestation URSSAF ?',
    oracle: 'Le comptable, boss final du ransomware',
    detail: 'Le gang vient d’ouvrir un ticket pour comprendre Chorus Pro.',
    volume: '49 349',
  },
  {
    id: 'bug-bounty-tote-bag',
    category: 'Cyber-loto',
    symbol: 'RCE',
    service: 'Prime à la précarité offensive',
    title:
      'Le bug bounty récompensera-t-il une faille critique avec un tote bag « Merci pour votre vigilance » ?',
    oracle: 'Un mug marqué « cyber-résilient »',
    detail: 'Le chercheur demande un CVE. La com’ propose un porte-clés.',
    volume: '0 007',
  },
  {
    id: 'kubernetes-canteen',
    category: 'Solutions souveraines',
    symbol: 'K8S',
    service: 'Cantine as a Service',
    title:
      'La DSI déploiera-t-elle un cluster Kubernetes pour héberger le menu de la cantine ?',
    oracle: 'Un DevOps qui a sauté le déjeuner',
    detail:
      'Les lasagnes sont en CrashLoopBackOff. Le dessert attend son Helm chart.',
    volume: '32 768',
  },
  {
    id: 'soc-coffee-critical',
    category: 'Cyber-loto',
    symbol: 'P1',
    service: 'SOC sous perfusion',
    title:
      'Le SOC classera-t-il la panne de la machine à café en incident de sécurité nationale ?',
    oracle: 'Une sonde dans la cafetière',
    detail:
      'Le plan de reprise prévoit du soluble. L’équipe a préféré démissionner.',
    volume: '9 999',
  },
  {
    id: 'sudo-cerfa',
    category: 'Bureaucratie',
    symbol: 'root',
    service: 'Préfecture des privilèges',
    title:
      'Faudra-t-il un Cerfa en trois exemplaires pour entrer dans le groupe sudo ?',
    oracle: 'root, absent le mercredi',
    detail: 'Le formulaire exige les droits sudo pour être ouvert.',
    volume: '4 096',
  },
  {
    id: 'zero-trust-colleagues',
    category: 'Solutions souveraines',
    symbol: '0',
    service: 'Architecture de la méfiance',
    title:
      'La DSI fera-t-elle homologuer « je ne fais confiance à aucun de mes collègues » comme architecture Zero Trust ?',
    oracle: 'Un Post-it signé par personne',
    detail: 'Le budget est nul. La défiance est déjà en production.',
    volume: '0 404',
  },
  {
    id: 'temporary-password-birthday',
    category: 'Cyber-loto',
    symbol: '!!',
    service: 'Direction du temporaire éternel',
    title:
      'Le mot de passe « provisoire » fêtera-t-il ses dix ans avec un deuxième point d’exclamation ?',
    oracle: 'Le Post-it sous le clavier',
    detail: 'Le premier point d’exclamation a demandé une mobilité interne.',
    volume: '10 010',
  },
  {
    id: 'airgap-coffee-usb',
    category: 'Cyber-loto',
    symbol: 'USB',
    service: 'Réseau isolé, clé bien entourée',
    title:
      'Le réseau « totalement isolé » recevra-t-il une clé USB trouvée à côté des chouquettes ?',
    oracle: 'L’antivirus de la machine à café',
    detail:
      'L’étiquette dit « photos pot de départ ». L’ingénierie sociale sent le beurre.',
    volume: '2 048',
  },
  {
    id: 'pentest-one-useful-page',
    category: 'Langue de bois',
    symbol: 'PDF',
    service: 'Audit au poids du livrable',
    title:
      'Le prestataire livrera-t-il un pentest de 180 pages dont 179 expliquent ce qu’est un pentest ?',
    oracle: 'Un commercial certifié copier-coller',
    detail: 'La dernière recommande le renouvellement du contrat.',
    volume: '180 180',
  },
  {
    id: 'siem-mark-all-read',
    category: 'Cyber-loto',
    symbol: '1M',
    service: 'Observatoire du voyant vert',
    title:
      'Le SIEM atteindra-t-il le million d’alertes avant le premier « tout marquer comme lu » ?',
    oracle: 'Un stagiaire avec Ctrl+A',
    detail: 'Le tableau de bord reste vert. Il a été imprimé en couleur.',
    volume: '1 000 000',
  },
  {
    id: 'backup-on-same-nas',
    category: 'Solutions souveraines',
    symbol: 'NAS',
    service: 'Sauvegarde de proximité immédiate',
    title:
      'La sauvegarde du NAS sera-t-elle retrouvée dans un dossier « backup » sur le même NAS ?',
    oracle: 'Un câble Ethernet béni',
    detail: 'Le plan de reprise tient dans le mot « normalement ».',
    volume: '8 192',
  },
  {
    id: 'hoodie-tv-expert',
    category: 'Langue de bois',
    symbol: 'TV',
    service: 'École du hacker à capuche',
    title:
      'Une capuche noire suffira-t-elle à transformer le chargé de com’ en expert cyber sur un plateau télé ?',
    oracle: 'Une banque d’images en RTT',
    detail:
      'Épreuve pratique : dire « dark web » devant des chiffres verts qui tombent.',
    volume: '13 370',
  },
  {
    id: 'cookies-49-clicks',
    category: 'Bureaucratie',
    symbol: '49×',
    service: 'Guichet du consentement à l’usure',
    title:
      'Le bandeau cookies demandera-t-il 49 clics et une commission d’enquête pour refuser ?',
    oracle: 'Un DPO équipé d’une souris de gamer',
    detail: 'Le bouton « tout accepter » a sa propre sortie de secours.',
    volume: '49 049',
  },
  {
    id: 'reboot-resilience-consulting',
    category: 'Culture geek',
    symbol: 'I/O',
    service: 'The IT Crowd, option marchés publics',
    title:
      '« Vous avez essayé de l’éteindre et de le rallumer ? » sera-t-il facturé comme audit de résilience électrique ?',
    oracle: 'Moss, derrière la baie',
    detail: 'Le câble était débranché. Le diagnostic est hors forfait.',
    volume: '5 800',
  },
  {
    id: 'flipper-parking-threat',
    category: 'Culture geek',
    symbol: 'RF',
    service: 'Direction du dauphin suspect',
    title:
      'Le Flipper Zero saisi à l’entrée du ministère ouvrira-t-il uniquement le portail de Jean-Michel ?',
    oracle: 'Un badge de parking démagnétisé',
    detail: 'Menace classée rouge. Jean-Michel doit maintenant rentrer à pied.',
    volume: '433 920',
  },
  {
    id: 'minitel-post-quantum',
    category: 'Solutions souveraines',
    symbol: '3615',
    service: 'Direction générale du futur antérieur',
    title:
      'Le Minitel sera-t-il rebaptisé « terminal souverain résistant aux attaques quantiques » ?',
    oracle: '3615 QUANTIQUE',
    detail: 'Le chiffrement repose sur le fait que plus personne n’a le câble.',
    volume: '3 615',
  },
  {
    id: 'rssi-friday-holidays',
    category: 'Cyber-loto',
    symbol: 'RTT',
    service: 'Défense en profondeur du calendrier',
    title:
      'Le RSSI posera-t-il ses congés avant d’ouvrir le mail « petite mise en prod vendredi » ?',
    oracle: 'Un Outlook en mode avion',
    detail: 'Son répondeur a obtenu l’homologation Secret Défense.',
    volume: '17 590',
  },
  {
    id: 'ctf-find-cyber-invoice',
    category: 'Culture geek',
    symbol: 'CTF',
    service: 'Capture The Facture',
    title:
      'Le CTF du ministère proposera-t-il un challenge « retrouver la facture du prestataire cyber » coté impossible ?',
    oracle: 'Un badge visiteur de 2007',
    detail:
      'Le flag est dans une boîte mail supprimée. L’auteur du challenge est en retraite.',
    volume: '31 337',
  },
  {
    id: 'maintenance-before-incident',
    category: 'Langue de bois',
    symbol: '…',
    service: 'Communication de crise',
    title:
      'La « maintenance exceptionnelle » sera-t-elle requalifiée en « incident maîtrisé » avant le café ?',
    oracle: 'Ctrl+F dans le communiqué',
    detail: 'Le mot « cyber » coûte un ticket restaurant.',
    volume: '42 069',
  },
  {
    id: 'friday-1759',
    category: 'Cyber-loto',
    symbol: '17:59',
    service: 'Le vendredi de tous les dangers',
    title:
      'Le prochain communiqué tombera-t-il un vendredi à 17 h 59, juste après le départ du RSSI ?',
    oracle: 'Horloge parlante en RTT',
    detail: 'Toute ressemblance avec un calendrier est fortuite.',
    volume: '8 008',
  },
  {
    id: 'password-reset-reaction',
    category: 'Solutions souveraines',
    symbol: '***',
    service: 'Cellule de crise',
    title:
      'La réponse officielle sera-t-elle « changez votre mot de passe », même pour les données déjà parties ?',
    oracle: 'Le cousin qui fait de l’informatique',
    detail: 'Il a redémarré la Livebox. Deux fois.',
    volume: '404 404',
  },
  {
    id: 'cerfa-data-leak',
    category: 'Bureaucratie',
    symbol: 'C+',
    service: 'Ministère du formulaire',
    title:
      'Faudra-t-il remplir un Cerfa pour déclarer la fuite du Cerfa qui déclare les fuites ?',
    oracle: 'Tampon humide sur papier sec',
    detail: 'Prévoir trois exemplaires et une enveloppe timbrée.',
    volume: '13 337',
  },
  {
    id: 'franceconnect-loop',
    category: 'Bureaucratie',
    symbol: '↻',
    service: 'FranceConnect, FranceDéconnecte',
    title:
      'FranceConnect vous renverra-t-il vers FranceConnect pour prouver que vous êtes bien connecté à FranceConnect ?',
    oracle: 'Un onglet ouvert depuis 2019',
    detail: 'La session a expiré pendant la lecture de cette phrase.',
    volume: '360 360',
  },
  {
    id: 'captcha-minister',
    category: 'Solutions souveraines',
    symbol: '✓',
    service: 'Identité presque nationale',
    title:
      'Le prochain CAPTCHA demandera-t-il de cocher toutes les cases contenant un ministre encore en poste ?',
    oracle: 'Photo de classe du gouvernement',
    detail: 'Attention : la bonne réponse peut changer pendant le test.',
    volume: '49 300',
  },
  {
    id: 'pdf-final-final',
    category: 'Langue de bois',
    symbol: 'PDF',
    service: 'Direction des pièces jointes',
    title:
      'Le bilan de l’incident s’appellera-t-il FINAL_v12_corrigé_VRAIMENT_FINAL(2).pdf ?',
    oracle: 'Le dossier Téléchargements du cabinet',
    detail: 'La version confidentielle porte exactement le même nom.',
    volume: '12 012',
  },
  {
    id: 'sovereign-excel',
    category: 'Solutions souveraines',
    symbol: 'XLS',
    service: 'Cloud de la République',
    title:
      'Le « cloud souverain » sera-t-il un fichier Excel partagé nommé NE_PAS_SUPPRIMER ?',
    oracle: 'Une clé USB tricolore',
    detail: 'Hébergé dans un tiroir. Haute disponibilité les jours ouvrés.',
    volume: '65 536',
  },
  {
    id: 'ants-scanner',
    category: 'Bureaucratie',
    symbol: 'ANTS',
    service: 'Le permis de patienter',
    title:
      'L’ANTS demandera-t-elle une photo du scanner pour justifier pourquoi le justificatif est illisible ?',
    oracle: 'Un photomaton agréé en grève',
    detail: 'Pièce manquante : le justificatif du justificatif.',
    volume: '7 777',
  },
  {
    id: 'ai-commission',
    category: 'Solutions souveraines',
    symbol: 'IA',
    service: 'Task force des task forces',
    title:
      'Une IA souveraine proposera-t-elle de créer un comité pour réfléchir à la création d’une IA souveraine ?',
    oracle: 'ChatGPT avec une écharpe tricolore',
    detail: 'Livrable attendu : un PowerPoint de 148 slides.',
    volume: '1 024',
  },
  {
    id: 'no-sensitive-data',
    category: 'Langue de bois',
    symbol: 'RAS',
    service: 'Tout va très bien',
    title:
      '« Aucune donnée sensible » sera-t-il suivi de « sauf les noms, adresses et numéros de sécurité sociale » ?',
    oracle: 'Un astérisque en police 6',
    detail: 'L’astérisque est actuellement en maintenance.',
    volume: '99 999',
  },
]);
