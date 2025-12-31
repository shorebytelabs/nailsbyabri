import React, { useMemo } from 'react';
import {ScrollView, StyleSheet, View, TouchableOpacity} from 'react-native';
import AppText from '../components/AppText';
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
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Privacy Policy</AppText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={true}
      >
        <AppText style={[styles.effectiveDate, { color: secondaryFont }]}>
          Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </AppText>

        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          At Nails by Abri ("we," "us," or "our"), we respect your privacy and are committed to protecting your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ("App").
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>1. Information We Collect</AppText>
        
        <AppText style={[styles.subsectionTitle, { color: primaryFont }]}>1.1 Personal Information</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          When you create an account, we collect:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • Full name (optional){'\n'}
          • Email address (required for email-based authentication){'\n'}
          • Age group (for age verification, required for new accounts){'\n'}
          • Password (encrypted and stored securely, if you choose password-based authentication){'\n'}
          • Authentication methods used (password or email code){'\n'}
          • Last authentication method used (for security and account management)
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Passwordless Authentication:</AppText> You can create an account and sign in using your email address with a one-time verification code (OTP). We will send a verification code to your email address that you must enter to complete authentication. This code is valid for a limited time and can only be used once.
        </AppText>

        <AppText style={[styles.subsectionTitle, { color: primaryFont }]}>1.2 Order Information</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          When you place an order, we collect:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • Nail size measurements{'\n'}
          • Design preferences and uploaded images{'\n'}
          • Photos taken with your device's camera for nail sizing (if you choose the camera sizing option){'\n'}
          • Delivery/shipping address{'\n'}
          • Payment method information (when your order is marked as paid, we may record the payment method used, such as Venmo, Cash, or other methods, for order records and accounting purposes)
        </AppText>

        <AppText style={[styles.subsectionTitle, { color: primaryFont }]}>1.3 Feedback Information</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          When you provide feedback on completed orders, we collect:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • Star rating (1-5 stars){'\n'}
          • Written comments or reviews (optional){'\n'}
          • Photos of completed nails (optional){'\n'}
          • Timestamp of feedback submission
        </AppText>

        <AppText style={[styles.subsectionTitle, { color: primaryFont }]}>1.4 Device Permissions</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          The App may request access to certain device features:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • <AppText style={{ fontWeight: '600' }}>Camera Access:</AppText> If you choose to use the camera-based nail sizing feature, the App will request permission to access your device's camera to take photos of your nails for sizing purposes. These photos are uploaded to our secure servers and used solely for fulfilling your order. You can choose to use manual nail size entry instead, which does not require camera access.{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Photo Library Access:</AppText> The App may request access to your photo library to allow you to select and upload images for design inspiration or nail sizing. We only access photos that you explicitly choose to upload.
        </AppText>

        <AppText style={[styles.subsectionTitle, { color: primaryFont }]}>1.5 Usage Information</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We automatically collect certain information when you use the App, including:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • Device information (type, model, operating system){'\n'}
          • App usage data and interactions{'\n'}
          • IP address and location data (general area only){'\n'}
          • Log files and error reports
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>2. How We Use Your Information</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We use the information we collect to:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • Provide, maintain, and improve our services{'\n'}
          • Process and fulfill your orders{'\n'}
          • Communicate with you about your orders, account, and our services{'\n'}
          • Send you notifications (order updates, promotions, etc.){'\n'}
          • Collect and analyze customer feedback to improve our products and services{'\n'}
          • Verify your age and eligibility to use the App{'\n'}
          • Detect, prevent, and address technical issues and fraud{'\n'}
          • Comply with legal obligations
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>3. Data Storage and Security</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We use Supabase for authentication, database storage, and file storage. Your data is stored securely using industry-standard encryption. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is 100% secure.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Session Persistence:</AppText> To provide a seamless user experience, we store authentication tokens securely on your device using encrypted local storage. This allows you to remain logged in even after closing the app. These tokens are automatically refreshed to maintain your session. You can log out at any time through the app settings, which will remove all stored authentication data from your device.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>4. Information Sharing and Disclosure</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We do not sell your personal information. We may share your information only in the following circumstances:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • <AppText style={{ fontWeight: '600' }}>Service Providers:</AppText> We may share information with third-party service providers (e.g., payment processors, shipping companies) who assist us in operating the App and providing services to you.{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Legal Requirements:</AppText> We may disclose information if required by law, court order, or government regulation.{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Business Transfers:</AppText> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new owner.{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>With Your Consent:</AppText> We may share information with your explicit consent for specific purposes.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>5. Cookies and Tracking Technologies</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          The App may use cookies and similar tracking technologies to enhance your experience. These technologies help us remember your preferences, analyze app usage, and improve our services. You can control cookie preferences through your device settings, though this may limit certain App features.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>6. Third-Party Services</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          Our App uses the following third-party services:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • <AppText style={{ fontWeight: '600' }}>Supabase:</AppText> For authentication, database, and file storage. Please review Supabase's privacy policy: https://supabase.com/privacy{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Venmo:</AppText> For payment processing. Please review Venmo's privacy policy: https://venmo.com/legal/us-privacy-policy{'\n\n'}
          These third parties have their own privacy policies governing how they use your information.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>7. Children's Privacy</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          Our App is intended for users who are 13 years of age or older. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will delete that information immediately. If you are a parent or guardian and believe your child has provided us with personal information, please contact us.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>8. Your Rights and Choices</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          You have the right to:
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          • <AppText style={{ fontWeight: '600' }}>Access:</AppText> Request a copy of the personal information we hold about you{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Correction:</AppText> Update or correct your personal information through your account settings{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Deletion:</AppText> Delete your account and personal information directly from the app{'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Opt-Out:</AppText> Unsubscribe from promotional communications (you will still receive transactional emails){'\n\n'}
          • <AppText style={{ fontWeight: '600' }}>Data Portability:</AppText> Request your data in a portable format
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          To exercise these rights, please contact us at NailsByAbriannaC@gmail.com.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>9. Data Retention</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required or permitted by law. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal or business purposes.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>10. International Data Transfers</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country. By using the App, you consent to the transfer of your information to these countries.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>11. California Privacy Rights</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, the right to delete personal information, and the right to opt-out of the sale of personal information (we do not sell personal information). To exercise these rights, please contact us at NailsByAbriannaC@gmail.com.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>12. Changes to This Privacy Policy</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy in the App and updating the "Last Updated" date. Your continued use of the App after such changes constitutes acceptance of the updated Privacy Policy.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>13. Contact Us</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:{'\n\n'}
          Email: NailsByAbriannaC@gmail.com
        </AppText>

        <View style={styles.footer}>
          <AppText style={[styles.footerText, { color: secondaryFont }]}>
            By using the Nails by Abri App, you acknowledge that you have read, understood, and agree to this Privacy Policy.
          </AppText>
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

