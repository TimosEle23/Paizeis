import { Linking, Pressable, Text, View } from "react-native";
import { colors, fonts, radius, spacing, type } from "../theme";

/**
 * Web stand-in for the native map.
 *
 * react-native-maps ships no web build, so on web this shows the location and
 * opens the real map in a new tab instead. The browser view exists for a quick
 * look during development; the phone gets the real thing.
 */
export function VenueMap({
  latitude, longitude, title,
}: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={{
        height: 180,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceRaised,
        alignItems: "center",
        justifyContent: "center",
        gap: spacing.sm,
      }}
    >
      <Text style={{ fontSize: 28 }}>📍</Text>
      <Text style={{ ...type.body, color: colors.text }}>{title}</Text>
      <Text style={{ ...type.caption, color: colors.textMuted, fontFamily: fonts.mono }}>
        {latitude.toFixed(4)}, {longitude.toFixed(4)}
      </Text>
      <Text style={{ ...type.caption, color: colors.primary }}>Open in Maps →</Text>
    </Pressable>
  );
}
