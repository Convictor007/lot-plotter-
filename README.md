# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Requirements

Install these first:

- [Node.js](https://nodejs.org/) (LTS recommended, includes `npm`)
- [Git](https://git-scm.com/downloads)
- One way to run the app:
  - [Expo Go](https://expo.dev/go) on Android/iOS, or
  - [Android Studio](https://developer.android.com/studio) (for Android emulator)

Optional (OCR AI interpretation):

- [Ollama](https://ollama.com/) + a vision model (for local OCR interpretation), or
- Google Gemini API key (`GEMINI_API_KEY`) in `.env`

## Dependencies

This project uses npm dependencies declared in `package.json`.

- Install all project dependencies with:

  ```bash
  npm install
  ```

- If you need to install/update specific packages manually:

  ```bash
  npm install @react-native-async-storage/async-storage
  npx expo install expo-image-picker expo-document-picker
  ```

- Main runtime dependencies include:
  - `expo`, `react`, `react-native`, `expo-router`
  - `expo-image-picker`, `expo-document-picker`
  - `react-native-webview`, `react-native-gesture-handler`, `react-native-reanimated`
  - `@react-native-async-storage/async-storage`
  - `tesseract.js` (OCR)

- Dev dependencies include:
  - `typescript`
  - `eslint`, `eslint-config-expo`
  - type packages such as `@types/react`

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
