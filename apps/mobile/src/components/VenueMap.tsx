import MapView, { Marker } from "react-native-maps";
import { View } from "react-native";
import { colors, radius } from "../theme";

/**
 * Native map. Uses Apple Maps on iOS and Google Maps on Android through
 * react-native-maps.
 *
 * There is a sibling VenueMap.web.tsx: react-native-maps is native-only and
 * throws on web (`codegenNativeComponent is not a function`), so Metro picks
 * the web file there by extension.
 */
export function VenueMap({
  latitude, longitude, title,
}: {
  latitude: number;
  longitude: number;
  title: string;
}) {
  return (
    <View
      style={{
        height: 180,
        borderRadius: radius.lg,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <MapView
        style={{ flex: 1 }}
        initialRegion={{ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
        pointerEvents="none"
      >
        <Marker coordinate={{ latitude, longitude }} title={title} />
      </MapView>
    </View>
  );
}
