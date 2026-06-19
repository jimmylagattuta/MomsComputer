export default {
  expo: {
    name: "moms-computer",
    slug: "moms-computer",
    version: "1.0.4",
    orientation: "portrait",
    icon: "./assets/images/icon-v3.png",
    scheme: "momscomputer",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,

    ios: {
      bundleIdentifier: "com.momscomputer.app",
      supportsTablet: true,
      icon: "./assets/images/icon-v3.png",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,

        NSCameraUsageDescription:
          "Mom's Computer uses the camera so you can take a photo of a suspicious email, text message, pop-up, letter, or computer screen and send it to Ask Mom for scam-safety guidance.",

        NSPhotoLibraryUsageDescription:
          "Mom's Computer uses your photo library so you can choose a screenshot or photo of a suspicious message, email, website, pop-up, or document and send it to Ask Mom for scam-safety guidance.",

        NSPhotoLibraryAddUsageDescription:
          "Mom's Computer may save a copy of a scam-related screenshot or image only if you choose to save it from a support conversation.",
      },
    },

    android: {
      package: "com.momscomputer.app",
      googleServicesFile: "./google-services.json",

      // IMPORTANT:
      // Keep Android in normal resize mode so chat inputs can sit above the keyboard.
      // Edge-to-edge can make the app draw behind system/nav/keyboard areas and break this.
      edgeToEdgeEnabled: false,

      predictiveBackGestureEnabled: false,
      softwareKeyboardLayoutMode: "resize",

      adaptiveIcon: {
        foregroundImage: "./assets/images/android-icon-foreground-v3.png",
        backgroundColor: "#E6F4FE",
        monochromeImage: "./assets/images/android-icon-monochrome.png",
      },
    },

    web: {
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],
      "expo-secure-store",
      "expo-font",
      "expo-notifications",
      "expo-dev-client",
      "expo-web-browser",
    ],

    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },

    extra: {
      router: {},
      eas: {
        projectId: "b2becdec-951d-42de-a6b8-c0d897f7375d",
      },
      revenuecat: {
        iosApiKey: process.env.REVENUECAT_IOS_API_KEY,
        androidApiKey: process.env.REVENUECAT_ANDROID_API_KEY,
      },
    },

    owner: "jimmylagattuta",
  },
};