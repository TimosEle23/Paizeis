import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth/AuthProvider";
import { VideoBackground } from "../../src/components/VideoBackground";
import { Navbar } from "../../src/components/Navbar";
import { media } from "../../src/media";
import { colors, fonts, spacing, type } from "../../src/theme";

/**
 * The site's home page, as it renders on a phone: the portrait futsal loop at
 * full bleed under a 60% black scrim, the round Paizeis badge as the single
 * call to action sitting low on the screen, and the copyright footer.
 *
 * Deliberately sparse — the web page has no cards, no stats, no menu. Adding
 * any would make the app a different product from the site.
 */
export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VideoBackground source={media.homeVideo} overlayOpacity={0.6} />

      <Navbar />

      <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: spacing.xxl * 2 }}>
        <Pressable
          onPress={() => router.push(user ? "/(tabs)/venues" : "/(auth)/sign-in")}
          style={({ pressed }) => ({
            transform: [{ translateY: pressed ? 2 : 0 }],
            borderRadius: 999,
            overflow: "hidden",
            borderWidth: 2,
            borderColor: "rgba(99,122,36,0.4)",
            // The web card carries a heavy olive glow; shadow is the closest
            // equivalent React Native gives us.
            shadowColor: colors.primary,
            shadowOpacity: 0.7,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 12,
          })}
        >
          <Image
            source={{ uri: media.roundLogo }}
            style={{ width: 136, height: 136, backgroundColor: colors.background }}
            resizeMode="cover"
          />
        </Pressable>
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingVertical: spacing.lg,
          paddingBottom: insets.bottom + spacing.md,
          alignItems: "center",
          backgroundColor: "rgba(0,0,0,0.75)",
        }}
      >
        <Text style={{ ...type.caption, color: "rgba(255,255,255,0.8)", fontFamily: fonts.mono }}>
          © 2026 Pezeis. All rights reserved.
        </Text>
      </View>
    </View>
  );
}
