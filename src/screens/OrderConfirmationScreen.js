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
  const fulfillmentMethod =
    order?.fulfillment?.method === 'delivery'
      ? 'Local Delivery'
      : order?.fulfillment?.method === 'shipping'
      ? 'Shipping'
      : 'Studio Pickup';
  const fulfillmentSpeed = order?.fulfillment?.speed
    ? capitalize(order.fulfillment.speed)
    : 'Standard';

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
        {order?.nailSets?.map((set, index) => {
          const shapeName =
            shapeCatalog.find((shape) => shape.id === set.shapeId)?.name || set.shapeId || '—';
          return (
            <InfoRow
              key={set.id || index}
              label={`${set.name || `Set #${index + 1}`} (${shapeName})`}
              value={`${set.quantity} set${set.quantity > 1 ? 's' : ''}`}
            />
          );
        })}
        <InfoRow label="Fulfillment" value={fulfillmentMethod} />
        <InfoRow label="Speed" value={fulfillmentSpeed} />
        <InfoRow
          label="Total Paid"
          value={order?.pricing ? formatCurrency(order.pricing.total) : '—'}
        />
        {estimatedDate ? <InfoRow label="Estimated Ready" value={estimatedDate} /> : null}
        {order?.orderNotes ? <InfoRow label="Order Notes" value={order.orderNotes} /> : null}
      </View>

      {order?.fulfillment?.address ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ship To</Text>
          <Text style={styles.bodyText}>{order.fulfillment.address.name}</Text>
          <Text style={styles.bodyText}>{order.fulfillment.address.line1}</Text>
          {order.fulfillment.address.line2 ? (
            <Text style={styles.bodyText}>{order.fulfillment.address.line2}</Text>
          ) : null}
          <Text style={styles.bodyText}>
            {order.fulfillment.address.city}, {order.fulfillment.address.state}{' '}
            {order.fulfillment.address.postalCode}
          </Text>
        </View>
      ) : null}

      {order?.nailSets?.length ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nail Sets</Text>
          {order.nailSets.map((set, index) => {
            const shapeName =
              shapeCatalog.find((shape) => shape.id === set.shapeId)?.name || set.shapeId || '—';
            return (
              <View key={set.id || index} style={styles.setRow}>
                <Text style={styles.infoLabel}>
                  {set.name || `Set #${index + 1}`} • {shapeName}
                </Text>
                <Text style={styles.bodyText}>
                  Quantity: {set.quantity} · Size Mode:{' '}
                  {set.sizes?.mode === 'perSet' ? 'Custom' : 'Standard'}
                </Text>
                {set.setNotes ? <Text style={styles.bodyText}>Notes: {set.setNotes}</Text> : null}
                {set.requiresFollowUp ? (
                  <Text style={styles.warningText}>
                    No art uploaded — we&apos;ll contact you to clarify design.
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

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
  setRow: {
    marginBottom: 12,
  },
  warningText: {
    color: '#b00020',
    marginTop: 4,
  },
});

export default OrderConfirmationScreen;

