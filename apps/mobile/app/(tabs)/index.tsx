import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/lib/auth/useSession";

export default function Dashboard() {
  const { session, signOut } = useSession();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.label}>Ingelogd als</Text>
        <Text style={styles.email}>{session?.user.email ?? "onbekend"}</Text>
      </View>
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Fase 1 — Foundation ✅</Text>
        <Text style={styles.infoText}>
          De volgende fase implementeert het sticker-systeem (PLAN (1).md sectie 3).
        </Text>
      </View>
      <Pressable style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Uitloggen</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, gap: 16 },
  card: { borderWidth: 1, borderColor: "#e4e4e7", borderRadius: 12, padding: 16 },
  label: { color: "#71717a", fontSize: 12 },
  email: { fontSize: 18, fontWeight: "500", marginTop: 4 },
  infoCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#d4d4d8",
    borderRadius: 12,
    padding: 16,
  },
  infoTitle: { fontWeight: "600" },
  infoText: { color: "#71717a", marginTop: 4, fontSize: 13 },
  button: {
    marginTop: "auto",
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  buttonText: { fontSize: 15 },
});
