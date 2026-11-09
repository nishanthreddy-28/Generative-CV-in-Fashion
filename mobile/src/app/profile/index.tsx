import { EditorScreen } from "../../features/EditorScreen";
import { profileFields } from "../../features/schema";
export default function Profile() {
  return (
    <EditorScreen
      title="Profile"
      subtitle="Manage your name and style details."
      path="/profile"
      fields={profileFields}
    />
  );
}
