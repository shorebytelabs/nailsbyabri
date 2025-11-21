import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import ScreenContainer from '../components/ScreenContainer';
import Icon from '../icons/Icon';
import { useTheme } from '../theme';
import { withOpacity } from '../utils/color';

function TermsScreen({ navigation }) {
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
        <Text style={[styles.headerTitle, { color: primaryFont }]}>Terms & Conditions</Text>
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

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>1. Agreement to Terms</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          By accessing or using the Nails by Abri mobile application ("App"), you agree to be bound by these Terms & Conditions ("Terms"). If you disagree with any part of these Terms, you may not access or use the App. These Terms apply to all visitors, users, and others who access or use the App.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>2. Eligibility</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          You must be at least 13 years of age to use this App. If you are under 18, you represent that you have obtained parental or guardian consent to use this App and agree to these Terms. By using the App, you represent and warrant that you meet the age requirement and have the legal capacity to enter into these Terms.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>3. Account Registration</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          To use certain features of the App, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>4. Services and Orders</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Nails by Abri provides custom nail art services through this App. By placing an order, you agree to provide accurate information about your design preferences, nail sizes, and delivery details. We reserve the right to refuse or cancel any order at any time for reasons including, but not limited to, product availability, errors in pricing or product information, or suspected fraud.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>5. Payment Terms</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Payment is required before production begins on your order. We accept payment through Venmo as specified at checkout. All prices are in U.S. Dollars (USD). Prices are subject to change without notice, but you will be charged the price in effect at the time of order submission. Promotional codes may be subject to additional terms and conditions.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>6. Refunds and Cancellations</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Once production has begun on your order, cancellations may not be possible. If you wish to cancel an order, please contact us immediately. Refunds, if approved, will be processed within 14 business days. Custom orders cannot be returned unless there is a defect or error on our part. If you receive a defective product, please contact us within 7 days of receipt.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>7. Digital Content and User Submissions</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          You may upload images, design references, or other content ("User Content") to the App. By uploading User Content, you grant Nails by Abri a non-exclusive, royalty-free, worldwide license to use, display, and reproduce your User Content solely for the purpose of fulfilling your order and improving our services. You represent that you own or have the right to use any User Content you upload.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>8. Intellectual Property</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          The App and its original content, features, and functionality are owned by Nails by Abri and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the App without our prior written consent.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>9. Prohibited Uses</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          You agree not to use the App: (a) in any way that violates any applicable law or regulation; (b) to transmit any harmful or malicious code; (c) to impersonate or attempt to impersonate another user; (d) in any manner that could disable, overburden, damage, or impair the App; or (e) for any commercial purpose without our prior written consent.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>10. Disclaimers</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>11. Limitation of Liability</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, NAILS BY ABRI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES RESULTING FROM YOUR USE OF THE APP.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>12. Indemnification</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          You agree to defend, indemnify, and hold harmless Nails by Abri and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with your use of the App or violation of these Terms.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>13. Termination</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We may terminate or suspend your account and access to the App immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the App will immediately cease.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>14. Dispute Resolution</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          Any disputes arising out of or relating to these Terms or the App shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. The arbitration shall take place in California, United States. You waive any right to a jury trial or to participate in a class-action lawsuit.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>15. Governing Law</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>16. Changes to Terms</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. Your continued use of the App after any changes constitutes acceptance of the new Terms.
        </Text>

        <Text style={[styles.sectionTitle, { color: primaryFont }]}>17. Contact Information</Text>
        <Text style={[styles.bodyText, { color: primaryFont }]}>
          If you have any questions about these Terms, please contact us at NailsByAbriannaC@gmail.com.
        </Text>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: secondaryFont }]}>
            By using the Nails by Abri App, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.
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

export default TermsScreen;

