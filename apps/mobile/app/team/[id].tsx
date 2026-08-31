import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Platform,
  Pressable, Text, TextInput, View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, LogOut, Send, UserMinus, UserPlus } from "lucide-react-native";
import type { RosterMemberDto } from "@paizeis/shared";
import { teams as teamsApi, type TeamMessage } from "../../src/api/endpoints";
import { ApiRequestError } from "../../src/api/client";
import { useAuth } from "../../src/auth/AuthProvider";
import { Navbar } from "../../src/components/Navbar";
import { Loading } from "../../src/components/ui";
import { media } from "../../src/media";
import { colors, fonts, radius, spacing, type } from "../../src/theme";

/**
 * One team: the squad, and the squad's chat.
 *
 * Chat refetches on an interval rather than over a socket. A WebSocket would
 * mean a second connection to keep alive, reconnect and authenticate; polling
 * every few seconds is a fraction of the code and, for a group deciding who is
 * playing on Thursday, indistinguishable.
 */
const CHAT_POLL_MS = 4000;

export default function TeamScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [tab, setTab] = useState<"squad" | "chat">("squad");
  const [draft, setDraft] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<FlatList<TeamMessage>>(null);

  const { data: team, isLoading } = useQuery({
    queryKey: ["team", id], queryFn: () => teamsApi.get(id!), enabled: Boolean(id),
  });

  const { data: messages } = useQuery({
    queryKey: ["team-messages", id],
    queryFn: () => teamsApi.messages(id!),
    enabled: Boolean(id) && tab === "chat",
    // Only poll while the chat is actually on screen.
    refetchInterval: tab === "chat" ? CHAT_POLL_MS : false,
  });

  useEffect(() => {
    if (tab === "chat" && messages?.length) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [tab, messages?.length]);

  if (isLoading || !team) return <Loading />;

  const amCaptain = team.captainId === user?.id;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["team", id] });

  const run = async (work: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    try {
      await work();
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["my-teams"] });
    } catch (err) {
      Alert.alert(failure, err instanceof ApiRequestError ? err.userMessage : "Try again.");
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const body = draft.trim();
    if (!body) return;
    setDraft("");
    try {
      await teamsApi.send(id!, body);
      await queryClient.invalidateQueries({ queryKey: ["team-messages", id] });
    } catch {
      setDraft(body); // put it back so nothing is lost
      Alert.alert("Message not sent", "Check your connection and try again.");
    }
  };

  const confirmLeave = () =>
    Alert.alert(
      `Leave ${team.name}?`,
      amCaptain
        ? "The captaincy passes to the longest-serving member. If you are the last one, the team is deleted."
        : "You will stop being picked for their matches.",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            await run(() => teamsApi.leave(id!), "Could not leave");
            router.back();
          },
        },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Image source={{ uri: media.pixelPitch }} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" />
      <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.82)" }} />

      <Navbar showBack />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ ...type.display, fontSize: 24, fontFamily: fonts.mono, color: colors.primary }}>
            {team.name.toUpperCase()}
          </Text>
          <Pressable onPress={confirmLeave} hitSlop={10}>
            <LogOut size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        <Text style={{ ...type.caption, color: "rgba(255,255,255,0.6)", fontFamily: fonts.mono, marginTop: 2 }}>
          {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
        </Text>

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
          <TabButton label="Squad" active={tab === "squad"} onPress={() => setTab("squad")} />
          <TabButton label="Chat" active={tab === "chat"} onPress={() => setTab("chat")} />
        </View>
      </View>

      {tab === "squad" ? (
        <FlatList
          data={team.roster}
          keyExtractor={(member) => member.userId}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          renderItem={({ item }) => (
            <MemberRow
              member={item}
              canRemove={amCaptain && item.userId !== team.captainId}
              onRemove={() => run(() => teamsApi.removeMember(id!, item.userId), "Could not remove")}
            />
          )}
          ListFooterComponent={
            amCaptain ? (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Text style={{ ...type.label, color: "rgba(255,255,255,0.7)", fontFamily: fonts.mono }}>
                  ADD A PLAYER
                </Text>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <TextInput
                    value={inviteEmail}
                    onChangeText={setInviteEmail}
                    placeholder="their@email.com"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    style={inputStyle}
                  />
                  <Pressable
                    onPress={async () => {
                      await run(() => teamsApi.addMember(id!, inviteEmail.trim()), "Could not add");
                      setInviteEmail("");
                    }}
                    disabled={busy || !inviteEmail.trim()}
                    style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center", opacity: inviteEmail.trim() ? 1 : 0.5 }}
                  >
                    <UserPlus size={18} color={colors.primaryForeground} />
                  </Pressable>
                </View>
                <Text style={{ ...type.caption, color: colors.textFaint }}>
                  They need a Paizeis account. To invite someone new, use the invite on a booking.
                </Text>
              </View>
            ) : null
          }
        />
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={90}
          style={{ flex: 1 }}
        >
          <FlatList
            ref={listRef}
            data={messages ?? []}
            keyExtractor={(message) => message.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            renderItem={({ item }) => <Bubble message={item} />}
            ListEmptyComponent={
              <Text style={{ ...type.body, color: "rgba(255,255,255,0.5)", textAlign: "center", padding: spacing.xxl }}>
                Nothing said yet. Sort out who's playing.
              </Text>
            }
          />
          <View style={{ flexDirection: "row", gap: spacing.sm, padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: "rgba(0,0,0,0.9)" }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Message the squad"
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              style={[inputStyle, { maxHeight: 96 }]}
              onSubmitEditing={send}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim()}
              style={{ backgroundColor: colors.primary, borderRadius: radius.md, paddingHorizontal: spacing.lg, justifyContent: "center", opacity: draft.trim() ? 1 : 0.5 }}
            >
              <Send size={18} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {busy && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.3)" }}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </View>
  );
}

const inputStyle = {
  flex: 1,
  backgroundColor: colors.surfaceRaised,
  borderColor: colors.border,
  borderWidth: 1,
  borderRadius: radius.md,
  paddingHorizontal: spacing.md,
  paddingVertical: 11,
  color: colors.text,
  fontSize: 15,
} as const;

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderBottomWidth: 2,
        borderBottomColor: active ? colors.primary : "transparent",
        paddingBottom: 6,
        paddingHorizontal: spacing.sm,
      }}
    >
      <Text style={{ ...type.heading, fontFamily: fonts.mono, color: active ? colors.primary : colors.textMuted }}>
        {label}
      </Text>
    </Pressable>
  );
}

function MemberRow({
  member, canRemove, onRemove,
}: {
  member: RosterMemberDto;
  canRemove: boolean;
  onRemove: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: "rgba(255,255,255,0.05)",
        borderWidth: 1,
        borderColor: "rgba(99,122,36,0.2)",
      }}
    >
      <View
        style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: colors.surfaceRaised,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Text style={{ ...type.heading, color: colors.text }}>
          {member.fullName.charAt(0).toUpperCase()}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ ...type.body, fontFamily: fonts.mono, color: colors.text }}>{member.fullName}</Text>
          {member.isCaptain && <Crown size={14} color={colors.accent} />}
        </View>
        <Text style={{ ...type.caption, color: "rgba(255,255,255,0.55)" }}>{member.email}</Text>
      </View>

      {canRemove && (
        <Pressable onPress={onRemove} hitSlop={10}>
          <UserMinus size={18} color={colors.danger} />
        </Pressable>
      )}
    </View>
  );
}

function Bubble({ message }: { message: TeamMessage }) {
  const time = new Date(message.createdAt).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/Nicosia",
  });

  return (
    <View style={{ alignSelf: message.mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
      {!message.mine && (
        <Text style={{ ...type.caption, fontSize: 11, color: colors.primary, marginBottom: 2, fontFamily: fonts.mono }}>
          {message.authorName}
        </Text>
      )}
      <View
        style={{
          backgroundColor: message.mine ? colors.primary : "rgba(255,255,255,0.08)",
          borderRadius: radius.lg,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Text style={{ ...type.body, color: message.mine ? colors.primaryForeground : colors.text }}>
          {message.body}
        </Text>
      </View>
      <Text style={{ ...type.caption, fontSize: 10, color: colors.textFaint, alignSelf: message.mine ? "flex-end" : "flex-start", marginTop: 2 }}>
        {time}
      </Text>
    </View>
  );
}
