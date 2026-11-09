import { Text, View } from "react-native";
import {
  Screen,
  Gate,
  RouteLink,
  ui,
  usePreview,
} from "../../components/Screen";
export default function Admin() {
  const preview = usePreview();
  return (
    <Screen title="Catalog workspace">
      <Gate preview={preview} admin>
        <View style={ui.card}>
          <Text style={ui.heading}>Collection management</Text>
          <Text style={ui.body}>Review active and archived pieces, update details, and replace imagery.</Text>
          <RouteLink to="/admin/catalog" preview={preview}>Manage catalog →</RouteLink>
        </View>
        <View style={ui.card}>
          <Text style={ui.heading}>Add a new piece</Text>
          <Text style={ui.body}>Publish a garment with its photo and collection details.</Text>
          <RouteLink to="/admin/catalog/new" preview={preview}>Add a catalog piece →</RouteLink>
        </View>
      </Gate>
    </Screen>
  );
}
