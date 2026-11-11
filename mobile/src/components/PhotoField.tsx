import { colors } from "../theme/tokens";
import {FramedImage} from "./FramedImage";
import { useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Button } from "./Button";
import { ui } from "./Screen";
export type Photo = { uri: string; name: string; type: string; file?: File };
export function PhotoField({
  label,
  value,
  onChange,
  disabled = false,
  camera = false,
}: {
  label: string;
  value: Photo | null;
  onChange: (photo: Photo | null) => void;
  disabled?: boolean;
  camera?: boolean;
}) {
  const [error, setError] = useState("");
  const [picking,setPicking]=useState(false);
  async function pick(source: "library" | "camera") {
    if(picking || disabled)return;
    setPicking(true);
    setError("");
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError("Camera access is off. Allow it in device settings or upload a photo.");
          return;
        }
      }
      const launch = source === "camera" ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launch({
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
    } finally {setPicking(false);}
  }
  return (
    <View style={{ gap: 12 }}>
      <Text style={ui.label}>{label}</Text>
      {!value && <View style={[styles.photoArea,camera && styles.captureArea]}>
        {camera && <Text style={styles.captureMark} accessible={false}>⌑</Text>}
        <Text style={ui.heading}>Choose a garment photo</Text>
        <Text style={styles.photoHint}>Frame one piece at a time.</Text>
      </View>}
      {value && (
        <FramedImage
          label={label}
          source={{ uri: value.uri }}
          ratio={1}
          contain
        />
      )}
      <Button
        label={value ? "Replace photo" : camera ? "Upload photo" : "Choose photo"}
        onPress={() => void pick("library")}
        loading={picking}
        disabled={disabled || picking}
        variant="secondary"
      />
      {camera && Platform.OS !== "web" && (
        <Button label="Take photo" variant="secondary" onPress={() => void pick("camera")} disabled={disabled || picking} />
      )}
      {value && (
        <Button
          label="Remove selected photo"
          variant="secondary"
          onPress={() => onChange(null)}
          disabled={disabled || picking}
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
const styles = StyleSheet.create({
  photoArea:{aspectRatio:1.5,borderWidth:1,borderStyle:"dashed",borderColor:colors.inputBorder,
    backgroundColor:colors.surface,alignItems:"center",justifyContent:"center",padding:16,gap:6,borderRadius:16},
  captureArea:{backgroundColor:"#FFDBC0",borderColor:"#AC7352"},
  captureMark:{fontSize:28,lineHeight:32,color:colors.ink},
  photoHint:{fontSize:13,color:colors.muted,textAlign:"center"},
});
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
