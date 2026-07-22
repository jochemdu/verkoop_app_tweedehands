import { Redirect, Tabs } from "expo-router";
import { useSession } from "@/lib/auth/useSession";
import { useOutboxSync } from "@/lib/outbox/sync";
import { useTranslation, useSyncLocaleFromProfile } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const { session, loading } = useSession();
  const t = useTranslation("mobile");
  const theme = useTheme();
  // Volgt de op de web-app gekozen taal (profiles.display_language).
  useSyncLocaleFromProfile(session?.user.id);
  // Flusht de offline-wachtrij bij online-worden/foreground en houdt de
  // pending-teller bij (fase 33).
  const { pending } = useOutboxSync();
  if (!loading && !session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerTitle: t("appName"),
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        headerStyle: { backgroundColor: theme.colors.card },
        headerTitleStyle: { color: theme.colors.foreground },
        headerTintColor: theme.colors.accent,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
        },
        sceneStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("tabDashboard") }} />
      <Tabs.Screen
        name="capture"
        options={{
          title: t("tabIndex"),
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen name="batch-scan" options={{ title: t("tabBatch") }} />
      <Tabs.Screen name="import" options={{ title: t("tabImport") }} />
      <Tabs.Screen name="inventory" options={{ title: t("tabInventory") }} />
      <Tabs.Screen name="listings" options={{ title: t("tabListings") }} />
    </Tabs>
  );
}
