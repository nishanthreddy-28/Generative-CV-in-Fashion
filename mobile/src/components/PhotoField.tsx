import { useState } from "react";
import { Image, Platform, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "./Button";
import { ui } from "./Screen";
export type Photo = { uri: string; name: string; type: string; file?: File };
export function PhotoField({
  label,
  value,
  onChange,
  disabled = false,
}: {
  label: string;
  value: Photo | null;
  onChange: (photo: Photo | null) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState("");
  async function pick() {
    setError("");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (result.canceled) return;
      const a = result.assets[0];
      if (a.fileSize && a.fileSize > 10 * 1024 * 1024) {
        setError("Choose an image smaller than 10 MB.");
        return;
      }
      const type = a.mimeType ?? "image/jpeg";
      if (!["image/jpeg", "image/png", "image/webp"].includes(type)) {
        setError("Choose a JPEG, PNG, or WebP image.");
        return;
      }
      onChange({
        uri: a.uri,
        name: a.fileName ?? "garment.jpg",
        type,
        file: a.file,
      });
    } catch {
      setError("Photo selection is unavailable. Please try again.");
    }
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.label}>{label}</Text>
      {value && (
        <Image
          accessibilityLabel={label}
          source={{ uri: value.uri }}
          style={[ui.image, { aspectRatio: 1 }]}
        />
      )}
      <Button
        label={value ? "Replace photo" : "Choose photo"}
        onPress={pick}
        disabled={disabled}
        variant="secondary"
      />
      {value && (
        <Button
          label="Remove selected photo"
          variant="secondary"
          onPress={() => onChange(null)}
          disabled={disabled}
        />
      )}
      <Text style={ui.body}>
        JPEG, PNG or WebP · up to 10 MB. Selected photos are not uploaded until
        you submit.
      </Text>
      {Boolean(error) && (
        <Text accessibilityRole="alert" style={ui.error}>
          {error}
        </Text>
      )}
    </View>
  );
}
export function appendPhoto(form: FormData, key: string, photo: Photo) {
  if (Platform.OS === "web") {
    if (!photo.file)
      throw new Error("Choose this photo again before uploading.");
    form.append(key, photo.file, photo.name);
  } else
    form.append(key, {
      uri: photo.uri,
      name: photo.name,
      type: photo.type,
    } as unknown as Blob);
}
