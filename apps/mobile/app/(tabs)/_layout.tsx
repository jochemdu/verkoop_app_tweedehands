import { Redirect, Tabs } from "expo-router";
import { useSession } from "@/lib/auth/useSession";
import { useOutboxSync } from "@/lib/outbox/sync";

export default function TabsLayout() {
  const { session, loading } = useSession();
  // Flusht de offline-wachtrij bij online-worden/foreground en houdt de
  // pending-teller bij (fase 33).
  const { pending } = useOutboxSync();
  if (!loading && !session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{ headerTitle: "VerkoopAssistent" }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen
        name="capture"
        options={{
          title: "Indexeren",
          tabBarBadge: pending > 0 ? pending : undefined,
        }}
      />
      <Tabs.Screen name="import" options={{ title: "Importeren" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventaris" }} />
      <Tabs.Screen name="listings" options={{ title: "Advertenties" }} />
    </Tabs>
  );
}
