import {Text} from "react-native";
import {Screen,RouteLink,Notice,ui} from "../components/Screen";
export default function Privacy(){return <Screen title="Your photos and privacy.">
 <Text style={ui.body}>Drape &amp; Drop uses account details, optional body measurements, preferences and garments to provide personal wardrobe features. Choosing a photo does not upload it until you submit the form. Preview screens do not submit personal records.</Text>
 <Text style={ui.body}>Submitted photos are stored privately and retrieved through authenticated requests. No inference worker is configured, so try-on submissions cannot generate a result image.</Text>
 <Text style={ui.body}>Local cleanup defaults make abandoned uploads eligible after one hour and queued try-on input photos eligible after 24 hours. Cancellation requests cleanup sooner. Cleanup requires a configured trusted worker; these windows are not a guarantee that bytes have already been removed. Job and consent records remain after input expiration.</Text>
 <Text style={ui.body}>Account deletion requires confirmation and recent sign-in. It blocks normal account access first, then requests removal of personal images and account records. Check deletion progress for completion. Shared catalog assets are managed separately.</Text>
 <Notice title="Development privacy notice" text="Hosted cleanup and final retention policy are not approved for release yet. A public privacy policy, contact details and external account-deletion information must be published before Google Play distribution."/>
 <RouteLink to="/settings">Account settings</RouteLink>
 </Screen>;}
