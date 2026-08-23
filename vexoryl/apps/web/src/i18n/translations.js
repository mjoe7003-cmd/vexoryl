export const dictionaries = {
  en: { wallet: 'Wallet balance', liveNow: 'Live now', watching: 'watching', live: 'LIVE', unavailable: 'Live session unavailable', gifts: 'Send a gift', director: 'Director Mode pool', contribute: 'Contribute' },
  fr: { wallet: 'Solde du portefeuille', liveNow: 'En direct', watching: 'spectateurs', live: 'EN DIRECT', unavailable: 'Session en direct indisponible', gifts: 'Envoyer un cadeau', director: 'Pool du mode réalisateur', contribute: 'Contribuer' },
  es: { wallet: 'Saldo de cartera', liveNow: 'En directo', watching: 'viendo', live: 'EN DIRECTO', unavailable: 'Sesión en directo no disponible', gifts: 'Enviar un regalo', director: 'Bote del modo director', contribute: 'Contribuir' },
};

export function verifyTranslations() {
  const locales = Object.keys(dictionaries);
  const keys = Object.keys(dictionaries.en);
  const complete = locales.every((locale) => keys.every((key) => typeof dictionaries[locale][key] === 'string'));
  if (!complete) throw new Error('A locale dictionary is missing a required translation');
  return { locales, keys, complete };
}
