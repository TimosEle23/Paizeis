import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";
import type { PitchDto, SlotDto } from "@paizeis/shared";
import { DURATION_OPTIONS, VENUE_TIMEZONE } from "@paizeis/shared";
import { bookings as bookingsApi, invitations as invitationsApi, teams as teamsApi, venues as venuesApi } from "../../src/api/endpoints";
import { ApiRequestError } from "../../src/api/client";
import { Navbar } from "../../src/components/Navbar";
import { media } from "../../src/media";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

/** The next fortnight, labelled as the site's date strip does. */
function upcomingDates(count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      value: date.toISOString().slice(0, 10),
      label:
        i === 0 ? "Today"
        : i === 1 ? "Tomorrow"
        : date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }),
    };
  });
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: VENUE_TIMEZONE });

export default function BookingScreen() {
  const { venueId } = useLocalSearchParams<{ venueId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const dates = useMemo(() => upcomingDates(), []);

  const [date, setDate] = useState(dates[0]!.value);
  const [duration, setDuration] = useState<number>(1);
  const [selected, setSelected] = useState<{ pitch: PitchDto; slot: SlotDto } | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [busy, setBusy] = useState(false);
  /** Set once a booking exists, which turns the summary into an invite panel. */
  const [booked, setBooked] = useState<{ id: string; label: string } | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [invited, setInvited] = useState<string[]>([]);

  const { data: venue } = useQuery({
    queryKey: ["venue", venueId], queryFn: () => venuesApi.get(venueId!), enabled: Boolean(venueId),
  });
  const { data: availability, isLoading } = useQuery({
    queryKey: ["availability", venueId, date, duration],
    queryFn: () => venuesApi.availability(venueId!, { date, duration }),
    enabled: Boolean(venueId),
  });
  const { data: myTeams } = useQuery({ queryKey: ["my-teams"], queryFn: teamsApi.list });

  /** Changing date or duration invalidates a slot chosen under the old ones. */
  const resetSelection = () => setSelected(null);

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setBusy(true);
    try {
      const team = await teamsApi.create(newTeamName.trim());
      await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
      setTeamId(team.id);
      setNewTeamName("");
    } catch (err) {
      Alert.alert("Could not create team", err instanceof ApiRequestError ? err.userMessage : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Creates the booking, then sends the player to Stripe for the deposit.
   *
   * The booking is created first and holds the slot for 15 minutes, so the
   * pitch is genuinely reserved while payment happens rather than being open to
   * whoever finishes checkout first. If payments are not configured yet the
   * booking still stands as `held` — that is a useful state, not a failure.
   */
  const reserve = async () => {
    if (!selected || !teamId) return;
    setBusy(true);
    try {
      const booking = await bookingsApi.create({
        pitchId: selected.pitch.id,
        teamId,
        startsAt: selected.slot.startsAt,
        duration,
      });

      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });

      // The match now exists, so players can be invited to it. Stay on the
      // screen and swap the summary for the invite panel rather than bouncing
      // away — inviting is easiest in the moment the match is made.
      setBooked({
        id: booking.id,
        label: `${booking.pitchName} · ${hhmm(booking.startsAt)}–${hhmm(booking.endsAt)}`,
      });
      setSelected(null);

      try {
        const checkout = await bookingsApi.checkout(booking.id);
        await WebBrowser.openBrowserAsync(checkout.checkoutUrl);
      } catch {
        // Payments not configured yet; the pitch is still held for 15 minutes.
      }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.userMessage : "Could not create the booking.";
      Alert.alert("Booking failed", message);
      // A taken slot means the grid on screen is stale — refetch it.
      await queryClient.invalidateQueries({ queryKey: ["availability"] });
      setSelected(null);
    } finally {
      setBusy(false);
    }
  };

  const steps = [
    { label: "PITCH", done: Boolean(selected) },
    { label: "DATE & TIME", done: Boolean(selected) },
    { label: "TEAM", done: Boolean(teamId) },
    { label: "PAY", done: false },
  ];

  const total = selected ? selected.pitch.pricePerHour * duration : 0;
  const deposit = total * (venue?.depositRate ?? 0.2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Image source={{ uri: media.bookingBackground }} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" />
      <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.6)" }} />

      <Navbar showBack />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: selected ? 260 : spacing.xxl }}>
        <Text style={{ ...type.title, fontFamily: fonts.mono, color: colors.text }}>{venue?.name ?? "…"}</Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.sm, borderColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderRadius: radius.md, backgroundColor: "rgba(0,0,0,0.85)", paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}>
          {steps.map((step, i) => (
            <View key={step.label} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              {i > 0 && <Text style={{ color: "rgba(255,255,255,0.25)" }}>/</Text>}
              <Text style={{ fontSize: 10, letterSpacing: 1.4, fontFamily: fonts.mono, color: step.done ? colors.primary : "rgba(255,255,255,0.45)" }}>
                {String(i + 1).padStart(2, "0")} {step.label}
              </Text>
            </View>
          ))}
        </View>

        <Section title="Date">
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {dates.map((d) => (
              <Chip key={d.value} label={d.label} active={date === d.value} onPress={() => { setDate(d.value); resetSelection(); }} />
            ))}
          </ScrollView>
        </Section>

        <Section title="Duration">
          <View style={{ flexDirection: "row" }}>
            {DURATION_OPTIONS.map((d) => (
              <Chip
                key={d}
                label={d === 1 ? "1 hour" : d === 1.5 ? "1½ hours" : "2 hours"}
                active={duration === d}
                onPress={() => { setDuration(d); resetSelection(); }}
              />
            ))}
          </View>
        </Section>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} size="large" style={{ marginTop: spacing.xl }} />
        ) : (
          (availability?.pitches ?? []).map(({ pitch, slots }) => {
            const free = slots.filter((s) => s.available).length;
            return (
              <View key={pitch.id} style={{ backgroundColor: "rgba(0,0,0,0.85)", borderColor: "rgba(255,255,255,0.15)", borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.md }}>
                  <View>
                    <Text style={{ ...type.title, fontSize: 17, fontFamily: fonts.mono, color: colors.text }}>{pitch.name}</Text>
                    <Text style={{ ...type.caption, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono }}>
                      {pitch.pitchType.toUpperCase()} · €{pitch.pricePerHour}/hr
                    </Text>
                  </View>
                  <Text style={{ ...type.body, color: "rgba(255,255,255,0.6)" }}>{free} free</Text>
                </View>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {slots.map((slot) => (
                    <SlotChip
                      key={slot.startsAt}
                      slot={slot}
                      selected={selected?.slot.startsAt === slot.startsAt && selected.pitch.id === pitch.id}
                      onPress={() => setSelected({ pitch, slot })}
                    />
                  ))}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {booked && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.96)", borderTopColor: colors.primary, borderTopWidth: 1, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ ...type.heading, fontFamily: fonts.mono, color: colors.primary }}>PITCH HELD</Text>
            <Pressable onPress={() => { setBooked(null); setInvited([]); }} hitSlop={10}>
              <Text style={{ ...type.body, color: colors.textFaint }}>Done</Text>
            </Pressable>
          </View>
          <Text style={{ ...type.caption, color: "rgba(255,255,255,0.7)" }}>{booked.label}</Text>

          <Text style={{ ...type.label, color: "rgba(255,255,255,0.7)", fontFamily: fonts.mono }}>
            INVITE PLAYERS
          </Text>
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <TextInput
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="teammate@email.com"
              placeholderTextColor="rgba(255,255,255,0.4)"
              autoCapitalize="none"
              keyboardType="email-address"
              style={{ flex: 1, backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text }}
            />
            <Pressable
              onPress={async () => {
                if (!inviteEmail.trim() || !booked) return;
                setBusy(true);
                try {
                  const invitation = await invitationsApi.invite(booked.id, inviteEmail.trim());
                  setInvited((current) => [...current, invitation.email]);
                  setInviteEmail("");
                } catch (err) {
                  Alert.alert("Could not invite", err instanceof ApiRequestError ? err.userMessage : "Try again.");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy || !inviteEmail.trim()}
              style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center", opacity: inviteEmail.trim() ? 1 : 0.5 }}
            >
              <Text style={{ ...type.body, fontFamily: fonts.mono, color: colors.primaryForeground }}>Invite</Text>
            </Pressable>
          </View>

          {invited.length > 0 && (
            <Text style={{ ...type.caption, color: colors.primary }}>
              Invited {invited.join(", ")} — they get a notification to accept or decline.
            </Text>
          )}

          <Pressable onPress={() => router.push("/(tabs)/bookings")}>
            <Text style={{ ...type.body, color: colors.textFaint, textAlign: "center" }}>See my bookings</Text>
          </Pressable>
        </View>
      )}

      {/* Summary docks to the bottom the moment a slot is chosen — the site's
          sticky Booking Summary card, adapted to a phone. */}
      {selected && !booked && (
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.96)", borderTopColor: "rgba(255,255,255,0.15)", borderTopWidth: 1, padding: spacing.lg, gap: spacing.md }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ ...type.body, color: "rgba(255,255,255,0.6)" }}>
              {selected.pitch.name} · {hhmm(selected.slot.startsAt)}–{hhmm(selected.slot.endsAt)}
            </Text>
            <Pressable onPress={() => setSelected(null)} hitSlop={10}>
              <Text style={{ ...type.body, color: colors.textFaint }}>Clear</Text>
            </Pressable>
          </View>

          {myTeams && myTeams.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {myTeams.map((team) => (
                <Chip key={team.id} label={team.name} active={teamId === team.id} onPress={() => setTeamId(team.id)} />
              ))}
            </ScrollView>
          ) : (
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <TextInput
                value={newTeamName}
                onChangeText={setNewTeamName}
                placeholder="Name your team to book"
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={{ flex: 1, backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.text }}
              />
              <Pressable onPress={createTeam} disabled={busy || !newTeamName.trim()} style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center", opacity: newTeamName.trim() ? 1 : 0.5 }}>
                <Text style={{ ...type.body, fontFamily: fonts.mono, color: colors.primaryForeground }}>Create</Text>
              </Pressable>
            </View>
          )}

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Text style={{ ...type.caption, color: "rgba(255,255,255,0.6)" }}>Deposit ({Math.round((venue?.depositRate ?? 0.2) * 100)}%)</Text>
              <Text style={{ ...type.title, color: colors.primary }}>€{deposit.toFixed(2)}</Text>
              <Text style={{ ...type.caption, color: colors.textFaint }}>of €{total.toFixed(2)} total</Text>
            </View>
            <Pressable
              onPress={reserve}
              disabled={busy || !teamId}
              style={({ pressed }) => ({
                backgroundColor: pressed ? colors.primaryPressed : colors.primary,
                borderRadius: radius.md,
                paddingVertical: 14,
                paddingHorizontal: spacing.xl,
                opacity: busy || !teamId ? 0.45 : 1,
              })}
            >
              {busy
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={{ ...type.heading, fontFamily: fonts.mono, color: colors.primaryForeground }}>Reserve</Text>}
            </Pressable>
          </View>

          {!teamId && (
            <Text style={{ ...type.caption, color: colors.textFaint, textAlign: "center" }}>
              Pick or create a team to reserve this slot
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ ...type.label, color: "rgba(255,255,255,0.7)", fontFamily: fonts.mono, marginBottom: spacing.sm }}>
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? colors.primary : "transparent",
        borderColor: active ? colors.primary : "rgba(255,255,255,0.25)",
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: 8,
        paddingHorizontal: spacing.lg,
        marginRight: spacing.sm,
      }}
    >
      <Text style={{ ...type.caption, fontFamily: fonts.mono, color: active ? colors.primaryForeground : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A time slot. Available ones are tappable; the rest say why they are not. */
function SlotChip({ slot, selected, onPress }: { slot: SlotDto; selected: boolean; onPress: () => void }) {
  const tint = selected
    ? colors.primaryForeground
    : slot.available
      ? colors.primary
      : slot.reason === "past"
        ? colors.textFaint
        : colors.danger;

  return (
    <Pressable
      disabled={!slot.available}
      onPress={onPress}
      style={{
        backgroundColor: selected ? colors.primary : "transparent",
        borderColor: selected ? colors.primary : tint,
        borderWidth: 1,
        borderRadius: radius.sm,
        paddingVertical: 8,
        paddingHorizontal: spacing.md,
        opacity: slot.available ? 1 : 0.4,
        minWidth: 78,
        alignItems: "center",
      }}
    >
      <Text style={{ ...type.body, color: tint, fontSize: 13, fontFamily: fonts.mono }}>{hhmm(slot.startsAt)}</Text>
      <Text style={{ fontSize: 10, color: selected ? colors.primaryForeground : colors.textFaint }}>
        {slot.available ? `€${slot.pricePerSlot}` : (slot.reason ?? "")}
      </Text>
    </Pressable>
  );
}
