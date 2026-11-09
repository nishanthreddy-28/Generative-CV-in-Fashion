import { useRef, useState, type ComponentRef } from "react";
import { Link } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FramedImage } from "../components/FramedImage";

const palette = {
  paper: "#FAF8F4", ink: "#211F1C", muted: "#69645C", line: "#DDD6CA",
  wine: "#632D3C", blush: "#ECE2D7", white: "#FFFFFF",
};
const questions = [
  { title: "What is Drape & Drop?", answer: "A personal space to organise your clothes, put outfits together and save ideas for what to wear next." },
  { title: "Can I use clothes I already own?", answer: "Yes. Your wardrobe begins with your own pieces. Add a photo and the details you want to remember, then use them to build outfits." },
  { title: "Can I try it on my phone?", answer: "This website adapts to your phone. The Android application is being prepared for testing." },
  { title: "When can I create an account?", answer: "Registration opens after account verification and saved-data testing are complete. You can explore the account screens today." },
];
const steps = [
  { number: "01", title: "Bring your wardrobe together.", text: "The pieces you love, finally in one place. Add your clothes and the little details that make them yours." },
  { number: "02", title: "Find your next combination.", text: "Pair your favourites, explore a new silhouette and build a look for whatever the day holds." },
  { number: "03", title: "Keep the good ideas.", text: "Save your outfits and styling ideas, so getting dressed starts with inspiration." },
];

export default function Introduction() {
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const sections = useRef<Record<string, number>>({});
  const [openQuestion, setOpenQuestion] = useState<number | null>(null);
  const jump = (name: string) => scroll.current?.scrollTo({ y: sections.current[name] ?? 0, animated: false });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView ref={scroll} contentContainerStyle={styles.page}>
        <View style={styles.announcement}><Text style={styles.announcementText}>YOUR WARDROBE. A NEW PERSPECTIVE.</Text></View>
        <View style={styles.header}>
          <Link href="/" accessibilityLabel="Drape and Drop home" style={styles.brand}>DRAPE &amp; DROP</Link>
          <Link href="/login" style={styles.signIn}>Sign in ↗</Link>
        </View>
        <View style={styles.sectionNav}>
          {[['The experience', 'experience'], ['The style edit', 'edit'], ['Questions', 'questions']].map(([label, section]) => (
            <Pressable key={section} accessibilityRole="button" onPress={() => jump(section)} style={styles.navButton}>
              <Text style={styles.navText}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.hero}>
          <View style={styles.heroImage}>
            <FramedImage source={require('../../assets/editorial/campaign-hero.jpg')} ratio={0.78}
              label="Three models in burgundy tailoring and ivory layers in a sunlit architectural courtyard" />
            <Text style={styles.imageCaption}>THE PERSONAL EDIT / VOL. 01</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>A LITTLE MORE INTENTION</Text>
            <Text accessibilityRole="header" style={styles.title}>Your style.{'\n'}Beautifully{'\n'}put together.</Text>
            <Text style={styles.body}>Rediscover what you own. Create outfits that feel like you. Make every day a little more considered.</Text>
            <Link href="/login" style={styles.primary}>Step inside  →</Link>
            <Link href="/signup" style={styles.textLink}>New here? Discover your personal wardrobe</Link>
          </View>
        </View>
        <View style={styles.manifesto}>
          <Text style={styles.eyebrow}>LESS SCROLLING. MORE STYLING.</Text>
          <Text style={styles.statement}>A wardrobe full of possibilities.{'\n'}A space to make them yours.</Text>
          <Text style={styles.body}>Your pieces. Your combinations. Your next favourite look.</Text>
        </View>
        <View onLayout={event => { sections.current.experience = event.nativeEvent.layout.y; }} style={styles.section}>
          <View style={styles.sectionHeading}><Text style={styles.eyebrow}>THE EXPERIENCE</Text><Text style={styles.sectionNumber}>01—03</Text></View>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Good style starts{'\n'}with what you own.</Text>
          <View style={styles.steps}>
            {steps.map(step => <View key={step.number} style={styles.step}>
              <Text style={styles.stepNumber}>{step.number}</Text>
              <Text style={styles.stepTitle}>{step.title}</Text>
              <Text style={styles.body}>{step.text}</Text>
            </View>)}
          </View>
        </View>
        <View onLayout={event => { sections.current.edit = event.nativeEvent.layout.y; }} style={styles.section}>
          <View style={styles.sectionHeading}><Text style={styles.eyebrow}>THE STYLE EDIT</Text><Text style={styles.sectionNumber}>A NEW POINT OF VIEW</Text></View>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Find your everyday extraordinary.</Text>
          <View style={styles.editorials}>
            <View style={styles.editorialCard}>
              <FramedImage source={require('../../assets/editorial/campaign-daylight.jpg')} ratio={0.72}
                label="Model in chocolate tailoring and ivory knitwear, photographed in a warm studio" />
              <Text style={styles.cardLabel}>01 / THE EVERYDAY</Text><Text style={styles.cardTitle}>Effortless, by you.</Text>
            </View>
            <View style={styles.editorialCard}>
              <FramedImage source={require('../../assets/editorial/campaign-evening.jpg')} ratio={0.72}
                label="Two models wearing evening tailoring in a minimal art gallery" />
              <Text style={styles.cardLabel}>02 / AFTER HOURS</Text><Text style={styles.cardTitle}>Make an entrance.</Text>
            </View>
          </View>
          <Text style={styles.caption}>Original campaign imagery created for Drape &amp; Drop.</Text>
        </View>
        <View style={styles.invitation}>
          <Text style={styles.lightEyebrow}>YOURS TO MAKE YOUR OWN</Text>
          <Text accessibilityRole="header" style={styles.invitationTitle}>A little less “what if”.{'\n'}A little more you.</Text>
          <Text style={styles.lightBody}>One place for your wardrobe and the outfits you want to wear again.</Text>
          <Link href="/login" style={styles.lightButton}>Explore Drape &amp; Drop  →</Link>
        </View>
        <View onLayout={event => { sections.current.questions = event.nativeEvent.layout.y; }} style={styles.section}>
          <Text style={styles.eyebrow}>A FEW THINGS TO KNOW</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Consider us introduced.</Text>
          {questions.map((question, index) => <View style={styles.question} key={question.title}>
            <Pressable accessibilityRole="button" accessibilityState={{expanded: openQuestion === index}}
              onPress={() => setOpenQuestion(current => current === index ? null : index)} style={styles.questionButton}>
              <Text style={styles.questionTitle}>{question.title}</Text><Text style={styles.questionSymbol}>{openQuestion === index ? '−' : '+'}</Text>
            </Pressable>
            {openQuestion === index && <Text style={styles.answer}>{question.answer}</Text>}
          </View>)}
        </View>
        <View style={styles.footer}>
          <Text style={styles.brand}>DRAPE &amp; DROP</Text>
          <Text style={styles.caption}>THE PERSONAL WARDROBE, RECONSIDERED.</Text>
          <View style={styles.footerLinks}><Link href="/login" style={styles.textLink}>Sign in</Link><Link href="/signup" style={styles.textLink}>Create an account</Link></View>
          <Text style={styles.caption}>© {new Date().getFullYear()} Drape &amp; Drop</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: palette.paper},
  page: {width: '100%', maxWidth: 480, alignSelf: 'center'},
  announcement: {backgroundColor: palette.wine, paddingVertical: 10, paddingHorizontal: 16, alignItems: 'center'},
  announcementText: {fontSize: 9, letterSpacing: 2, color: palette.white, textAlign: 'center'},
  header: {paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap'},
  brand: {fontSize: 17, fontWeight: '700', letterSpacing: 1.8, color: palette.ink},
  signIn: {fontSize: 13, color: palette.ink, minHeight: 44, paddingVertical: 14},
  sectionNav: {flexDirection: 'row', justifyContent: 'space-around', borderTopWidth: 1, borderBottomWidth: 1, borderColor: palette.line, paddingHorizontal: 8, flexWrap: 'wrap'},
  navButton: {minHeight: 44, paddingHorizontal: 8, justifyContent: 'center'},
  navText: {fontSize: 11, color: palette.muted},
  hero: {backgroundColor: palette.blush},
  heroImage: {position: 'relative'},
  imageCaption: {position: 'absolute', bottom: 18, left: 18, backgroundColor: palette.paper, color: palette.ink, padding: 8, fontSize: 9, letterSpacing: 1.2},
  heroCopy: {padding: 26, gap: 18}, eyebrow: {fontSize: 10, fontWeight: '600', letterSpacing: 1.8, color: palette.wine},
  title: {fontFamily: 'serif', fontSize: 44, lineHeight: 48, color: palette.ink},
  body: {fontSize: 15, lineHeight: 24, color: palette.muted},
  primary: {backgroundColor: palette.wine, color: palette.white, padding: 18, textAlign: 'center', minHeight: 54, fontSize: 14, fontWeight: '600'},
  textLink: {color: palette.ink, fontSize: 13, textDecorationLine: 'underline', paddingVertical: 14, minHeight: 48},
  manifesto: {paddingHorizontal: 24, paddingVertical: 44, gap: 18, alignItems: 'center'},
  statement: {fontFamily: 'serif', fontSize: 26, lineHeight: 34, textAlign: 'center', color: palette.ink},
  section: {paddingHorizontal: 22, paddingVertical: 32, gap: 20}, sectionHeading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap'},
  sectionNumber: {fontSize: 9, letterSpacing: 1, color: palette.muted},
  sectionTitle: {fontFamily: 'serif', fontSize: 32, lineHeight: 38, color: palette.ink},
  steps: {gap: 20},
  step: {borderTopWidth: 1, borderColor: palette.line, paddingTop: 18, gap: 12}, stepNumber: {fontSize: 11, letterSpacing: 2, color: palette.wine},
  stepTitle: {fontFamily: 'serif', fontSize: 25, lineHeight: 30, color: palette.ink},
  editorials: {flexDirection: 'row', gap: 14, flexWrap: 'wrap'}, editorialCard: {flexGrow: 1, flexBasis: 125, minWidth: 0, gap: 9},
  cardLabel: {fontSize: 9, letterSpacing: 1, color: palette.muted}, cardTitle: {fontFamily: 'serif', fontSize: 22, lineHeight: 28, color: palette.ink},
  caption: {fontSize: 10, lineHeight: 16, letterSpacing: 0.5, color: palette.muted},
  invitation: {backgroundColor: palette.wine, paddingHorizontal: 26, paddingVertical: 42, gap: 20},
  lightEyebrow: {color: '#EAD6DB', fontSize: 9, letterSpacing: 1.8}, invitationTitle: {fontFamily: 'serif', fontSize: 34, lineHeight: 40, color: palette.white},
  lightBody: {fontSize: 15, lineHeight: 24, color: '#EAD6DB'}, lightButton: {backgroundColor: palette.paper, color: palette.wine, textAlign: 'center', padding: 18, fontSize: 13, fontWeight: '600', minHeight: 54},
  question: {borderBottomWidth: 1, borderColor: palette.line}, questionButton: {flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, minHeight: 56},
  questionTitle: {flex: 1, fontSize: 14, lineHeight: 21, color: palette.ink}, questionSymbol: {fontSize: 22, color: palette.wine}, answer: {paddingBottom: 20, color: palette.muted, fontSize: 14, lineHeight: 23},
  footer: {borderTopWidth: 1, borderColor: palette.line, padding: 24, gap: 14}, footerLinks: {flexDirection: 'row', gap: 24, flexWrap: 'wrap'},
});
