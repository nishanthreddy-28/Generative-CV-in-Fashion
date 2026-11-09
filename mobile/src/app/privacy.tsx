import { Redirect } from "expo-router";

// Keep existing links safe while the public policy page is paused for review.
export default function Privacy() {
  return <Redirect href="/" />;
}
