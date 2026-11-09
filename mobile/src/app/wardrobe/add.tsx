import { Platform, Text, View } from "react-native";
import { EditorScreen } from "../../features/EditorScreen";
import { garmentFields } from "../../features/schema";
import { ui } from "../../components/Screen";

function EntryMethods() {
  return (
    <View style={ui.card}>
      <Text style={ui.heading}>Camera / Upload</Text>
      <Text style={ui.body}>
        {Platform.OS === "web" ? "Upload a photo from this device." : "Take a photo or choose one from your library."}
        {" "}Then review and enter the garment details. Automatic classification is not connected.
      </Text>
      <View style={{gap:5}}>
        <Text style={ui.label}>Product link · Unavailable</Text>
        <Text style={ui.body}>Store links can’t be imported yet. You can upload a photo and enter the details yourself.</Text>
      </View>
    </View>
  );
}

export default function Add() {
  return (
    <EditorScreen
      title="Add an item"
      subtitle="Start with a photo, then make the details yours."
      path="/wardrobe"
      fields={garmentFields}
      create
      photo
      wardrobeEntry={<EntryMethods />}
      afterSave="/wardrobe"
    />
  );
}
