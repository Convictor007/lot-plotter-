/**
 * Loads GOOGLE_MAPS_* from .env into expo.extra.
 * Also mirrors to EXPO_PUBLIC_* when unset so Metro inlines them for web
 * (Constants.expoConfig.extra is often empty on web; EXPO_PUBLIC_* is reliable).
 * @see https://docs.expo.dev/guides/environment-variables/
 */
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
  quiet: true,
});

const appJson = require('./app.json');

function stripQuotes(v) {
  if (v == null || v === '') return '';
  const s = String(v).trim();
  return s.replace(/^['"]|['"]$/g, '');
}

const googleMapsApiKey = stripQuotes(process.env.GOOGLE_MAPS_API_KEY);

// Metro bundles EXPO_PUBLIC_* for client JS (required for web map keys).
if (googleMapsApiKey && !process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = googleMapsApiKey;
}

module.exports = {
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo?.extra || {}),
      googleMapsApiKey,
      eas: {
        projectId: '1f8d11ba-337b-4ecf-8836-0dc14ba4c605',
      },
    },
  },
};
