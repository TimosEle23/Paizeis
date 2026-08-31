import { useMemo, useState } from "react";
import { Navbar } from "../../src/components/Navbar";
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import * as Location from "expo-location";
import { MapPin, Navigation, Phone, Search, Star } from "lucide-react-native";
import type { VenueDto } from "@paizeis/shared";
import { venues as venuesApi } from "../../src/api/endpoints";
import { VideoBackground } from "../../src/components/VideoBackground";
import { media, venueImage } from "../../src/media";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

/**
 * Pitch sizes, offered directly.
 *
 * The website nests these under a "Futsal" category that has to be opened
 * first. With padel hidden there is only one category left, so the extra step
 * bought nothing — a player picking 5v5 taps once instead of twice.
 */
const PITCH_SIZES = ["5v5", "7v7", "9v9", "11v11"] as const;

/**
 * The site's /venues page on a phone: futsal loop at 70% scrim, the
 * "All fields in the city!" heading, search, then Sort / Filter by City /
 * Filter by Pitch Type, then the venue cards with their photo, rating,
 * location, phone, pitch badges and a From-price with a Book Now button.
 */
export default function Venues() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [city, setCity] = useState<string | null>(null);
  const [pitchType, setPitchType] = useState<string | null>(null);
  const [near, setNear] = useState<string | undefined>();
  const [locating, setLocating] = useState(false);

  const { data: cities } = useQuery({ queryKey: ["cities"], queryFn: venuesApi.cities });

  const { data: venues, isLoading } = useQuery({
    queryKey: ["venues", search, city, pitchType, near],
    queryFn: () =>
      venuesApi.list({
        q: search || undefined,
        city: city ?? undefined,
        pitchType: pitchType ?? undefined,
        near,
        radiusKm: near ? 100 : undefined,
      }),
  });

  const requestLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const position = await Location.getCurrentPositionAsync({});
      setNear(`${position.coords.latitude},${position.coords.longitude}`);
    } finally {
      setLocating(false);
    }
  };

  const count = venues?.length ?? 0;
  const header = useMemo(
    () => (
      <View style={{ paddingHorizontal: spacing.lg }}>
        <Text
          style={{
            ...type.display,
            fontSize: 22,
            fontFamily: fonts.mono,
            color: colors.text,
            textAlign: "center",
            marginBottom: spacing.md,
          }}
        >
          All fields in the city!
        </Text>
        <Text style={{ ...type.body, color: "rgba(255,255,255,0.8)", fontFamily: fonts.mono, marginBottom: spacing.lg }}>
          Browse {count} available pitches and courts across Cyprus
        </Text>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
            backgroundColor: "rgba(0,0,0,0.45)",
            borderColor: "rgba(255,255,255,0.2)",
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            marginBottom: spacing.lg,
          }}
        >
          <Search size={16} color="rgba(255,255,255,0.6)" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by venue name, location, or city..."
            placeholderTextColor="rgba(255,255,255,0.5)"
            style={{ flex: 1, paddingVertical: 12, color: colors.text, fontSize: 15 }}
          />
        </View>

        <FilterGroup title="Sort">
          <FilterButton label="All Fields" active={!near} onPress={() => setNear(undefined)} />
          <FilterButton
            label={locating ? "Locating..." : "Closest to me"}
            active={Boolean(near)}
            onPress={requestLocation}
            icon={<Navigation size={13} color={near ? colors.primaryForeground : colors.text} />}
          />
        </FilterGroup>

        <FilterGroup title="Filter by City">
          <FilterButton label="All Cities" active={!city} onPress={() => setCity(null)} />
          {(cities ?? []).map((c) => (
            <FilterButton key={c.city} label={c.city} active={city === c.city} onPress={() => setCity(c.city)} />
          ))}
        </FilterGroup>

        <FilterGroup title="Filter by Pitch Type">
          <FilterButton label="All" active={!pitchType} onPress={() => setPitchType(null)} />
          {PITCH_SIZES.map((size) => (
            <FilterButton
              key={size}
              label={size}
              active={pitchType === size}
              onPress={() => setPitchType(pitchType === size ? null : size)}
            />
          ))}
        </FilterGroup>

        <Text style={{ ...type.body, color: "rgba(255,255,255,0.8)", fontFamily: fonts.mono, marginBottom: spacing.md }}>
          Showing {count} venue{count !== 1 ? "s" : ""}
        </Text>
      </View>
    ),
    [count, search, city, pitchType, near, locating, cities],
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <VideoBackground source={media.venuesVideo} overlayOpacity={0.7} />

      <Navbar />

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={venues ?? []}
          keyExtractor={(venue) => venue.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xxl * 2 }}
          renderItem={({ item }) => (
            <VenueCard venue={item} onPress={() => router.push(`/booking/${item.id}`)} onDetails={() => router.push(`/venue/${item.id}`)} />
          )}
          ListEmptyComponent={
            <Text style={{ ...type.body, color: "rgba(255,255,255,0.8)", textAlign: "center", padding: spacing.xxl }}>
              No venues found matching your criteria.
            </Text>
          }
        />
      )}
    </View>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={{ ...type.heading, fontSize: 13, fontFamily: fonts.mono, color: colors.text, marginBottom: spacing.sm }}>
        {title}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>{children}</View>
    </View>
  );
}

function FilterButton({
  label, active, onPress, icon,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        backgroundColor: active ? colors.primary : "transparent",
        borderColor: active ? colors.primary : "rgba(255,255,255,0.25)",
        borderWidth: 1,
        borderRadius: radius.md,
        paddingVertical: 7,
        paddingHorizontal: spacing.md,
      }}
    >
      {icon}
      <Text style={{ ...type.caption, fontFamily: fonts.mono, color: active ? colors.primaryForeground : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** One card per venue — the site's photo / header / content layout. */
function VenueCard({
  venue, onPress, onDetails,
}: {
  venue: VenueDto;
  onPress: () => void;
  onDetails: () => void;
}) {
  const photo = venueImage(venue.futsalImageUrl ?? venue.imageUrl);
  const types = [...new Set(venue.pitches.map((p) => p.pitchType))];
  const cheapest = venue.pitches.length ? Math.min(...venue.pitches.map((p) => p.pricePerHour)) : null;

  return (
    <Pressable
      onPress={onDetails}
      style={{
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        backgroundColor: colors.background,
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        borderRadius: radius.lg,
        overflow: "hidden",
      }}
    >
      <View style={{ height: 176, backgroundColor: colors.surfaceRaised }}>
        {photo && <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />}
      </View>

      <View style={{ padding: spacing.lg }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={{ ...type.title, fontFamily: fonts.mono, color: colors.text, flex: 1, paddingRight: spacing.sm }}>
            {venue.name}
          </Text>
          {venue.googleRating !== null && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Star size={14} color={colors.accent} fill={colors.accent} />
              <Text style={{ ...type.caption, color: colors.accent, fontWeight: "600" }}>{venue.googleRating}</Text>
              {venue.googleReviewsCount !== null && (
                <Text style={{ ...type.caption, color: "rgba(255,255,255,0.6)", fontSize: 11 }}>
                  ({venue.googleReviewsCount})
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 5 }}>
          <MapPin size={15} color="rgba(255,255,255,0.7)" />
          <Text style={{ ...type.body, fontSize: 13, color: "rgba(255,255,255,0.7)", flex: 1 }}>
            {venue.location}, {venue.city}
          </Text>
        </View>
        {venue.phone && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3 }}>
            <Phone size={15} color="rgba(255,255,255,0.7)" />
            <Text style={{ ...type.body, fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{venue.phone}</Text>
          </View>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.md }}>
          {types.map((t) => (
            <View
              key={t}
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderColor: "rgba(255,255,255,0.1)",
                borderWidth: 1,
                borderRadius: radius.sm,
                paddingHorizontal: 8,
                paddingVertical: 3,
              }}
            >
              <Text style={{ ...type.caption, fontSize: 11, color: colors.text }}>{t.toUpperCase()}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.lg }}>
          <View>
            <Text style={{ ...type.caption, color: "rgba(255,255,255,0.7)" }}>From</Text>
            <Text style={{ ...type.title, color: colors.primary }}>€{cheapest ?? "—"}/hr</Text>
          </View>
          <Pressable
            onPress={onPress}
            style={({ pressed }) => ({
              backgroundColor: pressed ? colors.primaryPressed : colors.primary,
              borderRadius: radius.md,
              paddingVertical: 10,
              paddingHorizontal: spacing.xl,
            })}
          >
            <Text style={{ ...type.heading, fontSize: 14, fontFamily: fonts.mono, color: colors.primaryForeground }}>
              Book Now
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}
