import { EditorScreen } from "../../../features/EditorScreen";
import { catalogFields } from "../../../features/schema";
export default function New() {
  return (
    <EditorScreen
      title="New catalog piece."
      path="/admin/catalog"
      fields={catalogFields}
      create
      photo
      admin
      afterSave="/admin/catalog"
    />
  );
}
