// app/src/screens/AskMom/components/ImagePreviewModal.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { Modal, Pressable, StatusBar, StyleSheet, View } from "react-native";
import ImageViewer from "react-native-image-zoom-viewer";

export default function ImagePreviewModal({
  open,
  uri,
  onClose,
}: {
  open: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const images = useMemo(() => {
    return uri ? [{ url: uri }] : [];
  }, [uri]);

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      {/* Hide status bar for that “ChatGPT full-screen” feel */}
      <StatusBar hidden />

      <View style={styles.container}>
        <ImageViewer
          imageUrls={images}
          enableSwipeDown
          onSwipeDown={onClose}
          onCancel={onClose}
          saveToLocalByLongPress={false}
          backgroundColor="#000000"
          renderIndicator={() => <View />} // no "1/1"
          renderHeader={() => (
            <View style={styles.header}>
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
          )}
        />

        {/* Extra: tap outside header area doesn't close (ChatGPT-style) */}
        <Pressable style={StyleSheet.absoluteFill} pointerEvents="none" />
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
    paddingTop: 54,
    paddingHorizontal: 16,
    zIndex: 10,
    pointerEvents: "box-none",
  },
  closeBtn: {
    alignSelf: "flex-start",
    height: 42,
    width: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
});
