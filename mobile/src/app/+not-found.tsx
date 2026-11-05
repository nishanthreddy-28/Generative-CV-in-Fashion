import { Screen, Notice, RouteLink } from "../components/Screen";
export default function NotFound() {
  return (
    <Screen title="A different direction.">
      <Notice
        title="Page not found"
        text="This page may have moved or no longer exists."
      />
      <RouteLink to="/">Return to introduction</RouteLink>
      <RouteLink to="/preview">Review workflows</RouteLink>
    </Screen>
  );
}
