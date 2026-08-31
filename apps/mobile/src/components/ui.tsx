import { ActivityIndicator, Pressable, Text, TextInput, View, type TextInputProps, type ViewStyle } from "react-native";
import { colors, fonts, radius, spacing, type } from "../theme/index";

/**
 * The handful of primitives the screens need. The web app uses shadcn/ui, none
 * of which renders in React Native — these are the equivalents, matched to the
 * same tokens so the two products look like one.
 */

export function Screen({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ flex: 1, backgroundColor: colors.background }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ ...type.label, color: colors.textMuted, fontFamily: fonts.mono, marginBottom: spacing.xs }}>
      {String(children).toUpperCase()}
    </Text>
  );
}

export function Heading({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[{ ...type.title, color: colors.text, fontFamily: fonts.mono }, style]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[{ ...type.body, color: muted ? colors.textMuted : colors.text }, style]}>{children}</Text>;
}

export function Button({
  title, onPress, variant = "primary", disabled, loading,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline" | "ghost";
  disabled?: boolean;
  loading?: boolean;
}) {
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => ({
        backgroundColor: isPrimary ? (pressed ? colors.primaryPressed : colors.primary) : "transparent",
        borderColor: isPrimary ? "transparent" : colors.borderStrong,
        borderWidth: variant === "ghost" ? 0 : 1,
        borderRadius: radius.md,
        paddingVertical: 14,
        paddingHorizontal: spacing.xl,
        alignItems: "center",
        opacity: disabled ? 0.45 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.primaryForeground : colors.primary} />
      ) : (
        <Text
          style={{
            ...type.heading,
            fontFamily: fonts.mono,
            color: isPrimary ? colors.primaryForeground : colors.text,
          }}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...input } = props;
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.textFaint}
        {...input}
        style={{
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: 14,
          color: colors.text,
          fontSize: 16,
        }}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.primary : "transparent",
        borderColor: selected ? colors.primary : colors.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: spacing.lg,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ ...type.caption, fontFamily: fonts.mono, color: selected ? colors.primaryForeground : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function Empty({ message }: { message: string }) {
  return (
    <View style={{ padding: spacing.xxl, alignItems: "center" }}>
      <Body muted style={{ textAlign: "center" }}>{message}</Body>
    </View>
  );
}
