/**
 * F-818: `app.json` is the config; this only adds what depends on the EAS build profile (`APP_VARIANT`, set in eas.json).
 * The `device` profile talks to a developer machine over the LAN (plain http), so only that APK may use cleartext
 * traffic — preview and production builds keep Android's default (https only).
 */
module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins ?? []),
    ['expo-build-properties', { android: { usesCleartextTraffic: process.env.APP_VARIANT === 'device' } }],
  ],
});
