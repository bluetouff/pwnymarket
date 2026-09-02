import { renderShareIcon } from './share-icons.mjs';

const pages = new Map([
  ['/', 'PwnyMarket.fr · Liberté. Égalité. Données éparpillées.'],
  ['/about', 'Le grand n’importe quoi · PwnyMarket.fr'],
  ['/privacy', 'Confidentialité · PwnyMarket.fr'],
  ['/archives', 'Marchés achevés · PwnyMarket.fr'],
  ['/404', 'CAC 404 · Page introuvable · PwnyMarket.fr'],
]);

function escapeAttribute(value) {
  return value.replace(/[&<>"']/g, (character) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[character];
  });
}

// Only fixed public routes are shared. Never use the request URL, host, or state.
export function renderShareLinks(path) {
  const route = path === '/index.html' ? '/' : path;
  const title = pages.get(route);
  if (!title) throw new TypeError('Unknown share page');
  const url = 'https://pwnymarket.fr' + route;
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const links = [
    [
      'x',
      'X',
      `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    ],
    [
      'bluesky',
      'Bluesky',
      `https://bsky.app/intent/compose?text=${encodeURIComponent(title + '\n' + url)}`,
    ],
    [
      'linkedin',
      'LinkedIn',
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    ],
    [
      'facebook',
      'Facebook',
      `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    ],
  ];
  const socialLinks = links
    .map(
      ([icon, name, href]) =>
        `<a class="share-link share-${icon}" href="${escapeAttribute(href)}" target="_blank" rel="noopener noreferrer" referrerpolicy="no-referrer" aria-label="Partager sur ${name} (nouvel onglet)">${renderShareIcon(icon)}<span class="share-tooltip" aria-hidden="true">${name}</span></a>`,
    )
    .join('');
  const mailto = `mailto:?subject=${encodedTitle}&body=${encodeURIComponent(title + '\r\n\r\n' + url)}`;
  return `<aside class="share-bar" aria-label="Partager cette page"><p>Partager</p><nav class="share-links" aria-label="Liens de partage">${socialLinks}<a class="share-link share-email" href="${escapeAttribute(mailto)}" aria-label="Envoyer par email (ouvre votre messagerie)">${renderShareIcon('email')}<span class="share-tooltip" aria-hidden="true">Envoyer par email</span></a></nav></aside>`;
}
