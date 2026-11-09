import type { PropsWithChildren } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, type Href, useLocalSearchParams } from "expo-router";
import { Button } from "./Button";
import { colors } from "../theme/tokens";
import { useSession } from "../features/session";
import { protectedScreenState } from "../services/auth/contracts";
export function usePreview() {
  const p = useLocalSearchParams<{ preview?: string }>();
  return p.preview === "1";
}
export function RouteLink({
  to,
  children,
  preview = false,
}: PropsWithChildren<{ to: string; preview?: boolean }>) {
  const href = (
    preview ? `${to}${to.includes("?") ? "&" : "?"}preview=1` : to
  ) as Href;
  return (
    <Link href={href} style={ui.link}>
      {children}
    </Link>
  );
}
export function Screen({
  title,
  subtitle,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string }>) {
  const preview = usePreview();
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={ui.screen}
      >
        <View style={ui.top}>
          <Text style={ui.brand}>DRAPE & DROP</Text>
          <RouteLink to="/preview">Workflows</RouteLink>
        </View>
        {preview && (
          <Notice
            title="WORKFLOW PREVIEW"
            text="No account, records, or backend requests. Drafts stay in memory while navigating; closing the app clears them."
          />
        )}
        <Text accessibilityRole="header" style={ui.title}>
          {title}
        </Text>
        {Boolean(subtitle) && <Text style={ui.body}>{subtitle}</Text>}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function Gate({
  preview,
  admin = false,
  children,
}: PropsWithChildren<{ preview: boolean; admin?: boolean }>) {
  const { session, ready, accountDeleting } = useSession();
  if (accountDeleting && !preview) return <Notice title="Account deletion pending" text="Normal application access is disabled."><RouteLink to="/account-deletion">Check deletion progress</RouteLink></Notice>;
  const access = protectedScreenState(preview, ready, session?.user.role, admin);
  if (access === "restoring")
    return <ActivityIndicator accessibilityLabel="Restoring session" />;
  if (access === "signed-out")
    return (
      <Notice
        title="Sign in to continue"
        text="Your personal wardrobe and profile require an account."
      >
        <RouteLink to="/login">Sign in</RouteLink>
        <RouteLink to="/preview">Review frontend workflows</RouteLink>
      </Notice>
    );
  if (access === "forbidden")
    return (
      <Notice
        title="Administrator access required"
        text="Catalog management is only available to authorized administrators."
      />
    );
  return <>{children}</>;
}
export function Notice({
  title,
  text,
  children,
}: PropsWithChildren<{ title: string; text: string }>) {
  return (
    <View accessibilityRole="alert" style={ui.notice}>
      <Text style={ui.heading}>{title}</Text>
      <Text style={ui.body}>{text}</Text>
      {children}
    </View>
  );
}
export function ResourceState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return loading ? (
    <View style={ui.row}>
      <ActivityIndicator color={colors.ink} />
      <Text style={ui.body}>Loading your data…</Text>
    </View>
  ) : error ? (
    <Notice title="Unable to load" text={error}>
      <Button label="Try again" onPress={retry} variant="secondary" />
    </Notice>
  ) : null;
}
export function Confirm({
  visible,
  title,
  text,
  onCancel,
  onConfirm,
  busy = false,
}: {
  visible: boolean;
  title: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={ui.overlay}>
        <View accessibilityViewIsModal style={ui.dialog}>
          <Text accessibilityRole="header" style={ui.heading}>
            {title}
          </Text>
          <Text style={ui.body}>{text}</Text>
          <Button
            label="Cancel"
            onPress={onCancel}
            disabled={busy}
            variant="secondary"
          />
          <Button
            label="Confirm"
            onPress={onConfirm}
            loading={busy}
            variant="danger"
          />
        </View>
      </View>
    </Modal>
  );
}
export const ui = StyleSheet.create({
  screen: {
    padding: 24,
    paddingBottom: 64,
    gap: 22,
    maxWidth: 660,
    width: "100%",
    alignSelf: "center",
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: 20,
  },
  brand: { fontSize: 13, letterSpacing: 2, color: colors.ink },
  title: {
    fontSize: 36,
    lineHeight: 42,
    fontFamily: "serif",
    color: colors.ink,
  },
  heading: { fontSize: 17, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted },
  link: {
    color: colors.ink,
    fontSize: 14,
    textDecorationLine: "underline",
    paddingVertical: 12,
    minHeight: 48,
  },
  notice: {
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    backgroundColor: "#F0EEE7",
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  card: {
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingVertical: 18,
    gap: 12,
  },
  error: { color: colors.error, fontSize: 14, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 52,
    padding: 14,
    color: colors.ink,
    fontSize: 16,
  },
  field: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
  },
  selected: { borderColor: colors.ink, backgroundColor: "#E5E4DC" },
  image: { width: "100%", aspectRatio: 0.85, backgroundColor: colors.border },
  overlay: {
    flex: 1,
    backgroundColor: "#0009",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.background,
    padding: 24,
    gap: 20,
  },
});
