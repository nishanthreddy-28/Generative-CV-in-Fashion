import { EditorScreen } from "../../features/EditorScreen";
import { bodyFields } from "../../features/schema";
export default function Body() {
  return (
    <EditorScreen
      title="Your body. Your fit."
      subtitle="Your measurements are optional and private. Use the selected unit for every value; changing the unit does not automatically convert existing numbers."
      path="/profile/body"
      fields={bodyFields}
    />
  );
}
