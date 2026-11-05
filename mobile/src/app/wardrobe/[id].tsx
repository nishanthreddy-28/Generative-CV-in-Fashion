import { useLocalSearchParams } from "expo-router";
import { EditorScreen } from "../../features/EditorScreen";
import { garmentFields } from "../../features/schema";
export default function Edit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <EditorScreen
      title="The garment edit."
      path={`/wardrobe/${encodeURIComponent(id)}`}
      fields={garmentFields}
      photo
      allowDelete
      afterSave="/wardrobe"
    />
  );
}
