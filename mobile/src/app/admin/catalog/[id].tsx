import { useLocalSearchParams } from "expo-router";
import { EditorScreen } from "../../../features/EditorScreen";
import { catalogFields } from "../../../features/schema";
export default function Edit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <EditorScreen
      title="Edit catalog piece."
      path={`/admin/catalog/${encodeURIComponent(id)}`}
      fields={catalogFields}
      photo
      admin
      allowDelete
      afterSave="/admin/catalog"
    />
  );
}
