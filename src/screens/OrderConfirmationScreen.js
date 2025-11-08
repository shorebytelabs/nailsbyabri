import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { useTheme } from '../theme';
import { formatCurrency, getShapeCatalog } from '../utils/pricing';

const shapeCatalog = getShapeCatalog();

function OrderConfirmationScreen({ order, onDone }) {
  const { theme } = useTheme();

  const estimatedDate = order?.estimatedFulfillmentDate
    ? new Date(order.estimatedFulfillmentDate).toLocaleDateString()
    : null;
  const shapeName =
    shapeCatalog.find((shape) => shape.id === order?.shapeId)?.name || order?.shapeId || '—';

  return (
    <ScreenContainer>
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme?.colors?.secondaryBackground || styles.hero.backgroundColor,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: theme?.colors?.primaryFont || styles.title.color },
          ]}
        >
          Order Confirmed!
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: theme?.colors?.secondaryFont || styles.subtitle.color },
          ]}
        >
          Thank you for your payment. We&apos;ll begin crafting your custom set right away.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <InfoRow label="Order ID" value={order?.id} />
        <InfoRow label="Shape" value={shapeName} />
        <InfoRow label="Sets" value={String(order?.setCount || 1)} />
        <InfoRow
          label="Delivery Method"
          value={order?.deliveryMethod === 'delivery' ? 'Delivery' : 'Pickup'}
        />
        <InfoRow
          label="Speed"
          value={order?.deliverySpeed ? capitalize(order.deliverySpeed) : 'Standard'}
        />
        <InfoRow
          label="Total Paid"
          value={order?.pricing ? formatCurrency(order.pricing.total) : '—'}
        />
        {estimatedDate ? (
          <InfoRow label="Estimated Ready" value={estimatedDate} />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Next Steps</Text>
        <Text style={styles.bodyText}>
          You&apos;ll receive an email update once your set is ready. If you selected delivery, we&apos;ll
          reach out to confirm address and drop-off details.
        </Text>
      </View>

      <PrimaryButton label="Back to Profile" onPress={onDone} />
    </ScreenContainer>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

function capitalize(value) {
  if (!value) {
    return '';
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#f1f1f6',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#15133d',
  },
  subtitle: {
    marginTop: 12,
    color: '#484b7a',
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e1e4ff',
  },
  sectionTitle: {
    fontWeight: '700',
    color: '#272b75',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    color: '#5c5f8d',
    fontWeight: '600',
  },
  infoValue: {
    color: '#272b75',
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '60%',
  },
  bodyText: {
    color: '#333',
    lineHeight: 20,
  },
});

export default OrderConfirmationScreen;

