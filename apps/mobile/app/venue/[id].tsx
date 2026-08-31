import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { venues as venuesApi } from "../../src/api/endpoints";
import { Body, Button, Card, Heading, Label, Loading, Screen } from "../../src/components/ui";
import { Navbar } from "../../src/components/Navbar";
import { VenueMap } from "../../src/components/VenueMap";
import { colors, spacing } from "../../src/theme";

export default function VenueDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: venue, isLoading } = useQuery({
    queryKey: ["venue", id],
    queryFn: () => venuesApi.get(id!),
    enabled: Boolean(id),
  });

  if (isLoading || !venue) return <Loading />;

  return (
    <Screen>
      {/* Without this the page began under the status bar and clipped its own
          title. Every other screen carries the navbar; this one was missed. */}
      <Navbar showBack />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl }}>
        <View>
          <Heading style={{ fontSize: 22 }}>{venue.name}</Heading>
          <Body muted style={{ marginTop: 4 }}>{venue.location}, {venue.city}</Body>
          {venue.googleRating !== null && (
            <Body style={{ color: colors.accent, marginTop: 4 }}>
              ★ {venue.googleRating} · {venue.googleReviewsCount ?? 0} reviews
            </Body>
          )}
        </View>

        {venue.latitude !== null && venue.longitude !== null && (
          <VenueMap latitude={venue.latitude} longitude={venue.longitude} title={venue.name} />
        )}

        <Card>
          <Label>Pitches</Label>
          <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
            {venue.pitches.map((pitch) => (
              <View
                key={pitch.id}
                style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
              >
                <View>
                  <Body>{pitch.name}</Body>
                  <Body muted style={{ fontSize: 12 }}>{pitch.pitchType.toUpperCase()}</Body>
                </View>
                <Body style={{ color: colors.primary }}>€{pitch.pricePerHour}/hr</Body>
              </View>
            ))}
          </View>
        </Card>

        <Card>
          <Label>Opening hours</Label>
          <Body>{venue.openingHours.open} – {venue.openingHours.close}</Body>
          {venue.phone && (
            <>
              <Label>Phone</Label>
              <Body>{venue.phone}</Body>
            </>
          )}
        </Card>

        <Button title="Check availability" onPress={() => router.push(`/booking/${venue.id}`)} />
      </ScrollView>
    </Screen>
  );
}
