import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { useTheme } from '../theme';
import { formatCurrency, getShapeCatalog, pricingConstants } from '../utils/pricing';

const shapeCatalog = getShapeCatalog();
const deliveryMethodConfig = pricingConstants.DELIVERY_METHODS;

function OrderConfirmationScreen({ order, onDone }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const surfaceColor = colors.surface || '#FFFFFF';
  const secondaryBackgroundColor = colors.secondaryBackground || '#E7D8CA';
  const primaryFontColor = colors.primaryFont || '#220707';
  const secondaryFontColor = colors.secondaryFont || '#5C5F5D';
  const borderColor = colors.border || '#D9C8A9';
  const errorColor = colors.error || '#B33A3A';

  const methodConfig =
    deliveryMethodConfig[order?.fulfillment?.method] || deliveryMethodConfig.pickup;
  const speedConfig =
    methodConfig.speedOptions[order?.fulfillment?.speed] ||
    methodConfig.speedOptions[methodConfig.defaultSpeed];
  const estimatedDate = order?.estimatedFulfillmentDate
    ? new Date(order.estimatedFulfillmentDate).toLocaleDateString()
    : null;
  const fulfillmentMethod = methodConfig.label;
  const fulfillmentSpeed = speedConfig
    ? `${speedConfig.label} – ${speedConfig.description}`
    : 'Standard';

  return (
    <ScreenContainer>
      <View style={[styles.hero, { backgroundColor: secondaryBackgroundColor }]}>
        <Text style={[styles.title, { color: primaryFontColor }]}>
          Order Confirmed!
        </Text>
        <Text style={[styles.subtitle, { color: secondaryFontColor }]}>
          Thank you for your payment. We&apos;ll begin crafting your custom set right away.
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.sectionTitle, { color: primaryFontColor }]}>Order Summary</Text>
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

      {(methodConfig.id === 'shipping' || methodConfig.id === 'delivery') && order?.fulfillment?.address ? (
        <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: primaryFontColor }]}>Ship To</Text>
          <Text style={[styles.bodyText, { color: secondaryFontColor }]}>{order.fulfillment.address.name}</Text>
          <Text style={[styles.bodyText, { color: secondaryFontColor }]}>{order.fulfillment.address.line1}</Text>
          {order.fulfillment.address.line2 ? (
            <Text style={[styles.bodyText, { color: secondaryFontColor }]}>{order.fulfillment.address.line2}</Text>
          ) : null}
          <Text style={[styles.bodyText, { color: secondaryFontColor }]}>
            {order.fulfillment.address.city}, {order.fulfillment.address.state}{' '}
            {order.fulfillment.address.postalCode}
          </Text>
        </View>
      ) : null}

      {order?.nailSets?.length ? (
        <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
          <Text style={[styles.sectionTitle, { color: primaryFontColor }]}>Nail Sets</Text>
          {order.nailSets.map((set, index) => {
            const shapeName =
              shapeCatalog.find((shape) => shape.id === set.shapeId)?.name || set.shapeId || '—';
            return (
              <View key={set.id || index} style={styles.setRow}>
                <Text style={[styles.infoLabel, { color: secondaryFontColor }]}>
                  {set.name || `Set #${index + 1}`} • {shapeName}
                </Text>
                <Text style={[styles.bodyText, { color: secondaryFontColor }]}>
                  Quantity: {set.quantity} · Size Mode:{' '}
                  {set.sizes?.mode === 'perSet' ? 'Custom' : 'Standard'}
                </Text>
                {set.setNotes ? (
                  <Text style={[styles.bodyText, { color: secondaryFontColor }]}>
                    Notes: {set.setNotes}
                  </Text>
                ) : null}
                {set.requiresFollowUp ? (
                  <Text style={[styles.warningText, { color: errorColor }]}>
                    No art uploaded — we&apos;ll contact you to clarify design.
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={[styles.card, { backgroundColor: surfaceColor, borderColor }]}>
        <Text style={[styles.sectionTitle, { color: primaryFontColor }]}>Next Steps</Text>
        <Text style={[styles.bodyText, { color: secondaryFontColor }]}>
          You&apos;ll receive an email update once your set is ready. If you selected delivery, we&apos;ll
          reach out to confirm address and drop-off details.
        </Text>
      </View>

      <PrimaryButton label="Back to Profile" onPress={onDone} />
    </ScreenContainer>
  );
}

function InfoRow({ label, value }) {
  const { theme } = useTheme();
  const colors = theme?.colors || {};
  const labelColor = colors.secondaryFont || '#5C5F5D';
  const valueColor = colors.primaryFont || '#220707';

  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: labelColor }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: valueColor }]}>{value || '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontWeight: '600',
  },
  infoValue: {
    fontWeight: '600',
    textAlign: 'right',
    maxWidth: '60%',
  },
  bodyText: {
    lineHeight: 20,
  },
  setRow: {
    marginBottom: 12,
  },
  warningText: {
    marginTop: 4,
  },
});

export default OrderConfirmationScreen;

