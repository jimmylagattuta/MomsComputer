// app/src/screens/AskMom/components/ImagePreviewModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
    Modal,
    Platform,
    Pressable,
    StatusBar,
    StyleSheet,
    View,
} from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ImagePreviewModal({
  open,
  uri,
  onClose,
}: {
  open: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [showChrome, setShowChrome] = useState(true);

  const images = useMemo(() => {
    return uri ? [{ url: uri }] : [];
  }, [uri]);

  // When opening a new image, ensure chrome starts visible
  React.useEffect(() => {
    if (open) setShowChrome(true);
  }, [open, uri]);

  return (
    <Modal
      visible={open}
      // ✅ key change: NOT transparent so it truly covers the whole screen
      transparent={false}
      animationType="fade"
      // ✅ iOS: force full screen presentation
      presentationStyle="fullScreen"
      // ✅ Android: lets content draw behind status bar when hidden
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* ✅ ChatGPT feel: hide status bar while viewing */}
      <StatusBar
        hidden={open}
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />

      <View style={styles.container}>
        <ImageViewer
          imageUrls={images}
          backgroundColor="#000000"
          saveToLocalByLongPress={false}
          enableSwipeDown
          onSwipeDown={onClose}
          onCancel={onClose}
          // ✅ no "1 / 1" indicator
          renderIndicator={() => <View />}
          // ✅ tap toggles the top chrome (like ChatGPT)
          onClick={() => setShowChrome((v) => !v)}
          // ✅ double tap zoom
          enableImageZoom
          // viewer uses its own internal zoom; this flag makes taps/gestures work well
          // (kept default behavior, but explicitly enabled above)
          renderHeader={() =>
            showChrome ? (
              <View
                style={[
                  styles.header,
                  { paddingTop: Math.max(insets.top, Platform.OS === "android" ? 10 : 0) },
                ]}
                pointerEvents="box-none"
              >
                <Pressable
                  onPress={onClose}
                  hitSlop={12}
                  style={({ pressed }) => [
                    styles.closeBtn,
                    pressed ? { opacity: 0.9, transform: [{ scale: 0.99 }] } : null,
                  ]}
                >
                  <Ionicons name="close" size={22} color="#FFFFFF" />
                </Pressable>
              </View>
            ) : (
              <View />
            )
          }
        />

        {/* Optional: a subtle top fade when chrome is visible */}
        {showChrome ? (
          <View
            pointerEvents="none"
            style={[
              styles.topFade,
              { height: Math.max(insets.top + 70, 90) },
            ]}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },

  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },

  closeBtn: {
    height: 42,
    width: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },

  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    // simple fade overlay (no gradient dependency)
    backgroundColor: "rgba(0,0,0,0.22)",
  },
});
