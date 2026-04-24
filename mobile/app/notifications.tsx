import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { io } from "socket.io-client";
import { AppCard } from "./_components/ui/AppCard";
import { PrimaryButton } from "./_components/PrimaryButton";
import { ScreenHeader } from "./_components/ui/ScreenHeader";
import { ScreenFixed } from "./_components/ui/ScreenShell";
import { getApiBaseUrl } from "./_state/api";
import { getAuthSession } from "./_state/authSession";
import { getDriverSession } from "./_state/driverSession";
import { BrandColors } from "./_theme/colors";
import { Layout, Radii, ScreenBg, Space } from "./_theme/tokens";

type NotificationItem = {
  _id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt?: string;
};

function normalizeNotification(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const id = String(src._id ?? src.id ?? "").trim();
  const userId = String(src.userId ?? "").trim();
  if (!id || !userId) return null;
  return {
    _id: id,
    userId,
    type: String(src.type ?? "general"),
    title: String(src.title ?? "Notification"),
    message: String(src.message ?? ""),
    read: !!src.read,
    createdAt: src.createdAt ? String(src.createdAt) : undefined,
  };
}

function normalizeNotificationArray(raw: unknown): NotificationItem[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object"
      ? ((raw as { notifications?: unknown; data?: unknown; value?: unknown }).notifications ??
        (raw as { notifications?: unknown; data?: unknown; value?: unknown }).data ??
        (raw as { notifications?: unknown; data?: unknown; value?: unknown }).value ??
        [])
      : [];
  if (!Array.isArray(list)) return [];
  return list.map(normalizeNotification).filter((n): n is NotificationItem => !!n);
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>("");
  const [sessionUserId, setSessionUserId] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getAuthSession();
      const ds = await getDriverSession();
      const authUserId = String(s?.user?.id ?? "").trim();
      const driverId = String(ds?.driverId ?? "").trim();
      const candidateIds = Array.from(new Set([authUserId, driverId].filter(Boolean)));
      const userId = candidateIds[0] ?? "";
      setSessionUserId(userId);
      if (!userId) {
        setItems([]);
        return;
      }
      const collected: NotificationItem[] = [];
      for (const id of candidateIds) {
        const res = await fetch(`${getApiBaseUrl()}/api/notifications?userId=${encodeURIComponent(id)}`);
        const body = await res.json().catch(() => []);
        if (!res.ok) throw new Error((body as { message?: string })?.message || "Failed to load notifications");
        collected.push(...normalizeNotificationArray(body));
      }
      const unique = new Map<string, NotificationItem>();
      for (const item of collected) unique.set(item._id, item);
      setItems(
        Array.from(unique.values()).sort(
          (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        )
      );
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!sessionUserId) return;
    const socket = io(getApiBaseUrl(), { transports: ["websocket"], forceNew: true });
    socket.on("notificationCreated", (payload: unknown) => {
      const incoming = normalizeNotification(payload);
      if (!incoming) return;
      if (incoming.userId !== sessionUserId) return;
      setItems((prev) => {
        if (prev.some((n) => n._id === incoming._id)) return prev;
        return [incoming, ...prev];
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [sessionUserId]);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const markRead = async (id: string) => {
    try {
      setBusyId(id);
      const res = await fetch(`${getApiBaseUrl()}/api/notifications/${encodeURIComponent(id)}/read`, {
        method: "PUT",
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || "Failed to mark as read");
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to mark as read");
    } finally {
      setBusyId("");
    }
  };

  const remove = async (id: string) => {
    try {
      setBusyId(id);
      const res = await fetch(`${getApiBaseUrl()}/api/notifications/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || "Failed to delete notification");
      setItems((prev) => prev.filter((n) => n._id !== id));
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete notification");
    } finally {
      setBusyId("");
    }
  };

  return (
    <ScreenFixed style={styles.screen}>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <ScreenHeader showBack title="Notifications" subtitle={`${unreadCount} unread`} />
          <PrimaryButton title={loading ? "Refreshing..." : "Refresh"} onPress={() => void load()} />
        </View>
        {items.length === 0 ? (
          <Text style={styles.empty}>No notifications yet. Login, booking, and payment events will appear here.</Text>
        ) : (
          items.map((item) => (
            <AppCard key={item._id} style={styles.card} padded>
              <View style={styles.rowTop}>
                <View style={[styles.dot, item.read && styles.dotRead]} />
                <Text style={styles.title}>{item.title || "Notification"}</Text>
              </View>
              <Text style={styles.msg}>{item.message}</Text>
              <Text style={styles.meta}>
                {item.type || "general"} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
              </Text>
              <View style={styles.actions}>
                {!item.read ? (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => void markRead(item._id)}
                    disabled={busyId === item._id}
                  >
                    <Ionicons name="checkmark-done-outline" size={16} color={BrandColors.primaryDark} />
                    <Text style={styles.actionText}>Mark read</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => void remove(item._id)}
                  disabled={busyId === item._id}
                >
                  <Ionicons name="trash-outline" size={16} color="#C0392B" />
                  <Text style={[styles.actionText, { color: "#C0392B" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>
    </ScreenFixed>
  );
}

const styles = StyleSheet.create({
  screen: {
    paddingHorizontal: 0,
  },
  topBar: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: 0,
    paddingBottom: Space.sm,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
    backgroundColor: ScreenBg.light,
  },
  list: {
    paddingHorizontal: Layout.screenPaddingX - 2,
    paddingTop: Space.xs,
    paddingBottom: Space.xl,
    maxWidth: Layout.contentMaxWidth,
    alignSelf: "center",
    width: "100%",
    flexGrow: 1,
    backgroundColor: ScreenBg.light,
  },
  card: { marginBottom: Space.md, borderRadius: Radii.lg },
  rowTop: { flexDirection: "row", alignItems: "center", gap: Space.xs },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BrandColors.primary },
  dotRead: { backgroundColor: BrandColors.textMuted },
  title: { fontSize: 15, fontWeight: "800", color: BrandColors.textDark },
  msg: { marginTop: 6, fontSize: 13, color: BrandColors.textDark, lineHeight: 19 },
  meta: { marginTop: 6, fontSize: 11, color: BrandColors.textMuted, fontWeight: "600" },
  actions: { flexDirection: "row", gap: Space.sm, marginTop: Space.sm },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: Radii.md,
    borderWidth: 1,
    borderColor: BrandColors.border,
    backgroundColor: BrandColors.surfaceMuted,
  },
  actionText: { fontSize: 12, fontWeight: "700", color: BrandColors.primaryDark },
  empty: {
    marginTop: Space.xl,
    textAlign: "center",
    color: BrandColors.textMuted,
    lineHeight: 20,
    fontSize: 14,
    paddingHorizontal: 8,
  },
});
