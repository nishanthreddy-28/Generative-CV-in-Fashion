import { EditorScreen } from "../features/EditorScreen";
import { preferenceFields } from "../features/schema";
export default function Preferences() {
  return (
    <EditorScreen
      title="Your preferences."
      path="/settings"
      fields={preferenceFields}
    />
  );
}
