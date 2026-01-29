// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-reanimated";

import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from "@expo-google-fonts/atkinson-hyperlegible";

import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from "@expo-google-fonts/nunito";

import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";

import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";

import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_700Bold,
} from "@expo-google-fonts/quicksand";

import { VarelaRound_400Regular } from "@expo-google-fonts/varela-round";

import {
  BricolageGrotesque_400Regular,
  BricolageGrotesque_500Medium,
  BricolageGrotesque_700Bold,
} from "@expo-google-fonts/bricolage-grotesque";

import {
  ComicNeue_400Regular,
  ComicNeue_700Bold,
} from "@expo-google-fonts/comic-neue";

import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";

import { AuthProvider } from "./src/auth/AuthProvider";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    // Atkinson (current)
    "Atkinson-Regular": AtkinsonHyperlegible_400Regular,
    "Atkinson-Medium": AtkinsonHyperlegible_700Bold, // intentional mapping
    "Atkinson-Bold": AtkinsonHyperlegible_700Bold,

    // Nunito
    "Nunito-Regular": Nunito_400Regular,
    "Nunito-Medium": Nunito_600SemiBold,
    "Nunito-Bold": Nunito_700Bold,

    // DM Sans
    "DMSans-Regular": DMSans_400Regular,
    "DMSans-Medium": DMSans_500Medium,
    "DMSans-Bold": DMSans_700Bold,

    // Manrope
    "Manrope-Regular": Manrope_400Regular,
    "Manrope-Medium": Manrope_500Medium,
    "Manrope-Bold": Manrope_700Bold,

    // Quicksand
    "Quicksand-Regular": Quicksand_400Regular,
    "Quicksand-Medium": Quicksand_500Medium,
    "Quicksand-Bold": Quicksand_700Bold,

    // Varela Round (single weight)
    "VarelaRound-Regular": VarelaRound_400Regular,
    "VarelaRound-Medium": VarelaRound_400Regular,
    "VarelaRound-Bold": VarelaRound_400Regular,

    // Bricolage Grotesque
    "BricolageGrotesque-Regular": BricolageGrotesque_400Regular,
    "BricolageGrotesque-Medium": BricolageGrotesque_500Medium,
    "BricolageGrotesque-Bold": BricolageGrotesque_700Bold,

    // Comic Neue (limited weights)
    "ComicNeue-Regular": ComicNeue_400Regular,
    "ComicNeue-Medium": ComicNeue_400Regular,
    "ComicNeue-Bold": ComicNeue_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
