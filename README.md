# iAssess (Lot Plotter)

iAssess is an Expo React Native app for plotting lot boundaries from:
- manual bearing/distance input
- CSV upload
- OCR image scan (with validation)

---

## 1) Requirements

Install these first:

- [Node.js](https://nodejs.org/) (LTS recommended, includes `npm`)
- [Git](https://git-scm.com/downloads)
- One runtime option:
  - [Expo Go](https://expo.dev/go) on Android/iOS
  - [Android Studio Emulator](https://developer.android.com/studio)

---

## 2) Project Setup

From project root:

```bash
npm install
```

Start development server:

```bash
npx expo start
```

Useful scripts:

```bash
npm run android
npm run ios
npm run web
npm run lint
```

---

## 3) OCR Modes

This project supports two OCR interpretation modes:

### A) Tesseract (default fallback)
- Route: `/api/ocr`
- Local OCR + parsing + validation
- No external API key required

### B) AI Vision Interpretation (recommended for noisy photos)
- Route: `/api/ocr-interpret`
- Uses Google Gemini (if configured), otherwise Ollama (if configured)

Priority:
1. `/api/ocr-interpret`
2. fallback to `/api/ocr`

---

## 4) Environment Variables

Create `.env` in project root.

Use this template (email-related variables intentionally excluded):

```env
# --------------------------------------------------------------------
# Database / Auth
# --------------------------------------------------------------------
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=iassess

# Optional: single DSN alternative to MYSQL_* variables
# DATABASE_URL=mysql://root:@127.0.0.1:3306/iassess

JWT_SECRET=replace_with_a_long_random_secret

# Optional defaults used when social auth creates a new user
AUTH_DEFAULT_MUNICIPALITY=Balatan
AUTH_DEFAULT_PROVINCE=Camarines Sur

# --------------------------------------------------------------------
# Map / GIS
# --------------------------------------------------------------------
MAPBOX_ACCESS_TOKEN=your_mapbox_token
MAPBOX_STYLE_URL=mapbox://styles/mapbox/streets-v11
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Client-exposed map config (Expo/Metro)
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_token
EXPO_PUBLIC_MAPBOX_STYLE_URL=mapbox://styles/mapbox/streets-v11
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# --------------------------------------------------------------------
# Google / Facebook Auth
# --------------------------------------------------------------------
# Google OAuth client IDs
GOOGLE_CLIENT_ID=your_google_web_client_id
GOOGLE_WEB_CLIENT_ID=your_google_web_client_id
GOOGLE_ANDROID_CLIENT_ID=your_google_android_client_id
GOOGLE_IOS_CLIENT_ID=your_google_ios_client_id

# Client-exposed Google IDs (used by Expo app)
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your_google_web_client_id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_google_web_client_id

# Facebook OAuth app ID (client-exposed)
EXPO_PUBLIC_FACEBOOK_APP_ID=your_facebook_app_id

# --------------------------------------------------------------------
# OCR / AI
# --------------------------------------------------------------------
EXPO_PUBLIC_OCR_SPACE_API_KEY=your_ocr_space_api_key
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash

# Optional local-model fallback
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llava
```

Notes:
- If both Gemini and Ollama are configured, `/api/ocr-interpret` prefers Gemini.
- `EXPO_PUBLIC_*` values are bundled into the client app; keep secrets out of those keys.
- Keep `.env` local and never commit it.

---

## 5) Notes for Scanning Accuracy

For better extraction:
- fill the frame with the bearing table
- use good lighting
- avoid motion blur
- keep camera parallel to the paper

If OCR output is still wrong, use CSV upload for exact values.

---

## 6) Security Notes

- `.env` is ignored by git and should never be pushed.
- Review extracted values before plotting/final use.

