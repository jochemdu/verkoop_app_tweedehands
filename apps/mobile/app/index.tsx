import { View, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useSession } from "@/lib/auth/useSession";

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return <Redirect href={session ? "/(tabs)" : "/(auth)/login"} />;
}
