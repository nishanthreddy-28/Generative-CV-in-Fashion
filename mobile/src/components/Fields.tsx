import {useId,useState} from "react";
import {fieldAutofill} from "../features/presentation";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { atelier } from "../theme/atelier";
import { colors } from "../theme/tokens";
import { ui } from "./Screen";
import type { Field } from "../features/validation";
export function Fields({
  fields,
  values,
  errors,
  onChange,
  disabled = false,
  dark = false,
  editorial = false,
}: {
  fields: Field[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
  dark?: boolean;
  editorial?: boolean;
}) {
  const labelId=useId();
  const [focused,setFocused]=useState<string|null>(null);
  const [shown,setShown]=useState<Record<string,boolean>>({});
  return (
    <>
      {fields.map((f) => (
        <View key={f.key} style={ui.field}>
          <Text nativeID={`${labelId}-${f.key}`} style={[ui.label,editorial && styles.editorialLabel,dark && {color:atelier.ink}]}>
            {f.label}
            {f.required ? " *" : ""}
          </Text>
          {f.options ? (
            <View style={ui.row}>
              {f.options.map((value) => (
                <Pressable
                  key={value}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityLabel={`${f.label}: ${value}`}
                  accessibilityState={{
                    checked: values[f.key] === value,
                    disabled,
                  }}
                  onPress={() => onChange(f.key, value)}
                  style={[ui.chip, values[f.key] === value && ui.selected]}
                >
                  <Text style={ui.chipLabel}>{value}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel={f.label}
              accessibilityLabelledBy={`${labelId}-${f.key}`}
              accessibilityHint={errors[f.key] || f.hint}
              placeholder={f.kind === "email" ? "name@example.com" : undefined}
              placeholderTextColor={dark ? atelier.muted : colors.muted}
              maxLength={f.kind === "multiline" ? 2000 : 200}
              value={values[f.key] ?? ""}
              onChangeText={(v) => onChange(f.key, v)}
              editable={!disabled}
              onFocus={()=>setFocused(f.key)}
              onBlur={()=>setFocused(null)}
              secureTextEntry={f.kind === "password" && !shown[f.key]}
              autoComplete={fieldAutofill(f.key,f.kind,f.passwordPurpose)}
              returnKeyType={f.kind==="multiline" ? "default" : "next"}
              multiline={f.kind === "multiline"}
              autoCapitalize={
                f.kind === "email" || f.kind === "password"
                  ? "none"
                  : "sentences"
              }
              autoCorrect={f.kind !== "email" && f.kind !== "password"}
              keyboardType={
                f.kind === "email"
                  ? "email-address"
                  : f.kind === "number"
                    ? "decimal-pad"
                    : "default"
              }
              style={[
                ui.input,
                styles.input,
                editorial && styles.editorialInput,
                dark && {backgroundColor:atelier.surface,color:atelier.ink,borderColor:focused===f.key ? atelier.accent : atelier.inputBorder},
                f.kind === "password" && styles.password,
                focused===f.key && ui.inputFocused,
                !!errors[f.key] && (dark ? {borderColor:atelier.error} : ui.inputInvalid),
                f.kind === "multiline" && {
                  minHeight: 110,
                  textAlignVertical: "top",
                },
              ]}
            />
            {f.kind === "password" && <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${shown[f.key] ? "Hide" : "Show"} ${f.label.toLowerCase()}`}
              accessibilityState={{disabled}}
              disabled={disabled}
              onPress={() => setShown(state => ({...state, [f.key]: !state[f.key]}))}
              style={({pressed}) => [styles.toggle, pressed && styles.pressed]}
            >
              <Text style={[styles.toggleText,dark && {color:atelier.accent}]}>{shown[f.key] ? "Hide" : "Show"}</Text>
            </Pressable>}
            </View>
          )}
          {Boolean(f.hint) && <Text style={ui.body}>{f.hint}</Text>}
          {Boolean(errors[f.key]) && (
            <Text accessibilityRole="alert" style={[ui.error,dark && {color:atelier.error}]}>
              {errors[f.key]}
            </Text>
          )}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  inputRow: {position: "relative"},
  input: {width: "100%"},
  editorialLabel: {fontSize:12,letterSpacing:0.4},
  editorialInput: {borderRadius:0,minHeight:50,fontSize:16},
  password: {paddingRight: 72},
  toggle: {position: "absolute", top: 0, bottom: 0, right: 0, minWidth: 56, paddingHorizontal: 10, justifyContent: "center", alignItems: "center"},
  toggleText: {color: colors.accent, fontSize: 13, fontWeight: "600"},
  pressed: {opacity: 0.7},
});
