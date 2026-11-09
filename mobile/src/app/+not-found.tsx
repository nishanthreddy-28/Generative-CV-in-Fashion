import { Screen, RouteLink } from "../components/Screen";
export default function NotFound() {
  return (
    <Screen title="Page not found" subtitle="This page may have moved or no longer exists.">
      <RouteLink to="/">Back to home</RouteLink>
    </Screen>
  );
}
