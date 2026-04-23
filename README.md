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

Create `.env` in project root if you want AI interpretation.

### Google Gemini (no local model download)

```env
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash
```

### Ollama (local model)

```env
OLLAMA_HOST=http://127.0.0.1:11434
OLLAMA_MODEL=llava
```

If both are set, the project prefers Gemini for `/api/ocr-interpret`.

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

