import { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { GoogleMark } from "../../src/components/GoogleMark";
import { useAuth } from "../../src/auth/AuthProvider";
import { ApiRequestError } from "../../src/api/client";
import { VideoBackground } from "../../src/components/VideoBackground";
import { media } from "../../src/media";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

/**
 * Mirrors the site's /auth page: the mobile futsal loop behind a barely-there
 * 20% scrim, and a translucent black card centred over it. The site keeps this
 * screen brighter than the others on purpose — the video is the welcome.
 */
export default function SignIn() {
  const { signIn, register } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (isRegistering) await register(email.trim(), password, fullName.trim());
      else await signIn(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.userMessage : "Could not sign in. Check your connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VideoBackground source={media.authVideo} overlayOpacity={0.2} />

      <Pressable
        onPress={() => router.replace("/(tabs)")}
        style={{
          position: "absolute",
          top: insets.top + spacing.md,
          left: spacing.lg,
          zIndex: 50,
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ArrowLeft size={16} color={colors.primary} />
        <Text style={{ ...type.body, color: colors.primary, fontWeight: "500" }}>Back home</Text>
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            padding: spacing.lg,
            paddingTop: insets.top + spacing.xl,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={{ uri: media.navLogo }}
            style={{ height: 74, width: 242, alignSelf: "center", marginBottom: spacing.xl }}
            resizeMode="contain"
          />

          {/* bg-black/30 + backdrop-blur on the web; RN has no blur without a
              native module, so a slightly deeper black carries the same weight. */}
          <View
            style={{
              backgroundColor: "rgba(0,0,0,0.55)",
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: radius.lg,
              padding: spacing.xl,
            }}
          >
            <Text style={{ ...type.display, fontSize: 24, color: colors.text, marginBottom: 4 }}>
              {isRegistering ? "Create account" : "Sign In"}
            </Text>
            <Text style={{ ...type.body, color: "rgba(255,255,255,0.8)", marginBottom: spacing.xl }}>
              {isRegistering
                ? "Join Paizeis and book your next match"
                : "Sign in to book pitches and manage your team"}
            </Text>

            {isRegistering && (
              <AuthField label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Andreas Georgiou" autoCapitalize="words" />
            )}
            <AuthField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <View style={{ marginBottom: spacing.lg }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Text style={{ ...type.label, color: colors.text, fontFamily: fonts.mono }}>PASSWORD</Text>
                {!isRegistering && (
                  <Pressable onPress={() => setError("Password reset is coming shortly — contact us meanwhile.")}>
                    <Text style={{ ...type.caption, fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Forgot password?</Text>
                  </Pressable>
                )}
              </View>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{
                  backgroundColor: "rgba(0,0,0,0.45)",
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: 13,
                  color: colors.text,
                  fontSize: 16,
                }}
              />
            </View>

            {error && (
              <Text style={{ ...type.body, color: colors.danger, marginBottom: spacing.md }}>{error}</Text>
            )}

            <Pressable
              onPress={submit}
              disabled={busy || !email || !password || (isRegistering && !fullName)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                borderRadius: radius.md,
                paddingVertical: 14,
                alignItems: "center",
                opacity: busy || !email || !password ? 0.5 : 1,
              })}
            >
              <Text style={{ ...type.heading, color: colors.primaryForeground, fontFamily: fonts.mono }}>
                {busy ? "…" : isRegistering ? "Sign Up" : "Sign In"}
              </Text>
            </Pressable>

            {!isRegistering && (
              <Pressable
                onPress={() => setError("Venue manager sign-in is on the web for now.")}
                style={{
                  marginTop: spacing.sm,
                  borderColor: "rgba(255,255,255,0.25)",
                  borderWidth: 1,
                  backgroundColor: "rgba(17,17,17,0.8)",
                  borderRadius: radius.md,
                  paddingVertical: 12,
                  alignItems: "center",
                }}
              >
                <Text style={{ ...type.body, color: colors.text, fontFamily: fonts.mono }}>Sign in as Venue Manager</Text>
              </Pressable>
            )}

            {/* "OR CONTINUE WITH" rule, as on the site. */}
            <View style={{ flexDirection: "row", alignItems: "center", marginVertical: spacing.lg, gap: spacing.md }}>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
              <Text style={{ ...type.caption, fontSize: 10, letterSpacing: 1, color: "rgba(255,255,255,0.7)" }}>
                OR CONTINUE WITH
              </Text>
              <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" }} />
            </View>

            <Pressable
              onPress={() => setError("Google Sign-In needs its client id configured before it will work here.")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
                borderColor: "rgba(255,255,255,0.25)",
                borderWidth: 1,
                backgroundColor: "rgba(17,17,17,0.8)",
                borderRadius: radius.md,
                paddingVertical: 12,
              }}
            >
              <GoogleMark size={16} color={colors.text} />
              <Text style={{ ...type.body, color: colors.text, fontFamily: fonts.mono }}>Sign in with Google</Text>
            </Pressable>

            <Pressable onPress={() => { setIsRegistering(!isRegistering); setError(null); }} style={{ marginTop: spacing.lg }}>
              <Text style={{ ...type.body, color: "rgba(255,255,255,0.8)", textAlign: "center" }}>
                {isRegistering ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function AuthField({ label, ...input }: TextInputProps & { label: string }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...type.label, color: colors.text, fontFamily: fonts.mono, marginBottom: 6 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        placeholderTextColor="rgba(255,255,255,0.4)"
        {...input}
        style={{
          backgroundColor: "rgba(0,0,0,0.45)",
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 13,
          color: colors.text,
          fontSize: 16,
        }}
      />
    </View>
  );
}
