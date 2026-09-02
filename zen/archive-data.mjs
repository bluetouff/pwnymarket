// Editorial records checked against the linked official publications, 2026-09-02.
// Dates below are communication dates. Incident dates are stated separately where known.
export const ARCHIVE_REVIEWED_AT = '2026-09-02';
export const ARCHIVES = [
  {
    id: 'dgfip-successions-2026',
    date: '2026-08-27',
    administration: 'DGFiP',
    service: 'Portail des successions vacantes',
    volume: 'Non précisé',
    status: 'Extraction constatée',
    detail:
      'La DGFiP confirme une extraction après la découverte d’une vulnérabilité le 17 août 2026. Le portail concerné contient des données publiques. La page officielle a été actualisée le 27 août.',
    sources: [
      [
        'Information de la DGFiP',
        'https://www.impots.gouv.fr/actualite/vol-de-donnees-suite-des-acces-illegitimes-au-systeme-dinformation-de-la-dgfip',
      ],
    ],
  },
  {
    id: 'dgfip-fiscal-2026',
    date: '2026-08-14',
    administration: 'DGFiP',
    service: 'Données fiscales et cadastrales',
    volume: '678 000 particuliers et professionnels',
    status: 'Extraction confirmée',
    detail:
      'Accès illégitimes en juin et juillet 2026. Le communiqué chiffre les usagers concernés et mentionne notamment des données fiscales. Les espaces personnels et leurs mots de passe n’ont pas été compromis.',
    sources: [
      [
        'Communiqué du ministère des Finances',
        'https://presse.economie.gouv.fr/acces-illegitime-au-systeme-dinformation-de-la-direction-generale-des-finances-publiques/',
      ],
    ],
  },
  {
    id: 'aefe-orion-2026',
    date: '2026-08-14',
    administration: 'Agence pour l’enseignement français à l’étranger',
    service: 'Intranet Orion',
    volume: 'Non précisé',
    status: 'Accès non autorisé',
    detail:
      'Incident dans la nuit du 11 au 12 août 2026. Une partie des données de comptes des agents du siège et du réseau a été accessible, dont leur identité, leur affectation et leur photographie de profil.',
    sources: [
      [
        'Information de l’AEFE',
        'https://aefe.gouv.fr/fr/actualites/incident-de-cybersecurite',
      ],
    ],
  },
  {
    id: 'bloctel-2026',
    date: '2026-08-12',
    administration: 'DGCCRF · Bloctel',
    service: 'Compte professionnel compromis',
    volume: '3 millions de numéros de téléphone',
    status: 'Fichiers récupérés',
    detail:
      'Dont 600 000 numéros inscrits sur Bloctel. La DGCCRF indique qu’aucun nom ni aucune adresse n’accompagnent ces numéros et que la base Bloctel elle-même n’a pas été compromise.',
    sources: [
      [
        'Communiqué de la DGCCRF',
        'https://presse.economie.gouv.fr/la-dgccrf-met-en-garde-les-consommateurs-a-la-suite-dune-fuite-de-donnees-sur-bloctel/',
      ],
    ],
  },
  {
    id: 'gagny-2026',
    date: '2026-08-03',
    administration: 'Ville de Gagny',
    service: 'Système d’information municipal',
    volume: 'Non précisé',
    status: 'Accès non autorisé',
    detail:
      'La ville confirme une cyberattaque et des accès possibles à des données personnelles d’usagers. Au stade de cette communication, les personnes et les données effectivement consultées ne sont pas toutes identifiées.',
    sources: [
      [
        'Information de la Ville de Gagny',
        'https://www.gagny.fr/actualite/information-relative-a-un-incident-de-cybersecurite/',
      ],
    ],
  },
  {
    id: 'tchap-2026',
    date: '2026-06-08',
    administration: 'DINUM',
    service: 'Tchap',
    volume: '73 467 agents potentiellement concernés',
    status: 'Compte compromis',
    detail:
      'Compromission signalée le 7 juin 2026. Le périmètre décrit concerne des données de comptes et les salons publics accessibles. Les historiques des conversations privées chiffrées demeurent protégés selon la DINUM.',
    sources: [
      [
        'Communiqué de la DINUM',
        'https://www.numerique.gouv.fr/sinformer/espace-presse/incident-tchap/',
      ],
    ],
  },
  {
    id: 'quiberon-2026',
    date: '2026-05-11',
    administration: 'Ville de Quiberon',
    service: 'Système d’information municipal',
    volume: 'Non précisé',
    status: 'Cyberattaque confirmée',
    detail:
      'Rançongiciel le 3 mai 2026. La ville indique que certaines données personnelles ont pu être consultées et exfiltrées. Le communiqué ne quantifie pas cette exposition.',
    sources: [
      [
        'Point de situation de la Ville de Quiberon',
        'https://www.ville-quiberon.fr/actualites/cyberattaque-point-de-situation/',
      ],
    ],
  },
  {
    id: 'parcoursup-occitanie-2025',
    date: '2026-04-23',
    administration: 'Ministère de l’Enseignement supérieur',
    service: 'Module de gestion Parcoursup · Occitanie',
    volume: 'Environ 705 000 candidats',
    status: 'Extraction confirmée',
    detail:
      'Exfiltration en octobre 2025, signalée en mars 2026. Les dossiers concernent les sessions 2023 et 2025 : candidats résidant en Occitanie ou y ayant formulé des vœux. L’année d’une session ne désigne pas l’année du piratage.',
    sources: [
      [
        'Communiqué du ministère',
        'https://www.enseignementsup-recherche.gouv.fr/fr/incident-de-securite-affectant-les-donnees-de-certains-candidats-des-sessions-parcoursup-2023-et-101350',
      ],
    ],
  },
  {
    id: 'ants-2026',
    date: '2026-04-21',
    administration: 'France Titres · ANTS',
    service: 'Comptes du portail ants.gouv.fr',
    volume: '11,7 millions de comptes potentiellement concernés',
    status: 'Incident confirmé',
    detail:
      'Incident détecté le 15 avril 2026. Ce bilan est présenté sous réserve des investigations. Les pièces jointes aux démarches et les données biométriques sont exclues du périmètre décrit dans ce communiqué.',
    sources: [
      [
        'Point d’étape du ministère de l’Intérieur',
        'https://www.interieur.gouv.fr/actualites/communiques-de-presse/point-detape-du-21-avril-2026-concernant-lincident-de-securite-relatif-au-portail-antsgouvfr',
      ],
    ],
  },
  {
    id: 'educonnect-2025',
    date: '2026-04-14',
    administration: 'Ministère de l’Éducation nationale',
    service: 'Service de gestion des comptes élèves lié à ÉduConnect',
    volume: 'Non précisé · évaluation en cours',
    status: 'Fuite confirmée',
    detail:
      'L’accès frauduleux remonte à la fin de 2025. Des données d’élèves ont été téléchargées au-delà de l’établissement initialement visé. Le communiqué ne chiffre pas les élèves concernés.',
    sources: [
      [
        'Communiqué du ministère',
        'https://www.education.gouv.fr/incident-de-securite-affectant-les-donnees-de-certains-eleves-de-l-education-nationale-504443',
      ],
    ],
  },
  {
    id: 'haute-comte-2025',
    date: '2026-03-30',
    administration: 'Centre hospitalier intercommunal de Haute-Comté',
    service: 'Système d’information hospitalier',
    volume: 'Fuite non établie dans cette source',
    status: 'Cyberattaque confirmée',
    detail:
      'L’ARS documente l’attaque du 19 octobre 2025 et l’interruption totale du système d’information. Ce point de situation porte sur la reconstruction et ne donne aucun volume de données exfiltrées.',
    sources: [
      [
        'Point de situation de l’ARS Bourgogne-Franche-Comté',
        'https://www.bourgogne-franche-comte.ars.sante.fr/point-de-situation-au-centre-hospitalier-de-haute-comte-cybersecurite-une-reponse-collective',
      ],
    ],
  },
  {
    id: 'crous-mesrdv-2026',
    date: '2026-03-24',
    administration: 'Cnous · réseau des Crous',
    service: 'MesRDV.etudiant.gouv.fr',
    volume: '774 000 personnes',
    status: 'Extraction confirmée',
    detail:
      'Incident porté à la connaissance du Cnous le 23 mars 2026. Des pièces jointes ont été exfiltrées pour 139 000 personnes ; pour 635 000 autres, l’extraction concerne des données de rendez-vous plus limitées.',
    sources: [
      [
        'Communiqué du Cnous',
        'https://www.lescrous.fr/2026/03/exfiltration-de-donnees-provenant-du-site-mesrdv-etudiant-gouv-fr/',
      ],
    ],
  },
  {
    id: 'foromes-2026',
    date: '2026-02-20',
    administration:
      'Ministère des Sports, de la Jeunesse et de la Vie associative',
    service: 'FORÔMES',
    volume: '450 000 candidats',
    status: 'Extraction confirmée',
    detail:
      'La plateforme de gestion des formations et diplômes de l’animation et du sport a été affectée après le piratage d’un compte d’organisme de formation. Le ministère chiffre les candidats dont les données ont été exfiltrées.',
    sources: [
      [
        'Communiqué du ministère',
        'https://www.sports.gouv.fr/exfiltration-de-donnees-provenant-d-un-des-systemes-d-information-du-ministere-des-sports-de-la',
      ],
    ],
  },
  {
    id: 'ficoba-2026',
    date: '2026-02-18',
    administration: 'DGFiP',
    service: 'FICOBA · fichier national des comptes bancaires',
    volume: '1,2 million de comptes potentiellement concernés',
    status: 'Accès illégitimes confirmés',
    detail:
      'Accès à partir de la fin janvier 2026 après usurpation d’identifiants. Le volume annoncé concerne des comptes bancaires, avec notamment les coordonnées bancaires et l’identité des titulaires.',
    sources: [
      [
        'Communiqué du ministère des Finances',
        'https://presse.economie.gouv.fr/acces-illegitimes-au-fichier-national-des-comptes-bancaires-ficoba/',
      ],
    ],
  },
  {
    id: 'ofb-2026',
    date: '2026-01-30',
    administration: 'Office français de la biodiversité',
    service: 'Application du permis de chasser',
    volume: 'Non précisé',
    status: 'Accès non autorisé',
    detail:
      'L’OFB confirme l’accès à certaines données des candidats, demandeurs et titulaires du permis. Aucun effectif de personnes concernées n’est fourni dans cette information officielle.',
    sources: [
      [
        'Information de l’OFB',
        'https://ofb.gouv.fr/actualites/cyberattaque-visant-application-du-permis-de-chasser-ofb-informe-ses-usagers',
      ],
    ],
  },
  {
    id: 'urssaf-dpae-2026',
    date: '2026-01-19',
    administration: 'Urssaf',
    service: 'API de déclaration préalable à l’embauche',
    volume: '12 millions de salariés potentiellement concernés',
    status: 'Consultation frauduleuse',
    detail:
      'Le communiqué décrit des données consultées et potentiellement extraites via un compte partenaire compromis. Il précise que les systèmes d’information de l’Urssaf n’ont pas eux-mêmes été compromis.',
    sources: [
      [
        'Communiqué de l’Urssaf',
        'https://www.urssaf.org/accueil/espace-medias/communiques-et-dossiers-de-press/communiques-de-presse/2026/l-urssaf-appelle-a-la-vigilance-.html',
      ],
    ],
  },
  {
    id: 'hubee-2026',
    date: '2026-01-16',
    administration: 'DINUM · DILA · DGCS · DGS · CNAF',
    service: 'HubEE',
    volume: 'Environ 70 000 dossiers · 160 000 documents',
    status: 'Extraction confirmée',
    detail:
      'Intrusion détectée le 9 janvier 2026 sur cette plateforme d’échange de documents administratifs. Certains documents contiennent des données personnelles. Les deux volumes décrivent le même incident et ne s’additionnent pas.',
    sources: [
      [
        'Communiqué de la DINUM',
        'https://www.numerique.gouv.fr/sinformer/espace-presse/incident-hubee/',
      ],
    ],
  },
  {
    id: 'sports-2025',
    date: '2025-12-19',
    administration:
      'Ministère des Sports, de la Jeunesse et de la Vie associative',
    service: 'Un système d’information du ministère',
    volume: '3,5 millions de foyers',
    status: 'Extraction confirmée',
    detail:
      'Le ministère annonce une exfiltration et l’information des foyers concernés. La publication retenue ne nomme pas l’application et ne donne aucun volume en octets.',
    sources: [
      [
        'Communiqué publié sur jeunes.gouv.fr',
        'https://www.jeunes.gouv.fr/exfiltration-de-donnees-provenant-d-un-des-systemes-d-information-du-ministere-3040',
      ],
    ],
  },
  {
    id: 'missions-locales-2025',
    date: '2025-12-01',
    administration: 'France Travail · réseau des Missions locales',
    service: 'Dossiers des jeunes accompagnés',
    volume: 'Environ 1,6 million de jeunes',
    status: 'Consultation confirmée',
    detail:
      'Le communiqué confirme la consultation de données et un risque de divulgation après le piratage d’un compte d’agent. Ce chiffre représente le périmètre annoncé, sans preuve de publication de tous les dossiers.',
    sources: [
      [
        'Communiqué de France Travail et des Missions locales',
        'https://www.francetravail.org/accueil/communiques/2025/le-reseau-des-missions-locales-et-france-travail-appellent-a-la-vigilance-apres-un-acte-de-cyber-malveillance.html?type=article',
      ],
    ],
  },
  {
    id: 'pajemploi-2025',
    date: '2025-11-17',
    administration: 'Urssaf',
    service: 'Pajemploi',
    volume: 'Jusqu’à 1,2 million de salariés',
    status: 'Vol de données confirmé',
    detail:
      'Acte constaté le 14 novembre 2025. Le périmètre potentiel concerne les salariés de particuliers employeurs. Les IBAN, les mots de passe, les courriels et les numéros de téléphone sont exclus par le communiqué.',
    sources: [
      [
        'Communiqué de l’Urssaf',
        'https://www.urssaf.org/accueil/espace-medias/communiques-et-dossiers-de-press/communiques-de-presse/2025/le-service-pajemploi%2C-gere-par-l.html',
      ],
    ],
  },
  {
    id: 'brest-2025',
    date: '2025-11-14',
    administration: 'Ville de Brest',
    service: 'Rendez-vous pour les titres d’identité',
    volume: 'Environ 50 000 lignes de contacts',
    status: 'Intrusion confirmée',
    detail:
      'La ville chiffre les lignes de contacts des usagers ayant demandé des titres d’identité depuis le 2 octobre 2023. Il s’agit de lignes de contacts, sans décompte publié de personnes uniques.',
    sources: [
      [
        'Information de la Ville de Brest',
        'https://brest.fr/actualites/fuite-de-donnees-personnelles-la-ville-de-brest-appelle-la-vigilance',
      ],
    ],
  },
  {
    id: 'lycees-hdf-2025',
    date: '2025-11-01',
    administration: 'Région et région académique Hauts-de-France',
    service: 'Système d’information des lycées publics',
    volume: 'Non précisé · perte ou captation en cours d’évaluation',
    status: 'Cyberattaque confirmée',
    detail:
      'Le point au 31 octobre décrit la restauration des outils administratifs. Il indique que l’enquête ne permet pas encore d’établir l’ampleur des données potentiellement perdues ou captées.',
    sources: [
      [
        'Communiqué de la Région Hauts-de-France',
        'https://www.hautsdefrance.fr/communique-de-presse-cyberattaque-contre-le-systeme-dinformation-des-lycees-en-hauts-de-france-point-de-situation-au-31-octobre-2025/',
      ],
    ],
  },
  {
    id: 'font-romeu-2025',
    date: '2025-09-11',
    administration: 'Ville de Font-Romeu-Odeillo-Via',
    service: 'Réseau informatique municipal',
    volume: 'Fuite non établie dans cette source',
    status: 'Cyberattaque confirmée',
    detail:
      'Le maire confirme l’attaque de la nuit du 7 septembre 2025 et un dépôt de plainte. Ce communiqué n’annonce ni extraction de données ni volume de fuite.',
    sources: [
      [
        'Communiqué du maire',
        'https://www.mairie-fontromeu.fr/cyberattaque-du-07-09-2025/',
      ],
    ],
  },
  {
    id: 'sante-regions-2025',
    date: '2025-09-08',
    administration: 'Services numériques de santé régionaux',
    service: 'Hauts-de-France · Normandie · Pays de la Loire',
    volume: 'Non précisé dans les trois communications',
    status: 'Accès illégitimes confirmés',
    detail:
      'Les ARS décrivent des accès frauduleux après usurpation de comptes de professionnels de santé. Les premières analyses portent sur des données d’identité ou administratives. Les trois communications sont regroupées pour cette séquence interrégionale.',
    sources: [
      [
        'Communiqué de l’ARS Normandie du 8 septembre',
        'https://www.normandie.ars.sante.fr/une-cyberattaque-dirigee-contre-des-services-numeriques-regionaux-de-sante',
      ],
      [
        'Communication de l’ARS Hauts-de-France',
        'https://www.hauts-de-france.ars.sante.fr/une-cyberattaque-dirigee-contre-les-donnees-didentite-des-patients-des-hopitaux-publics-de-la',
      ],
      [
        'Communication de l’ARS Pays de la Loire',
        'https://www.pays-de-la-loire.ars.sante.fr/une-cyberattaque-dirigee-contre-des-services-numeriques-regionaux-de-sante-0',
      ],
    ],
  },
];
