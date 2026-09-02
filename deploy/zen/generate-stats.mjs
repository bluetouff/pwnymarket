import { spawnSync } from 'node:child_process';
import {
  constants,
  closeSync,
  fsyncSync,
  openSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLogs, LOG_DIRECTORY, REPORT_DIRECTORY } from './stats-data.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ],
  );
const integer = (value) => {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid GoAccess counter');
  return value.toLocaleString('fr-FR');
};
export function renderReport(report, capped, now = new Date()) {
  const general = report?.general;
  if (!general || general.failed_requests !== 0)
    throw new Error('GoAccess rejected statistics');
  const tables = [
    ['requests', 'Pages et API'],
    ['static_requests', 'Ressources statiques'],
    ['not_found', 'Routes introuvables'],
    ['status_codes', 'Réponses HTTP'],
  ];
  const body = tables
    .map(([key, title]) => {
      const rows = report[key]?.data;
      if (!Array.isArray(rows)) throw new Error('Missing GoAccess panel');
      return (
        '<h2>' +
        title +
        '</h2><table><thead><tr><th scope="col">Catégorie</th><th scope="col">Requêtes</th><th scope="col">Octets</th></tr></thead><tbody>' +
        rows
          .map(
            (row) =>
              '<tr><td>' +
              escape(row.data) +
              '</td><td>' +
              integer(row.hits?.count) +
              '</td><td>' +
              integer(row.bytes?.count) +
              '</td></tr>',
          )
          .join('') +
        '</tbody></table>'
      );
    })
    .join('');
  return page(
    '<h1>Le trafic, sans le pistage.</h1><p>Rapport privé produit par GoAccess. Actualisé le ' +
      escape(now.toISOString()) +
      ' (UTC).</p>' +
      '<p><strong>' +
      integer(general.valid_requests) +
      ' requêtes · ' +
      integer(general.bandwidth) +
      ' octets</strong></p>' +
      '<p>Au maximum 14 jours calendaires UTC. Requêtes de robots comprises. Aucun visiteur unique, pays, navigateur ou référent mesuré. Les chemins inconnus sont regroupés dans /other.</p>' +
      (capped
        ? '<p role="alert"><strong>Période incomplète : un plafond journalier de collecte a été atteint. Ces totaux sont des minima.</strong></p>'
        : '') +
      body,
  );
}
function page(body) {
  return (
    '<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>Statistiques privées · PwnyMarket</title><link rel="stylesheet" href="/assets/v2/styles.css"></head><body><main class="prose">' +
    body +
    '<p><a href="/">Retour aux non-marchés</a></p></main></body></html>'
  );
}
function publish(html) {
  const temporary = join(REPORT_DIRECTORY, 'index.html.next');
  const fd = openSync(
    temporary,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_TRUNC |
      constants.O_NOFOLLOW,
    0o640,
  );
  try {
    writeFileSync(fd, html);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  renameSync(temporary, join(REPORT_DIRECTORY, 'index.html'));
}
export function generate() {
  const { input, capped } = collectLogs(LOG_DIRECTORY);
  if (!input) {
    publish(
      page(
        '<h1>Pas encore de requêtes à compter.</h1><p>Aucune donnée inventée. Prochain rapport dans quinze minutes au plus.</p>',
      ),
    );
    return;
  }
  const result = spawnSync(
    '/usr/bin/goaccess',
    [
      '-',
      '--no-global-config',
      '--log-format=%h [%d %t] %s %b %U',
      '--date-format=%Y-%m-%d',
      '--time-format=%H:%M:%S',
      '--no-progress',
      '--no-parsing-spinner',
      '--no-term-resolver',
      '-o',
      'json',
    ],
    { input, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 },
  );
  if (result.status !== 0 || result.error) throw new Error('GoAccess failed');
  publish(renderReport(JSON.parse(result.stdout), capped));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    generate();
  } catch {
    // Replace a stale report with an explicit unavailable state, never fabricated figures.
    publish(
      page(
        '<h1>Statistiques indisponibles.</h1><p>La génération a échoué. Aucun résultat de secours n’est affiché.</p>',
      ),
    );
    process.stderr.write('PwnyMarket statistics generation failed\n');
    process.exitCode = 1;
  }
}
