import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { FONT } from "../theme";
import { formatPhoneNumber } from "../utils/phoneFormatter";

const BRAND = {
  border: "#D7DEE8",
  text: "#0B1220",
  muted: "#667085",
  inputBg: "#FFFFFF",
  danger: "#D92D20",
};

type Props = {
  value: string;
  onChange: (val: string) => void;
  error?: string | null;
};

export default function PhoneInput({ value, onChange, error }: Props) {
  const handleChange = (text: string) => {
    onChange(formatPhoneNumber(text));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Phone Number</Text>
      <Text style={styles.helper}>
        We’ll use this for account setup and verification.
      </Text>

      <TextInput
        value={value}
        onChangeText={handleChange}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="(555) 123-4567"
        placeholderTextColor="#98A2B3"
        maxLength={14}
        style={[styles.input, error ? styles.inputError : null]}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  label: {
    fontSize: 13,
    color: BRAND.text,
    fontFamily: FONT.medium,
    marginBottom: 6,
  },
  helper: {
    color: BRAND.muted,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: FONT.regular,
    marginBottom: 8,
  },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: BRAND.border,
    backgroundColor: BRAND.inputBg,
    color: BRAND.text,
    paddingHorizontal: 16,
    borderRadius: 18,
    fontSize: 16,
    fontFamily: FONT.regular,
  },
  inputError: {
    borderColor: BRAND.danger,
  },
  error: {
    color: BRAND.danger,
    marginTop: 8,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: FONT.medium,
  },
});