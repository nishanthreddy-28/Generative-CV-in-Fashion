import { Fragment, type PropsWithChildren, type ReactNode } from "react";
import {SafeAreaView} from "react-native-safe-area-context";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Link, type Href, usePathname } from "expo-router";
import { Button } from "./Button";
import { colors, typography } from "../theme/tokens";
import { useSession } from "../features/session";
import { appDestinations, activeDestination } from "../features/navigation";
import { protectedScreenState } from "../services/auth/contracts";
// Legacy screen prop retained temporarily; query parameters never unlock access.
export function usePreview(): boolean { return false; }
export function RouteLink({
  to,
  children,
}: PropsWithChildren<{ to: string; preview?: boolean }>) {
  const href = to as Href;
  return (
    <Link href={href} style={ui.link}>
      {children}
    </Link>
  );
}
const destinationMarks = {"/dashboard":"⌂","/wardrobe":"▤","/catalog":"◇","/outfits":"▱","/settings":"◎"} as const;
const mainTabs = appDestinations.filter(item => item.path !== "/catalog");

export function Screen({
  title,
  subtitle,
  action,
  children,
}: PropsWithChildren<{ title: string; subtitle?: string; action?: ReactNode }>) {
  const {session,accountDeleting}=useSession();
  const path=usePathname();
  const {width}=useWindowDimensions();
  const showNavigation=!!session && !accountDeleting;
  const active=activeDestination(path);
  const accountForm = !session && ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-registration", "/auth-confirm"].includes(path);
  const section = accountForm ? "MEMBER ACCESS" : undefined;
  return (
    <SafeAreaView style={{flex:1,backgroundColor:colors.background}} edges={["top","bottom"]}>
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[ui.screen, accountForm && ui.accountScreen, width < 380 && ui.narrowScreen]}
      >
        {!showNavigation && <View style={ui.top}>
          <Link href={session ? "/dashboard" : "/"} style={ui.brand} accessibilityLabel="Drape and Drop home">DRAPE &amp; DROP</Link>
          {!session && <RouteLink to={path==="/login" ? "/signup" : "/login"}>{path==="/login" ? "Join us" : "Sign in"}</RouteLink>}
        </View>}
        <View style={ui.intro}>
          {section && <Text style={typography.eyebrow}>{section}</Text>}
          <View style={ui.titleRow}>
            <Text accessibilityRole="header" style={[ui.title, showNavigation && ui.appTitle]}>{title}</Text>
            {showNavigation && action}
          </View>
          {!!subtitle && <Text style={ui.body}>{subtitle}</Text>}
        </View>
        {children}
      </ScrollView>
      {showNavigation && <View style={ui.navigation} accessibilityLabel="Main navigation">
        {mainTabs.map((item,index)=>{
          const selected=active===item.path || (active==="/catalog" && item.path==="/wardrobe");
          return <Fragment key={item.path}>
            {index===2 && <Link href="/wardrobe/add" accessibilityLabel="Add wardrobe item" style={ui.navAdd}>+</Link>}
            <Link href={item.path} replace accessibilityLabel={item.label} accessibilityState={{selected}}
              style={[ui.navItem,selected && ui.navActive]}>
              <Text style={ui.navMark}>{destinationMarks[item.path]}</Text>{"\n"}{item.label}
            </Link>
          </Fragment>;
        })}
      </View>}
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Gate({
  admin = false,
  children,
}: PropsWithChildren<{ preview: boolean; admin?: boolean }>) {
  const { session, ready, accountDeleting } = useSession();
  if (accountDeleting) return <Notice title="Account deletion pending" text="Normal application access is disabled."><RouteLink to="/account-deletion">Check deletion progress</RouteLink></Notice>;
  const access = protectedScreenState(false, ready, session?.user.role, admin);
  if (access === "restoring")
    return <ActivityIndicator accessibilityLabel="Restoring session" />;
  if (access === "signed-out")
    return (
      <Notice
        title="Sign in to continue"
        text="Your personal wardrobe and profile require an account."
      >
        <RouteLink to="/login">Sign in</RouteLink>
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
  tone="default",
}: PropsWithChildren<{ title: string; text: string; tone?:"default"|"success"|"error" }>) {
  return (
    <View accessibilityRole={tone==="error" ? "alert" : undefined} accessibilityLiveRegion="polite" style={[ui.notice,tone==="error" && {borderLeftWidth:3,borderLeftColor:colors.error},tone==="success" && {borderLeftWidth:3,borderLeftColor:colors.sage}]}>
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
    <View accessibilityLabel="Loading your data" accessibilityState={{busy:true}} style={ui.card}>
      <View style={ui.row}><ActivityIndicator color={colors.ink}/><Text style={ui.body}>Getting your collection ready…</Text></View>
      <View accessible={false} importantForAccessibility="no-hide-descendants" style={{gap:10}}>
        <View style={[ui.skeleton,{height:18,width:"62%"}]}/><View style={[ui.skeleton,{height:12,width:"92%"}]}/><View style={[ui.skeleton,{height:12,width:"78%"}]}/>
      </View>
    </View>
  ) : error ? (
    <Notice title="Couldn’t load this page" text={error} tone="error">
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
  confirmLabel="Confirm",
}: {
  visible: boolean;
  title: string;
  text: string;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
  confirmLabel?: string;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={()=>{if(!busy)onCancel();}}
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
            label={confirmLabel}
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
  skeleton: {backgroundColor:colors.border,borderRadius:4},
  navigation: {flexDirection:"row",alignItems:"center",backgroundColor:colors.surface,borderTopWidth:1,borderColor:colors.border,paddingHorizontal:8,paddingBottom:6,paddingTop:5,width:"100%",maxWidth:660,alignSelf:"center"},
  navItem: {flex:1,textAlign:"center",fontSize:10,fontWeight:"600",lineHeight:19,color:colors.muted,paddingVertical:6,minHeight:48},
  navActive: {color:colors.ink,fontWeight:"800"},
  navMark: {fontSize:19},
  navAdd: {width:44,height:44,borderRadius:22,overflow:"hidden",backgroundColor:colors.ink,color:colors.surface,fontSize:25,lineHeight:42,textAlign:"center"},
  intro: {gap:8,paddingVertical:4},
  titleRow: {flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:10},
  appTitle: {fontFamily:"System",fontWeight:"800",fontSize:28,lineHeight:34,flexShrink:1},
  screen: {
    padding: 24,
    paddingBottom: 32,
    gap: 17,
    maxWidth: 660,
    width: "100%",
    alignSelf: "center",
  },
  accountScreen: { maxWidth: 440 },
  narrowScreen: { paddingHorizontal: 18 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
    paddingBottom: 9,
  },
  brand: { fontSize: 13, fontWeight:"700", letterSpacing: 2.4, color: colors.ink },
  title: {
    ...typography.editorial,
    fontSize: 36,
    lineHeight: 42,
  },
  heading: { fontSize: 17, fontWeight: "600", color: colors.ink },
  body: { fontSize: 15, lineHeight: 24, color: colors.muted },
  primaryLink: {backgroundColor:colors.accent,color:colors.onAccent,textAlign:"center",padding:14,minHeight:48,fontWeight:"600",borderRadius:4},
  link: {
    color: colors.ink,
    fontSize: 14,
    textDecorationLine: "underline",
    textDecorationColor: colors.accent,
    paddingVertical: 12,
    minHeight: 48,
  },
  notice: {
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius:6,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor:colors.surface,
    borderRadius:6,
    padding:16,
    gap: 12,
  },
  error: { color: colors.error, fontSize: 14, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    minHeight: 50,
    padding: 14,
    borderRadius:4,
    color: colors.ink,
    fontSize: 16,
  },
  field: { gap: 7 },
  inputFocused: { borderColor: colors.accent },
  inputInvalid: { borderColor: colors.error },
  chipLabel: {color: colors.ink,fontSize: 13},
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius:20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  selected: { borderColor: colors.accent, backgroundColor: colors.selected },
  image: { width: "100%", aspectRatio: 0.85, backgroundColor: colors.border },
  overlay: {
    flex: 1,
    width: "100%",
    alignSelf: "center",
    ...(Platform.OS === "web" ? {maxWidth: 480} : {}),
    backgroundColor: colors.scrim,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: colors.surface,
    borderWidth:1,
    borderColor:colors.border,
    borderRadius:8,
    padding: 24,
    gap: 20,
  },
});
