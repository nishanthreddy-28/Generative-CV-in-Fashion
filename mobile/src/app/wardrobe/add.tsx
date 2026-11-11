import { Platform } from "react-native";
import { EditorScreen } from "../../features/EditorScreen";
import { garmentFields } from "../../features/schema";

export default function Add() {
  return (
    <EditorScreen
      title="Add a piece"
      subtitle={Platform.OS === "web" ? "Upload a photo, then enter the piece details." : "Take or choose a photo, then enter the piece details."}
      path="/wardrobe"
      fields={garmentFields}
      create
      photo
      wardrobeEntry
      afterSave="/wardrobe"
    />
  );
}
