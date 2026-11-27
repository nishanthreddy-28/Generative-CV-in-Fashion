import {Redirect} from "expo-router";
// Retain old bookmarks while removing the retired suggestions UI.
export default function RetiredSuggestions(){return <Redirect href="/stylist"/>;}
