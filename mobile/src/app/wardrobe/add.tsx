import { EditorScreen } from "../../features/EditorScreen";
import { garmentFields } from "../../features/schema";
export default function Add() {
  return (
    <EditorScreen
      title="Add to your wardrobe."
      subtitle="Choose a photo, then describe your piece. Automated classification is not connected yet."
      path="/wardrobe"
      fields={garmentFields}
      create
      photo
      afterSave="/wardrobe"
    />
  );
}
