import { StyleSheet, View } from "react-native";
import { colors } from "../theme";

/**
 * Web stand-in. expo-video renders fine in a browser, but the preview exists
 * for layout checks and a 33 MB autoplaying loop is not worth it there — the
 * scrim colour alone keeps the composition honest.
 */
export function VideoBackground({ overlayOpacity = 0.6 }: { source: string; overlayOpacity?: number }) {
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: Math.max(overlayOpacity, 0.85) }]}
      pointerEvents="none"
    />
  );
}
