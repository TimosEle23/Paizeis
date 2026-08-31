import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Calendar, Clock, Edit, Mail, MapPin, Phone, Target, Trophy, User as UserIcon, Users,
} from "lucide-react-native";
import type { BookingDto, PlayerStatsDto, TeamDto } from "@paizeis/shared";
import { me, teams as teamsApi } from "../../src/api/endpoints";
import { useAuth } from "../../src/auth/AuthProvider";
import { Navbar } from "../../src/components/Navbar";
import { Loading } from "../../src/components/ui";
import { media } from "../../src/media";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

/**
 * The site's /profile page.
 *
 * Pixel-pitch background under a 75% black scrim, the olive uppercase mono
 * heading, then the same three panels the web stacks on a narrow screen:
 * Personal Information, Career Stats, My Teams — followed by Booking History,
 * which the web puts in a second column and a phone gets underneath.
 */
export default function Profile() {
  const { signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: user, isLoading } = useQuery({ queryKey: ["me"], queryFn: me.get });
  const { data: stats } = useQuery({ queryKey: ["my-stats"], queryFn: me.stats });
  const { data: myTeams } = useQuery({ queryKey: ["my-teams"], queryFn: teamsApi.list });
  const { data: bookings } = useQuery({ queryKey: ["my-bookings"], queryFn: me.bookings });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  if (isLoading || !user) return <Loading />;

  const beginEdit = () => {
    setName(user.fullName);
    setPhone(user.phone ?? "");
    setLocation(user.location ?? "");
    setEditing(true);
  };

  const save = async () => {
    await me.update({ fullName: name, phone, location });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    setEditing(false);
  };

  const confirmDelete = () =>
    Alert.alert(
      "Delete your account?",
      "This removes your profile and signs you out everywhere. It cannot be undone.",
      [
        { text: "Keep my account", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => { await me.deleteAccount(); await signOut(); },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Fixed pixel pitch, exactly as the web page does it. */}
      <Image
        source={{ uri: media.pixelPitch }}
        style={{ position: "absolute", width: "100%", height: "100%" }}
        resizeMode="cover"
      />
      <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.75)" }} />

      <Navbar />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl * 2 }}>
        <Text style={{ ...type.display, fontSize: 30, fontFamily: fonts.mono, color: colors.primary, marginBottom: 6 }}>
          MY PROFILE
        </Text>
        <Text style={{ ...type.body, color: "rgba(255,255,255,0.7)", fontFamily: fonts.mono, marginBottom: spacing.xl }}>
          Manage your account and view your football journey
        </Text>

        <Panel title="Personal Information" action={<Pressable onPress={editing ? () => setEditing(false) : beginEdit} hitSlop={10}><Edit size={18} color={colors.primary} /></Pressable>}>
          <View style={{ alignItems: "center", marginBottom: spacing.xl }}>
            <View
              style={{
                width: 96, height: 96, borderRadius: 48,
                backgroundColor: colors.surfaceRaised,
                borderWidth: 2, borderColor: "rgba(99,122,36,0.4)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              {user.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={{ width: 96, height: 96, borderRadius: 48 }} />
              ) : (
                <Text style={{ ...type.display, fontSize: 34, color: colors.text }}>
                  {user.fullName.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>
          </View>

          {editing ? (
            <View style={{ gap: spacing.md }}>
              <EditField label="Full Name" value={name} onChangeText={setName} />
              <EditField label="Phone" value={phone} onChangeText={setPhone} />
              <EditField label="Location" value={location} onChangeText={setLocation} />
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <PrimaryButton title="Save Changes" onPress={save} style={{ flex: 1 }} />
                <OutlineButton title="Cancel" onPress={() => setEditing(false)} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              <InfoRow icon={<UserIcon size={19} color={colors.primary} />} value={user.fullName} />
              <InfoRow icon={<Mail size={19} color={colors.primary} />} value={user.email} small />
              <InfoRow icon={<Phone size={19} color={colors.primary} />} value={user.phone ?? ""} />
              <InfoRow icon={<MapPin size={19} color={colors.primary} />} value={user.location ?? ""} />
            </View>
          )}
        </Panel>

        <Panel title="Career Stats" icon={<Trophy size={19} color={colors.primary} />}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {statTiles(stats).map((tile) => (
              <View
                key={tile.label}
                style={{
                  flexBasis: "47%", flexGrow: 1,
                  alignItems: "center",
                  padding: spacing.lg,
                  borderRadius: radius.md,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderWidth: 1, borderColor: "rgba(99,122,36,0.2)",
                }}
              >
                <Text style={{ ...type.display, fontSize: 24, color: colors.primary, fontFamily: fonts.mono }}>
                  {tile.value}
                </Text>
                <Text style={{ ...type.caption, fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono }}>
                  {tile.label.toUpperCase()}
                </Text>
              </View>
            ))}
          </View>
        </Panel>

        <Panel title="My Teams" icon={<Users size={19} color={colors.primary} />}>
          {!myTeams || myTeams.length === 0 ? (
            <Text style={{ ...type.body, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono, textAlign: "center", paddingVertical: spacing.lg }}>
              No teams yet
            </Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {myTeams.map((team: TeamDto) => (
                <Pressable
                  key={team.id}
                  onPress={() => router.push(`/team/${team.id}`)}
                  style={{
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1, borderColor: "rgba(99,122,36,0.2)",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ ...type.heading, fontFamily: fonts.mono, color: colors.text }}>{team.name}</Text>
                    <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 }}>
                      <Text style={{ ...type.caption, fontSize: 11, fontFamily: fonts.mono, color: colors.text }}>
                        {team.captainId === user.id ? "Captain" : "Member"}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ ...type.caption, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono, marginTop: 2 }}>
                    {team.memberCount} members · tap to manage
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </Panel>

        <Panel title="Booking History" icon={<Calendar size={19} color={colors.primary} />}>
          {!bookings || bookings.length === 0 ? (
            <Text style={{ ...type.body, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono, textAlign: "center", paddingVertical: spacing.xl }}>
              No bookings yet
            </Text>
          ) : (
            <View style={{ gap: spacing.md }}>
              {bookings.map((booking: BookingDto) => <BookingRow key={booking.id} booking={booking} />)}
            </View>
          )}
        </Panel>

        <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
          <OutlineButton title="Sign out" onPress={signOut} />
          <OutlineButton title="Delete account" onPress={confirmDelete} danger />
        </View>
      </ScrollView>
    </View>
  );
}

function statTiles(stats: PlayerStatsDto | undefined) {
  return [
    { label: "Matches", value: stats?.totalMatches ?? 0 },
    { label: "Wins", value: stats?.wins ?? 0 },
    { label: "Goals", value: stats?.goals ?? 0 },
    { label: "Assists", value: stats?.assists ?? 0 },
  ];
}

/** The site's black/70 panel with a primary-tinted border and mono caps title. */
function Panel({
  title, icon, action, children,
}: {
  title: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: "rgba(0,0,0,0.7)",
        borderColor: "rgba(99,122,36,0.3)",
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        marginBottom: spacing.lg,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          {icon}
          <Text style={{ ...type.heading, fontFamily: fonts.mono, color: colors.primary, letterSpacing: 0.5 }}>
            {title.toUpperCase()}
          </Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

function InfoRow({ icon, value, small }: { icon: React.ReactNode; value: string; small?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      {icon}
      <Text style={{ ...type.body, fontSize: small ? 13 : 15, fontFamily: fonts.mono, color: colors.text }}>
        {value}
      </Text>
    </View>
  );
}

function EditField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <View>
      <Text style={{ ...type.caption, color: "rgba(255,255,255,0.8)", fontFamily: fonts.mono, marginBottom: 4 }}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="rgba(255,255,255,0.4)"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          borderColor: "rgba(255,255,255,0.2)",
          borderWidth: 1,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: 11,
          color: colors.text,
          fontSize: 15,
        }}
      />
    </View>
  );
}

function BookingRow({ booking }: { booking: BookingDto }) {
  const starts = new Date(booking.startsAt);
  const opts = { timeZone: "Europe/Nicosia" } as const;

  return (
    <View
      style={{
        padding: spacing.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(255,255,255,0.05)",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: spacing.sm }}>
          <Text style={{ ...type.heading, fontFamily: fonts.mono, color: colors.text }}>
            {booking.venueName.toUpperCase()}
          </Text>
          <Text style={{ ...type.caption, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono, marginTop: 2 }}>
            {booking.pitchName} • {booking.pitchType}
          </Text>
        </View>
        <View style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ ...type.caption, fontSize: 11, fontFamily: fonts.mono, color: colors.text }}>
            {booking.status === "confirmed" ? "Completed" : booking.status}
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginVertical: spacing.md }} />

      <View style={{ gap: spacing.sm }}>
        <MetaRow icon={<Calendar size={15} color={colors.primary} />} text={starts.toLocaleDateString("en-GB", opts)} />
        <MetaRow
          icon={<Clock size={15} color={colors.primary} />}
          text={`${starts.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...opts })} - ${new Date(booking.endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", ...opts })}`}
        />
        <MetaRow icon={<Target size={15} color={colors.primary} />} text={`€${booking.totalAmount}`} highlight />
      </View>
    </View>
  );
}

function MetaRow({ icon, text, highlight }: { icon: React.ReactNode; text: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
      {icon}
      <Text
        style={{
          ...type.caption,
          fontFamily: fonts.mono,
          color: highlight ? colors.primary : "rgba(255,255,255,0.8)",
          fontWeight: highlight ? "600" : "400",
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function PrimaryButton({ title, onPress, style }: { title: string; onPress: () => void; style?: object }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { backgroundColor: pressed ? colors.primaryPressed : colors.primary, borderRadius: radius.md, paddingVertical: 12, alignItems: "center" },
        style,
      ]}
    >
      <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: colors.primaryForeground }}>{title}</Text>
    </Pressable>
  );
}

function OutlineButton({ title, onPress, style, danger }: { title: string; onPress: () => void; style?: object; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderColor: danger ? colors.danger : "rgba(255,255,255,0.2)",
          borderWidth: 1,
          borderRadius: radius.md,
          paddingVertical: 12,
          alignItems: "center",
          backgroundColor: pressed ? "rgba(255,255,255,0.08)" : "transparent",
        },
        style,
      ]}
    >
      <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: danger ? colors.danger : colors.text }}>
        {title}
      </Text>
    </Pressable>
  );
}
