import {useEffect,useState} from "react";
import {Image,StyleSheet,Text,View} from "react-native";
import {useResource} from "../hooks/useResource";
import {ui} from "./Screen";
import {colors} from "../theme/tokens";
export function PrivateBodyPhoto({ id }: { id: string }) {
  const image = useResource<Blob>(`/onboarding/body-photo/${encodeURIComponent(id)}`, false, false, "image");
  const [preview, setPreview] = useState<{ blob: Blob; uri: string } | null>(null);
  useEffect(() => {
    if (!image.data) return;
    const reader = new FileReader();
    const blob = image.data;
    reader.onload = () => { if (typeof reader.result === "string") setPreview({ blob, uri: reader.result }); };
    reader.readAsDataURL(image.data);
    return () => { reader.onload = null; if (reader.readyState === FileReader.LOADING) reader.abort(); };
  }, [image.data]);
  const uri = image.data && preview?.blob === image.data ? preview.uri : "";
  return <View style={styles.photoFrame}>
    {uri ? <Image source={{ uri }} accessibilityLabel="Your private body profile photo" resizeMode="contain" style={StyleSheet.absoluteFill} /> :
      <Text style={ui.body}>{image.loading ? "Loading your private photo…" : image.error || "Photo preview unavailable."}</Text>}
  </View>;
}

const styles=StyleSheet.create({photoFrame:{width:"100%",aspectRatio:.8,maxHeight:420,alignItems:"center",justifyContent:"center",overflow:"hidden",backgroundColor:colors.raised,borderWidth:1,borderColor:colors.border}});
