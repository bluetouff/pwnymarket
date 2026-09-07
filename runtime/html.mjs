export function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character],
  );
}

export const PUBLIC_ORIGIN = 'https://pwnymarket.fr';

export function marketPath(market) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(market.id))
    throw new TypeError('Invalid market identifier');
  return '/m/' + market.id;
}
