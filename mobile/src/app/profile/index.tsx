import { EditorScreen } from "../../features/EditorScreen";
import { profileFields } from "../../features/schema";
export default function Profile() {
  return (
    <EditorScreen
      title="Your profile."
      subtitle="The details that make your style personal."
      path="/profile"
      fields={profileFields}
    />
  );
}
