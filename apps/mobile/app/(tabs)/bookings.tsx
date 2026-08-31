import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BookingDto } from "@paizeis/shared";
import { invitations as invitationsApi, me, type MatchInvitation } from "../../src/api/endpoints";
import { Navbar } from "../../src/components/Navbar";
import { Body, Card, Empty, Heading, Label, Loading, Screen } from "../../src/components/ui";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

const STATUS_COLOUR: Record<string, string> = {
  confirmed: colors.primary,
  held: colors.accent,
  cancelled: colors.danger,
  expired: colors.textFaint,
  payment_failed: colors.danger,
  completed: colors.textMuted,
};

export default function Bookings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-bookings"], queryFn: me.bookings });
  const { data: invites } = useQuery({ queryKey: ["my-invitations"], queryFn: invitationsApi.mine });

  const pending = (invites ?? []).filter((invite) => invite.status === "pending");

  const respond = async (invitation: MatchInvitation, accept: boolean) => {
    try {
      if (accept) await invitationsApi.accept(invitation.id);
      else await invitationsApi.decline(invitation.id);
      await queryClient.invalidateQueries({ queryKey: ["my-invitations"] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    } catch {
      Alert.alert("Could not respond", "Try again in a moment.");
    }
  };

  if (isLoading) return <Loading />;

  return (
    <Screen>
      <Navbar />
      <FlatList
        data={data ?? []}
        keyExtractor={(booking) => booking.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        ListHeaderComponent={
          pending.length > 0 ? (
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              <Text style={{ ...type.label, color: colors.accent, fontFamily: fonts.mono }}>
                MATCH INVITATIONS
              </Text>
              {pending.map((invitation) => (
                <InvitationCard key={invitation.id} invitation={invitation} onRespond={respond} />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={<Empty message="No bookings yet. Find a pitch and get a game on." />}
        renderItem={({ item }) => <BookingRow booking={item} />}
      />
    </Screen>
  );
}

/** An invitation someone sent you, with the two replies it expects. */
function InvitationCard({
  invitation, onRespond,
}: {
  invitation: MatchInvitation;
  onRespond: (invitation: MatchInvitation, accept: boolean) => void;
}) {
  const starts = new Date(invitation.startsAt);
  const when = starts.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Nicosia",
  });

  return (
    <View
      style={{
        borderColor: colors.accent,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        backgroundColor: "rgba(0,0,0,0.7)",
        gap: spacing.sm,
      }}
    >
      <Text style={{ ...type.heading, fontFamily: fonts.mono, color: colors.text }}>
        {invitation.venueName}
      </Text>
      <Text style={{ ...type.caption, color: "rgba(255,255,255,0.7)" }}>
        {invitation.pitchName} · {when}
      </Text>
      <Text style={{ ...type.caption, color: colors.accent }}>
        {invitation.invitedByName} invited you to play
      </Text>

      <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
        <Pressable
          onPress={() => onRespond(invitation, true)}
          style={{ flex: 1, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 11, alignItems: "center" }}
        >
          <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: colors.primaryForeground }}>
            I'm in
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onRespond(invitation, false)}
          style={{ flex: 1, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingVertical: 11, alignItems: "center" }}
        >
          <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: colors.textMuted }}>
            Can't make it
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function BookingRow({ booking }: { booking: BookingDto }) {
  const starts = new Date(booking.startsAt);
  const date = starts.toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Nicosia",
  });
  const time = starts.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Nicosia",
  });

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View style={{ flex: 1 }}>
          <Heading style={{ fontSize: 16 }}>{booking.venueName}</Heading>
          <Body muted style={{ marginTop: 2 }}>
            {booking.pitchName} · {booking.pitchType.toUpperCase()}
          </Body>
        </View>
        <View
          style={{
            borderColor: STATUS_COLOUR[booking.status] ?? colors.border,
            borderWidth: 1,
            borderRadius: radius.sm,
            paddingHorizontal: 8,
            paddingVertical: 3,
            alignSelf: "flex-start",
          }}
        >
          <Body style={{ fontSize: 11, color: STATUS_COLOUR[booking.status] ?? colors.textMuted }}>
            {booking.status.replace("_", " ").toUpperCase()}
          </Body>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: spacing.md }}>
        <View>
          <Label>When</Label>
          <Body>{date} · {time}</Body>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Label>Deposit</Label>
          <Body style={{ color: colors.primary }}>€{booking.depositAmount.toFixed(2)}</Body>
        </View>
      </View>

      {booking.teamName ? (
        <View style={{ marginTop: spacing.md }}>
          <Label>Team</Label>
          <Body>{booking.teamName}</Body>
        </View>
      ) : null}
    </Card>
  );
}
