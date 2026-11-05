import { EditorScreen } from "../../features/EditorScreen";
import { bodyFields } from "../../features/schema";
export default function Body() {
  return (
    <EditorScreen
      title="Your body. Your fit."
      subtitle="Measurements are optional. Enter each value in your selected unit. Automatic body analysis will be connected in a later phase."
      path="/profile/body"
      fields={bodyFields}
    />
  );
}
