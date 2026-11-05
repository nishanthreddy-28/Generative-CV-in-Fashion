import {
  Screen,
  Gate,
  RouteLink,
  Notice,
  usePreview,
} from "../../components/Screen";
export default function Admin() {
  const preview = usePreview();
  return (
    <Screen title="The catalog studio.">
      <Gate preview={preview} admin>
        <Notice
          title="Administrator workspace"
          text="Manage catalog details and imagery. Authorization must also be enforced by the backend."
        />
        <RouteLink to="/admin/catalog" preview={preview}>
          Manage catalog →
        </RouteLink>
        <RouteLink to="/admin/catalog/new" preview={preview}>
          Add a catalog piece →
        </RouteLink>
      </Gate>
    </Screen>
  );
}
