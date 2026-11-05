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
              value={values[f.key] ?? ""}
              onChangeText={(v) => onChange(f.key, v)}
              editable={!disabled}
              secureTextEntry={f.kind === "password"}
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
