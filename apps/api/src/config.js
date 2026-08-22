export const config = Object.freeze({
  region: process.env.VERCEL_REGION || process.env.APP_REGION || 'local',
  defaultLocale: process.env.DEFAULT_LOCALE || 'en',
  supportedLocales: (process.env.SUPPORTED_LOCALES || 'en,fr,es').split(',').map((locale) => locale.trim()).filter(Boolean),
  payoutRails: (process.env.PAYOUT_RAILS || 'crypto,mobile_money,paypal').split(',').map((rail) => rail.trim()).filter(Boolean),
  moderationApiUrl: process.env.MODERATION_API_URL || '',
  moderationApiKey: process.env.MODERATION_API_KEY || '',
  moderationBlockThreshold: process.env.MODERATION_BLOCK_THRESHOLD || 'high',
});