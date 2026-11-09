import { useEffect, useState } from 'react';
import { Linking as NativeLinking, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { Screen, Notice, RouteLink, ui } from '../components/Screen';
import { Fields } from '../components/Fields';
import { passwordIssue } from '../services/auth/passwordPolicy';
import { type Field, validate } from '../features/validation';
import { colors } from '../theme/tokens';
import { Button } from '../components/Button';
import { pendingRegistration, retainRegistration } from '../services/auth/registrationStorage';
import { registrationLink, registrationOrigin, registrationRequest, validBinding, type RegistrationBinding } from '../services/auth/registration';
const localPreview = __DEV__ && process.env.EXPO_PUBLIC_LOCAL_PREVIEW === "true";
const base = process.env.EXPO_PUBLIC_REGISTRATION_API_URL ?? '';
const enabled = process.env.EXPO_PUBLIC_REVIEW_ONLY !== 'true' && !!registrationOrigin(base, localPreview);
const passwordFields: Field[] = [
  {key:'password', label:'Password', kind:'password', passwordPurpose:'new', required:true},
  {key:'confirm', label:'Confirm password', kind:'password', passwordPurpose:'new', required:true},
];

export default function VerifyRegistration() {
  const [binding,setBinding] = useState<RegistrationBinding|null>(null);
  const [ready,setReady] = useState(false);
  const [link,setLink] = useState('');
  const [code,setCode] = useState('');
  const [stage,setStage] = useState<'link'|'code'|'finalizing'|'complete'>('link');
  const [passwords,setPasswords] = useState<Record<string,string>>({});
  const [errors,setErrors] = useState<Record<string,string>>({});
  const [busy,setBusy] = useState(false);
  const [showRestart,setShowRestart] = useState(false);
  const [message,setMessage] = useState('');
  useEffect(()=>{
    let mounted=true;
    void (async()=>{
      const value=await pendingRegistration();
      if(!mounted)return;
      setBinding(value);
      if (Platform.OS === 'web' && window.location.hash) setLink(window.location.href);
      if(enabled && value) {
        try {
          const result=await registrationRequest<{status:string}>(base,'status',value,localPreview);
          if(!mounted)return;
          if(result.status==='complete') {await retainRegistration(null);setBinding(null);setStage('complete');}
          else if(result.status==='finalizing')setStage('finalizing');
          else if(result.status==='link_verified')setStage('code');
          else if(['expired','locked','superseded'].includes(result.status))setMessage('This verification has expired or cannot be used. Request a new email.');
        } catch {if(mounted){setShowRestart(true);setMessage('We couldn’t restore this attempt. Try your latest link or start again.');}}
      }
      if(mounted)setReady(true);
    })();
    return()=>{mounted=false;};
  },[]);
  async function run(operation:'link'|'verify'|'finalize'|'resend') {
    if(!binding || busy || !enabled)return;
    setBusy(true);setMessage('');
    try {
      if(operation==='link') {
        const origin = Platform.OS==='web' ? window.location.origin : process.env.EXPO_PUBLIC_REGISTRATION_WEB_ORIGIN ?? '';
        const proof = registrationLink(link,origin);
        if(!proof || proof.attemptId!==binding.attemptId)throw new Error('Paste the complete link from your latest email in the tab where you registered.');
        const result = await registrationRequest<{status:string}>(base,'link',{...binding,link:proof.link},localPreview);
        if (result.status !== 'link_verified') throw new Error('Unexpected verification response.');
        setLink('');setStage('code');
        // Remove the emailed secret from the current history entry after explicit consumption.
        if(Platform.OS==='web')window.history.replaceState(window.history.state,'','/verify-registration');
      } else if(operation==='verify') {
        if(!/^[0-9]{6}$/.test(code))throw new Error('Enter the six-digit code from your latest email.');
        const result = await registrationRequest<{status:string}>(base,'verify',{...binding,code},localPreview);
        if (result.status !== 'finalizing') throw new Error('Unexpected verification response.');
        setCode('');setStage('finalizing');
      } else if(operation==='finalize') {
        const issues = validate(passwordFields,passwords);
        const passwordError = passwordIssue(passwords.password ?? '');
        if (passwordError && !issues.password) issues.password = passwordError;
        if (passwords.password !== passwords.confirm) issues.confirm = 'Passwords must match.';
        setErrors(issues);
        if (Object.keys(issues).length) return;
        const result = await registrationRequest<{status:string}>(base,'finalize',{
          ...binding,password:passwords.password,confirmPassword:passwords.confirm,
        },localPreview);
        if (result.status !== 'complete') throw new Error('Unexpected verification response.');
        setStage('complete');setBinding(null);setPasswords({});
        await retainRegistration(null);
      } else {
        const next=await registrationRequest<RegistrationBinding & {message?:string}>(base,'resend',binding,localPreview);
        if(!validBinding(next))throw new Error('Unexpected verification response.');
        await retainRegistration(next);setBinding(next);setCode('');setLink('');setStage('link');setMessage(next.message ?? 'Check your inbox for the new link and code.');
      }
    } catch(error){setMessage(error instanceof Error ? error.message : 'Unable to verify. Please try again.');}
    finally{setBusy(false);}
  }
  return <Screen title="Check your inbox." subtitle="Confirm your email to open your personal wardrobe.">
    <View style={ui.card}>
      {localPreview && enabled && stage !== 'complete' && <>
        <Text style={ui.body}>Local preview emails appear in the test inbox.</Text>
        <Button label="Open test inbox" variant="secondary" onPress={()=>void NativeLinking.openURL('http://127.0.0.1:54324/')}/>
      </>}
      {stage==='complete' ? <Notice tone="success" title="Your email is verified" text="Your account is ready. Sign in with your email and password."/> :
      !enabled ? <Notice title="Verification opens soon" text="Account verification is being connected. No account action has been submitted."/> :
      !ready ? <Text style={ui.body}>Restoring your registration…</Text> :
      !binding ? <Notice title="Return to your registration tab" text="For your security, complete verification in the tab where you created your account. Paste the email link there; keep your code private."/> : <>
        <View style={styles.progress} accessibilityLabel={stage === 'link' ? 'Step 1 of 2' : 'Step 2 of 2'}>
          <Text style={[styles.step, stage === 'link' && styles.current]}>01 · Email link</Text>
          <Text style={[styles.step, stage !== 'link' && styles.current]}>02 · Security code</Text>
        </View>
        {stage==='link' && <>
          <Text style={ui.body}>Copy the link from step 1 of your latest email and paste it here. Enter the code only after the link is confirmed.</Text>
          <TextInput accessibilityLabel="Email verification link" placeholder="Paste verification link" placeholderTextColor={colors.muted} style={ui.input} value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} editable={!busy} maxLength={1000}/>
          <Button label="Confirm email link" loading={busy} onPress={()=>void run('link')}/>
        </>}
        {stage==='code' && <>
          <Text style={ui.body}>Your link is confirmed. Enter the separate six-digit code from the same email.</Text>
          <TextInput accessibilityLabel="Six-digit verification code" style={ui.input} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!busy}/>
          <Button label="Verify code" loading={busy} onPress={()=>void run('verify')}/>
        </>}
        {stage==='finalizing' && <>
          <Text style={ui.body}>Your email is verified. Choose a password to finish creating your account.</Text>
          <Fields fields={passwordFields} values={passwords} errors={errors} disabled={busy}
            onChange={(key,value)=>{setPasswords(previous=>({...previous,[key]:value}));setErrors(previous=>({...previous,[key]:''}));}} />
          <Button label="Create account" loading={busy} onPress={()=>void run('finalize')}/>
        </>}
        {stage!=='finalizing' && <Button label="Request a new email" variant="secondary" disabled={busy} onPress={()=>void run('resend')}/>}
        <Text style={ui.body}>Links and codes expire after 10 minutes. A new email replaces the previous one.</Text>
      </>}
      {!!message && <Text accessibilityLiveRegion="polite" style={ui.body}>{message}</Text>}
      {(showRestart || !binding || stage === "link") && stage !== "complete" && <RouteLink to="/signup">Start a new registration</RouteLink>}
      <RouteLink to="/login">Back to sign in</RouteLink>
    </View>
  </Screen>;
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { flexGrow: 1, padding: 12, borderRadius:4, borderWidth: 1, borderColor: colors.border, color: colors.ink },
  current: { backgroundColor: colors.selected, borderColor: colors.accent, color: colors.ink },
});
