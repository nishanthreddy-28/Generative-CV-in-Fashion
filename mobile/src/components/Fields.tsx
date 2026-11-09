import {useState} from "react";
import {fieldAutofill} from "../features/presentation";
import { Pressable, Text, TextInput, View } from "react-native";
import { ui } from "./Screen";
import type { Field } from "../features/validation";
export function Fields({
  fields,
  values,
  errors,
  onChange,
  disabled = false,
}: {
  fields: Field[];
  values: Record<string, string>;
  errors: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}) {
  const [shown,setShown]=useState<Record<string,boolean>>({});
  return (
    <>
      {fields.map((f) => (
        <View key={f.key} style={ui.field}>
          <Text nativeID={`${f.key}-label`} style={ui.label}>
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
                  <Text>{value}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <TextInput
              accessibilityLabel={f.label}
              accessibilityLabelledBy={`${f.key}-label`}
              accessibilityHint={errors[f.key] || f.hint}
              maxLength={f.kind === "multiline" ? 2000 : 200}
              value={values[f.key] ?? ""}
              onChangeText={(v) => onChange(f.key, v)}
              editable={!disabled}
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
                f.kind === "multiline" && {
                  minHeight: 110,
                  textAlignVertical: "top",
                },
              ]}
            />
          )}
          {f.kind==="password" && <Pressable accessibilityRole="button" accessibilityLabel={`${shown[f.key] ? "Hide" : "Show"} ${f.label.toLowerCase()}`} accessibilityState={{disabled}} disabled={disabled} onPress={()=>setShown(state=>({...state,[f.key]:!state[f.key]}))} style={{minHeight:44,justifyContent:"center",alignSelf:"flex-end",paddingHorizontal:8}}><Text style={ui.label}>{shown[f.key] ? "Hide password" : "Show password"}</Text></Pressable>}
          {Boolean(f.hint) && <Text style={ui.body}>{f.hint}</Text>}
          {Boolean(errors[f.key]) && (
            <Text accessibilityRole="alert" style={ui.error}>
              {errors[f.key]}
            </Text>
          )}
        </View>
      ))}
    </>
  );
}
