import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import * as Linking from "expo-linking";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";

const REDIRECT_URL = Linking.createURL("/auth/callback");

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Handler voor deep link vanuit magic-link email.
    const handleUrl = async ({ url }: { url: string }) => {
      const { queryParams, hostname } = Linking.parse(url);
      if (hostname !== "auth" && !url.includes("auth/callback")) return;

      const tokenHash = queryParams?.token_hash as string | undefined;
      const type = (queryParams?.type as string | undefined) ?? "magiclink";
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          type: type as any,
        });
        if (error) Alert.alert("Login mislukt", error.message);
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) void handleUrl({ url });
    });
    const sub = Linking.addEventListener("url", handleUrl);
    return () => sub.remove();
  }, []);

  async function sendMagicLink() {
    setSending(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: REDIRECT_URL },
    });
    setSending(false);
    if (error) {
      Alert.alert("Error", error.message);
      return;
    }
    setSent(true);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>VerkoopAssistent</Text>
        <Text style={styles.subtitle}>
          Log in met een magic link in je inbox.
        </Text>

        {sent ? (
          <View style={styles.sentBox}>
            <Text>Check je inbox. Tik op de link om in te loggen.</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="jij@voorbeeld.nl"
              value={email}
              onChangeText={setEmail}
              editable={!sending}
            />
            <Pressable
              style={[styles.button, sending && { opacity: 0.5 }]}
              disabled={sending || !email}
              onPress={sendMagicLink}
            >
              {sending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Stuur magic link</Text>
              )}
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 20 },
  card: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 12,
    padding: 24,
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: "600", textAlign: "center" },
  subtitle: { color: "#71717a", textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#e4e4e7",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#18181b",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  sentBox: {
    backgroundColor: "#f4f4f5",
    borderRadius: 8,
    padding: 16,
  },
});
