import { Redirect, Tabs } from "expo-router";
import { useSession } from "@/lib/auth/useSession";

export default function TabsLayout() {
  const { session, loading } = useSession();
  if (!loading && !session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs screenOptions={{ headerTitle: "VerkoopAssistent" }}>
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="capture" options={{ title: "Indexeren" }} />
      <Tabs.Screen name="inventory" options={{ title: "Inventaris" }} />
    </Tabs>
  );
}
