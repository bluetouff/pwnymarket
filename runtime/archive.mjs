import { ARCHIVES } from './archive-data.mjs';

const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );

export function renderArchives(records = ARCHIVES) {
  return [2026, 2025]
    .map((year) => {
      const entries = records
        .filter((item) => item.date.startsWith(String(year)))
        .toSorted((a, b) => b.date.localeCompare(a.date));
      return `<section class="archive-year" id="annee-${year}" aria-labelledby="titre-${year}">
<div class="section-heading"><h2 id="titre-${year}">${year}</h2><span class="market-count">${entries.length} dossiers documentés</span></div>
<ol class="archive-list">${entries
        .map((item) => {
          const sources = item.sources
            .map(([label, href]) => {
              const url = new URL(href);
              if (url.protocol !== 'https:' || url.username || url.password)
                throw new Error('Unsafe archive source');
              return `<a href="${escape(href)}">${escape(label)} ↗</a>`;
            })
            .join('');
          const date = new Intl.DateTimeFormat('fr-FR', {
            dateStyle: 'long',
            timeZone: 'UTC',
          }).format(new Date(item.date));
          return `<li id="${escape(item.id)}" class="archive-entry">
<div class="archive-info"><p class="archive-date">Communication du <time datetime="${escape(item.date)}">${date}</time></p>
<h3>${escape(item.administration)}</h3><p class="archive-service">${escape(item.service)}</p>
<p class="archive-detail">${escape(item.detail)}</p><nav class="archive-sources" aria-label="Sources pour ${escape(item.administration)}">${sources}</nav></div>
<div class="archive-volume"><span>Volume annoncé</span><strong>${escape(item.volume)}</strong><small>${escape(item.status)}</small></div>
</li>`;
        })
        .join('')}</ol></section>`;
    })
    .join('');
}
