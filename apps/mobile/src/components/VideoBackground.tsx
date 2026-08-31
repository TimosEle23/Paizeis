import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "../theme";

/**
 * Full-bleed looping video behind a screen, matching the web app's
 * `<video autoPlay loop muted playsInline className="object-cover">` heroes.
 *
 * `overlayOpacity` mirrors the dark scrim each page uses: the home page dims to
 * 60%, the auth page only to 20%, the venues list to 70%.
 */
export function VideoBackground({
  source,
  overlayOpacity = 0.6,
}: {
  source: string;
  overlayOpacity?: number;
}) {
  const player = useVideoPlayer(source, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });

  // A backgrounded player keeps decoding otherwise, which costs battery for a
  // video nobody is looking at.
  useEffect(() => () => player.release?.(), [player]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
      />
      <View
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: overlayOpacity }]}
      />
    </View>
  );
}
