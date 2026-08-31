import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";
import { media } from "../media";
import { NavMenu } from "./NavMenu";
import { colors, spacing } from "../theme";

/**
 * The site's fixed top bar, on every screen: wordmark on the left, the pixel
 * play-button menu glyph on the right.
 *
 * Screens using this set `headerShown: false` — a native header stacked above
 * it produced two bars and wasted 100px of a phone screen.
 */
export function Navbar({ showBack }: { showBack?: boolean }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: "rgba(0,0,0,0.92)",
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View
        style={{
          height: 60,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingLeft: showBack ? spacing.xs : spacing.md,
          paddingRight: spacing.lg,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
          {showBack && (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <ChevronLeft size={26} color={colors.primary} />
            </Pressable>
          )}
          <Pressable onPress={() => router.push("/(tabs)")} hitSlop={8}>
            {/* 924×283 source, so these keep its natural proportions. */}
            <Image source={{ uri: media.navLogo }} style={{ height: 42, width: 137 }} resizeMode="contain" />
          </Pressable>
        </View>

        <Pressable onPress={() => setMenuOpen(true)} hitSlop={14}>
          <Image source={{ uri: media.menuIcon }} style={{ height: 34, width: 34 }} resizeMode="contain" />
        </Pressable>
      </View>

      <NavMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
