import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useAuth } from "../auth/AuthProvider";
import { media } from "../media";
import { colors, fonts, radius, spacing, type } from "../theme";

/**
 * The site's slide-down navigation, opened by the pixel play-button glyph.
 *
 * The web navbar builds its links from who is signed in — a visitor gets only
 * Sign In, a player gets Home / Venues / My Team, an admin gets the management
 * screens. Same rule here.
 */
export function NavMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const go = (path: string) => {
    onClose();
    router.push(path as never);
  };

  const links = user
    ? [
        { label: "Home", path: "/(tabs)" },
        { label: "Venues", path: "/(tabs)/venues" },
        { label: "My Bookings", path: "/(tabs)/bookings" },
        { label: "Profile", path: "/(tabs)/profile" },
      ]
    : [
        { label: "Home", path: "/(tabs)" },
        { label: "Venues", path: "/(tabs)/venues" },
      ];

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }} onPress={onClose}>
        {/* Stop taps inside the sheet from closing it. */}
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={{
            paddingTop: insets.top + spacing.md,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
            backgroundColor: "#000000",
            borderBottomColor: colors.border,
            borderBottomWidth: 1,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
            <Image source={{ uri: media.navLogo }} style={{ height: 44, width: 144 }} resizeMode="contain" />
            <Pressable onPress={onClose} hitSlop={14}>
              <X size={26} color={colors.primary} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 360 }}>
            {links.map((link) => (
              <Pressable
                key={link.path}
                onPress={() => go(link.path)}
                style={({ pressed }) => ({
                  paddingVertical: spacing.lg,
                  borderBottomColor: "rgba(255,255,255,0.08)",
                  borderBottomWidth: 1,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text style={{ ...type.heading, fontSize: 17, fontFamily: fonts.mono, color: colors.text }}>
                  {link.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={{ marginTop: spacing.lg }}>
            {user ? (
              <Pressable
                onPress={async () => { onClose(); await signOut(); }}
                style={{ borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: colors.text }}>
                  Sign Out
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => go("/(auth)/sign-in")}
                style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" }}
              >
                <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: colors.primaryForeground }}>
                  Sign In
                </Text>
              </Pressable>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
