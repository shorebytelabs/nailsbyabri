import React, { useMemo } from 'react';
import {ScrollView, StyleSheet, View, TouchableOpacity} from 'react-native';
import AppText from '../components/AppText';
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
        <AppText style={[styles.headerTitle, { color: primaryFont }]}>Terms & Conditions</AppText>
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

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>1. Agreement to Terms</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          By accessing or using the Nails by Abri mobile application ("App"), you agree to be bound by these Terms & Conditions ("Terms"). If you disagree with any part of these Terms, you may not access or use the App. These Terms apply to all visitors, users, and others who access or use the App.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>2. Eligibility</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          You must be at least 13 years of age to use this App. If you are under 18, you represent that you have obtained parental or guardian consent to use this App and agree to these Terms. By using the App, you represent and warrant that you meet the age requirement and have the legal capacity to enter into these Terms.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>3. Account Registration</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          To use certain features of the App, you must create an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>4. Services and Orders</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          Nails by Abri provides custom nail art services through this App. By placing an order, you agree to provide accurate information about your design preferences, nail sizes, and delivery details. We reserve the right to refuse or cancel any order at any time for reasons including, but not limited to, product availability, errors in pricing or product information, or suspected fraud.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>5. Payment Terms</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          Payment is required before production begins on your order. We accept payment through Venmo as specified at checkout. All prices are in U.S. Dollars (USD). Prices are subject to change without notice, but you will be charged the price in effect at the time of order submission. Promotional codes may be subject to additional terms and conditions.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>6. Refunds and Cancellations</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          Once production has begun on your order, cancellations may not be possible. If you wish to cancel an order, please contact us immediately. Refunds, if approved, will be processed within 14 business days. Custom orders cannot be returned unless there is a defect or error on our part. If you receive a defective product, please contact us within 7 days of receipt.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>7. Digital Content and User Submissions</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Ownership of User Content:</AppText> You retain all ownership rights to any images, design references, or other content ("User Content") you upload to the App. Nails by Abri does not claim ownership of your User Content.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>License to Use:</AppText> By uploading User Content, you grant Nails by Abri a non-exclusive, royalty-free, worldwide, perpetual license to store, use, display, and reproduce your User Content solely for the purpose of fulfilling your order, improving our services, and maintaining order records. This license allows us to store your User Content in our systems and use it to create and deliver your custom nail art products.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Your Representations and Warranties:</AppText> You represent and warrant that: (a) you own or have the legal right, license, or permission to use, upload, and grant the license described above for all User Content you upload; (b) your User Content does not violate any third-party rights, including copyright, trademark, privacy, or publicity rights; (c) your User Content does not contain images of celebrities, public figures, or other individuals without their express consent; and (d) your User Content does not infringe upon the intellectual property rights of any third party.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Prohibited Content:</AppText> You agree not to upload User Content that violates any laws, infringes on any intellectual property rights, contains images of celebrities or public figures without authorization, or violates any third-party rights. Nails by Abri reserves the right to remove any User Content that violates these Terms or that we determine, in our sole discretion, may expose us to liability.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Indemnification for User Content:</AppText> You agree to defend, indemnify, and hold harmless Nails by Abri from and against any claims, damages, losses, liabilities, and expenses (including attorney's fees) arising out of or related to your User Content, including claims of copyright infringement, trademark infringement, right of publicity violations, or any other third-party rights violations.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>8. Intellectual Property</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          The App and its original content, features, and functionality are owned by Nails by Abri and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the App without our prior written consent.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>9. Prohibited Uses</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          You agree not to use the App: (a) in any way that violates any applicable law or regulation; (b) to transmit any harmful or malicious code; (c) to impersonate or attempt to impersonate another user; (d) in any manner that could disable, overburden, damage, or impair the App; or (e) for any commercial purpose without our prior written consent.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>10. Disclaimers</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE APP WILL BE UNINTERRUPTED, SECURE, OR ERROR-FREE. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>11. Limitation of Liability</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>EXCLUSION OF INDIRECT DAMAGES:</AppText> TO THE MAXIMUM EXTENT PERMITTED BY LAW, NAILS BY ABRI SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF REVENUES, LOSS OF DATA, LOSS OF USE, LOSS OF BUSINESS OPPORTUNITY, LOSS OF GOODWILL, OR OTHER INTANGIBLE LOSSES, REGARDLESS OF WHETHER SUCH DAMAGES WERE FORESEEABLE OR WHETHER NAILS BY ABRI HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>LIMITATION OF TOTAL LIABILITY:</AppText> TO THE MAXIMUM EXTENT PERMITTED BY LAW, NAILS BY ABRI'S TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO YOUR USE OF THE APP OR THESE TERMS, WHETHER IN CONTRACT, TORT (INCLUDING NEGLIGENCE), STRICT LIABILITY, OR ANY OTHER LEGAL THEORY, SHALL NOT EXCEED THE AMOUNT YOU PAID TO NAILS BY ABRI IN THE TWELVE (12) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE LIABILITY, OR ONE HUNDRED DOLLARS ($100), WHICHEVER IS GREATER.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>NO RESPONSIBILITY FOR INDIRECT CONSEQUENCES:</AppText> NAILS BY ABRI SHALL NOT BE RESPONSIBLE OR LIABLE FOR ANY INDIRECT DAMAGES, INCLUDING BUT NOT LIMITED TO LOST REVENUE, LOST PROFITS, LOSS OF OPPORTUNITY, OR DAMAGES ARISING FROM YOUR INABILITY TO USE THE APP OR SERVICES, EVEN IF SUCH DAMAGES ARE A RESULT OF NAILS BY ABRI'S NEGLIGENCE OR OTHERWISE.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          SOME JURISDICTIONS DO NOT ALLOW THE EXCLUSION OR LIMITATION of INCIDENTAL OR CONSEQUENTIAL DAMAGES, SO THE ABOVE LIMITATIONS OR EXCLUSIONS MAY NOT APPLY TO YOU. IN SUCH JURISDICTIONS, NAILS BY ABRI'S LIABILITY SHALL BE LIMITED TO THE MAXIMUM EXTENT PERMITTED BY LAW.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>12. Indemnification</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          You agree to defend, indemnify, and hold harmless Nails by Abri and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorney's fees, arising out of or in any way connected with your use of the App or violation of these Terms.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>13. Termination</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We may terminate or suspend your account and access to the App immediately, without prior notice or liability, for any reason, including if you breach these Terms. Upon termination, your right to use the App will immediately cease.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>14. Dispute Resolution and Arbitration</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Agreement to Arbitrate:</AppText> You and Nails by Abri agree that any dispute, controversy, or claim arising out of or relating to these Terms, the App, or your use of the App, including any disputes regarding the validity, interpretation, or breach of these Terms, shall be resolved exclusively through binding arbitration, rather than in court, except as provided below.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Arbitration Rules and Location:</AppText> Any arbitration shall be conducted in accordance with the Commercial Arbitration Rules of the American Arbitration Association ("AAA") then in effect. The arbitration shall take place in Los Angeles County, California, United States, or at such other location as mutually agreed upon by the parties. The arbitration shall be conducted by a single arbitrator appointed in accordance with AAA rules.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Waiver of Jury Trial and Class Action:</AppText> You hereby waive any right to a jury trial and agree that all disputes shall be resolved on an individual basis. You further agree that you will not participate in, initiate, or be a party to any class action, collective action, or other representative proceeding against Nails by Abri. Any dispute must be brought in your individual capacity, and not as a plaintiff or class member in any purported class, collective, or representative proceeding.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Exceptions to Arbitration:</AppText> Notwithstanding the foregoing, either party may seek injunctive relief or other equitable remedies in a court of competent jurisdiction to protect intellectual property rights or to prevent irreparable harm, and either party may bring claims in small claims court if such claims qualify and remain within that court's jurisdiction.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Arbitration Costs:</AppText> Each party shall bear its own costs and expenses in connection with the arbitration, including attorneys' fees, unless otherwise required by law or as determined by the arbitrator.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          IF YOU DO NOT AGREE TO THIS ARBITRATION PROVISION, YOU MUST NOT USE THE APP AND SHOULD IMMEDIATELY TERMINATE YOUR ACCOUNT.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>15. Governing Law and Jurisdiction</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Governing Law:</AppText> These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law principles or provisions. This choice of law applies regardless of your location or the location from which you access or use the App.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>Jurisdiction for Legal Proceedings:</AppText> Except as otherwise provided in Section 14 (Dispute Resolution and Arbitration), any legal action or proceeding arising out of or relating to these Terms or the App shall be brought exclusively in the federal or state courts located in Los Angeles County, California, United States. You hereby consent to the personal jurisdiction of such courts and waive any objection to the laying of venue in such courts, including any objection based on inconvenient forum.
        </AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          <AppText style={{ fontWeight: '600' }}>No Other Jurisdictions:</AppText> You agree that you will not bring any legal action or proceeding against Nails by Abri in any jurisdiction other than California, United States, except as otherwise required by law or as provided in Section 14 (Dispute Resolution and Arbitration).
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>16. Changes to Terms</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. Your continued use of the App after any changes constitutes acceptance of the new Terms.
        </AppText>

        <AppText style={[styles.sectionTitle, { color: primaryFont }]}>17. Contact Information</AppText>
        <AppText style={[styles.bodyText, { color: primaryFont }]}>
          If you have any questions about these Terms, please contact us at NailsByAbriannaC@gmail.com.
        </AppText>

        <View style={styles.footer}>
          <AppText style={[styles.footerText, { color: secondaryFont }]}>
            By using the Nails by Abri App, you acknowledge that you have read, understood, and agree to be bound by these Terms & Conditions.
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

