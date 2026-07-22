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
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";

const REDIRECT_URL = Linking.createURL("/auth/callback");

export default function LoginScreen() {
  const t = useTranslation("mobile");
  const theme = useTheme();
  const c = theme.colors;
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
        if (error) Alert.alert(t("loginFailed"), error.message);
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
      Alert.alert(t("error"), error.message);
      return;
    }
    setSent(true);
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: c.background }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: c.card, borderColor: c.border },
          theme.shadow,
        ]}
      >
        <View style={[styles.brand, { backgroundColor: c.accent }]}>
          <Text style={[styles.brandText, { color: c.accentForeground }]}>VA</Text>
        </View>
        <Text style={[styles.title, { color: c.foreground }]}>{t("appName")}</Text>
        <Text style={[styles.subtitle, { color: c.mutedForeground }]}>
          {t("loginSubtitle")}
        </Text>

        {sent ? (
          <View style={[styles.sentBox, { backgroundColor: c.accentSoft }]}>
            <Text style={{ color: c.foreground }}>{t("loginCheckInbox")}</Text>
          </View>
        ) : (
          <>
            <TextInput
              style={[
                styles.input,
                { borderColor: c.border, color: c.foreground, backgroundColor: c.background },
              ]}
              placeholderTextColor={c.mutedForeground}
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChangeText={setEmail}
              editable={!sending}
            />
            <Pressable
              style={[
                styles.button,
                { backgroundColor: c.accent },
                sending && { opacity: 0.5 },
              ]}
              disabled={sending || !email}
              onPress={sendMagicLink}
            >
              {sending ? (
                <ActivityIndicator color={c.accentForeground} />
              ) : (
                <Text style={[styles.buttonText, { color: c.accentForeground }]}>
                  {t("sendMagicLink")}
                </Text>
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
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  brand: {
    alignSelf: "center",
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  brandText: { fontSize: 18, fontWeight: "800" },
  title: { fontSize: 24, fontWeight: "700", textAlign: "center" },
  subtitle: { textAlign: "center", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  button: {
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { fontSize: 16, fontWeight: "600" },
  sentBox: {
    borderRadius: 10,
    padding: 16,
  },
});
