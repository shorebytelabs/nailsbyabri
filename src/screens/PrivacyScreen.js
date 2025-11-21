import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

function PrivacyScreen({ navigation }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const styles = useMemo(() => createStyles(colors), [colors]);

  const primaryFont = colors.primaryFont || '#220707';
  const accent = colors.accent || '#6F171F';
  const secondaryFont = colors.secondaryFont || '#5C5F5D';
  const surface = colors.surface || '#FFFFFF';
  const borderColor = colors.border || withOpacity('#000000', 0.08);

  return (
    <ScreenContainer scroll={false} style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Icon name="chevronRight" color={primaryFont} style={styles.backIcon} size={24} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <Text style={[styles.effectiveDate, { color: secondaryFont }]}>
          Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Text>

        <Text style={[styles.bodyText, { color: primaryFont }]}>
          At Nails by Abri ("we," "us," or "our"), we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ("App").
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>1. Information We Collect</Text>
        
        <Text style={[styles.subsectionTitle, { color: primaryFont }]}>1.1 Personal Information</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          When you create an account, we collect:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • Full name{'\n'}
          • Email address{'\n'}
          • Age group (for age verification){'\n'}
          • Password (encrypted and stored securely)
        </Text>

        <Text style={[styles.subsectionTitle, { color: primaryFont }]}>1.2 Order Information</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          When you place an order, we collect:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • Nail size measurements{'\n'}
          • Design preferences and uploaded images{'\n'}
          • Delivery/shipping address{'\n'}
          • Payment information (processed securely through Venmo)
        </Text>

        <Text style={[styles.subsectionTitle, { color: primaryFont }]}>1.3 Usage Information</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We automatically collect certain information when you use the App, including:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • Device information (type, model, operating system){'\n'}
          • App usage data and interactions{'\n'}
          • IP address and location data (general area only){'\n'}
          • Log files and error reports
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>2. How We Use Your Information</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We use the information we collect to:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • Provide, maintain, and improve our services{'\n'}
          • Process and fulfill your orders{'\n'}
          • Communicate with you about your orders, account, and our services{'\n'}
          • Send you notifications (order updates, promotions, etc.){'\n'}
          • Verify your age and eligibility to use the App{'\n'}
          • Detect, prevent, and address technical issues and fraud{'\n'}
          • Comply with legal obligations
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>3. Data Storage and Security</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We use Supabase for authentication, database storage, and file storage. Your data is stored securely using industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>4. Information Sharing and Disclosure</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We do not sell your personal information. We may share your information only in the following circumstances:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • <Text style={{ fontWeight: '600' }}>Service Providers:</Text> We may share information with third-party service providers (e.g., payment processors, shipping companies) who assist us in operating the App and providing services to you.{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Legal Requirements:</Text> We may disclose information if required by law, court order, or government regulation.{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Business Transfers:</Text> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new owner.{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>With Your Consent:</Text> We may share information with your explicit consent for specific purposes.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>5. Cookies and Tracking Technologies</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          The App may use cookies and similar tracking technologies to enhance your experience. These technologies help us remember your preferences, analyze app usage, and improve our services. You can control cookie preferences through your device settings, though this may limit certain App features.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>6. Third-Party Services</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Our App uses the following third-party services:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • <Text style={{ fontWeight: '600' }}>Supabase:</Text> For authentication, database, and file storage. Please review Supabase's privacy policy: https://supabase.com/privacy{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Venmo:</Text> For payment processing. Please review Venmo's privacy policy: https://venmo.com/legal/us-privacy-policy{'\n\n'}
          These third parties have their own privacy policies governing how they use your information.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>7. Children's Privacy</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Our App is intended for users who are 13 years of age or older. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will delete that information immediately. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>8. Your Rights and Choices</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          You have the right to:
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          • <Text style={{ fontWeight: '600' }}>Access:</Text> Request a copy of the personal information we hold about you{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Correction:</Text> Update or correct your personal information through your account settings{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Deletion:</Text> Request deletion of your account and personal information{'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Opt-Out:</Text> Unsubscribe from promotional communications (you will still receive transactional emails){'\n\n'}
          • <Text style={{ fontWeight: '600' }}>Data Portability:</Text> Request your data in a portable format
        </Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          To exercise these rights, please contact us at NailsByAbriannaC@gmail.com.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>9. Data Retention</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or business purposes.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>10. International Data Transfers</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using the App, you consent to the transfer of your information to these countries.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>11. California Privacy Rights</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete personal information, and the right to opt-out of the sale of personal information (we do not sell personal information). To exercise these rights, please contact us at NailsByAbriannaC@gmail.com.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>12. Changes to This Privacy Policy</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy in the App and updating the "Last Updated" date. Your continued use of the App after such changes constitutes acceptance of the updated Privacy Policy.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>13. Contact Us</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:{'\n\n'}
          Email: NailsByAbriannaC@gmail.com
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: secondaryFont }]}>
            By using the Nails by Abri App, you acknowledge that you have read, understood, and agree to this Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}

const createStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withOpacity(colors.border || '#000000', 0.08),
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backIcon: {
    transform: [{ rotate: '180deg' }],
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  effectiveDate: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 24,
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 8,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  footer: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: withOpacity(colors.border || '#000000', 0.08),
  },
  footerText: {
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
});

export default PrivacyScreen;

