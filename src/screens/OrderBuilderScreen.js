import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { CardField, useStripe } from '@stripe/stripe-react-native';
import PrimaryButton from '../components/PrimaryButton';
import ScreenContainer from '../components/ScreenContainer';
import { useTheme } from '../theme';
import { calculatePriceBreakdown, formatCurrency, pricingConstants } from '../utils/pricing';
import shapeCatalogFallback from '../../shared/catalog/shapes.json';
import {
  createOrUpdateOrder,
  createPaymentIntent,
  completeOrder,
  fetchShapes,
} from '../services/api';

const DEFAULT_SIZES = {
  thumb: '',
  index: '',
  middle: '',
  ring: '',
  pinky: '',
};

const SPEED_OPTIONS = [
  { id: 'standard', label: pricingConstants.SPEED_RULES.standard.label },
  { id: 'priority', label: pricingConstants.SPEED_RULES.priority.label },
  { id: 'rush', label: pricingConstants.SPEED_RULES.rush.label },
];

const DELIVERY_OPTIONS = [
  { id: 'pickup', label: 'Studio Pickup' },
  { id: 'delivery', label: 'Local Delivery' },
];

function OrderBuilderScreen({
  user,
  onClose,
  onDraftSaved,
  onPaymentComplete,
  initialOrder,
}) {
  const { theme } = useTheme();
  const { confirmPayment } = useStripe();

  const [step, setStep] = useState('details');
  const [shapes, setShapes] = useState(shapeCatalogFallback);
  const [loadingShapes, setLoadingShapes] = useState(false);

  const [orderId, setOrderId] = useState(initialOrder?.id || null);
  const [shapeId, setShapeId] = useState(initialOrder?.shapeId || shapeCatalogFallback[0]?.id || '');
  const [setCount, setSetCount] = useState(String(initialOrder?.setCount || '1'));
  const [variations, setVariations] = useState(initialOrder?.variations || []);
  const [sizes, setSizes] = useState(initialOrder?.sizes || DEFAULT_SIZES);
  const [deliveryMethod, setDeliveryMethod] = useState(initialOrder?.deliveryMethod || 'pickup');
  const [deliverySpeed, setDeliverySpeed] = useState(initialOrder?.deliverySpeed || 'standard');
  const [designImage, setDesignImage] = useState(initialOrder?.designImage || null);
  const [designPreviewUri, setDesignPreviewUri] = useState(
    initialOrder?.designImage ? `data:image/jpeg;base64,${initialOrder.designImage}` : null,
  );
  const [designFileName, setDesignFileName] = useState(initialOrder?.designFileName || null);
  const [notes, setNotes] = useState(initialOrder?.notes || '');

  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  useEffect(() => {
    async function loadShapes() {
      try {
        setLoadingShapes(true);
        const catalog = await fetchShapes();
        if (catalog?.length) {
          setShapes(catalog);
          if (!catalog.find((shape) => shape.id === shapeId)) {
            setShapeId(catalog[0].id);
          }
        }
      } catch (error) {
        console.warn('Falling back to local shapes catalog', error);
      } finally {
        setLoadingShapes(false);
      }
    }

    loadShapes();
  }, [shapeId]);

  useEffect(() => {
    if (!initialOrder) {
      return;
    }
    setOrderId(initialOrder.id);
    setShapeId(initialOrder.shapeId || shapeCatalogFallback[0]?.id || '');
    setSetCount(String(initialOrder.setCount || '1'));
    setVariations(initialOrder.variations || []);
    setSizes(initialOrder.sizes || DEFAULT_SIZES);
    setDeliveryMethod(initialOrder.deliveryMethod || 'pickup');
    setDeliverySpeed(initialOrder.deliverySpeed || 'standard');
    setDesignImage(initialOrder.designImage || null);
    setDesignPreviewUri(
      initialOrder.designImage ? `data:image/jpeg;base64,${initialOrder.designImage}` : null,
    );
    setDesignFileName(initialOrder.designFileName || null);
    setNotes(initialOrder.notes || '');
  }, [initialOrder]);

  const priceDetails = useMemo(
    () =>
      calculatePriceBreakdown({
        shapeId,
        setCount,
        variations,
        sizes,
        deliveryMethod,
        deliverySpeed,
      }),
    [shapeId, setCount, variations, sizes, deliveryMethod, deliverySpeed],
  );

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === shapeId),
    [shapeId, shapes],
  );

  const canContinue =
    shapeId &&
    Number(setCount) > 0 &&
    designImage &&
    !loadingShapes;

  const handleSelectDesign = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 1024,
    });

    if (response.didCancel) {
      return;
    }

    if (response.errorMessage) {
      Alert.alert('Upload Error', response.errorMessage);
      return;
    }

    const asset = response.assets && response.assets[0];
    if (!asset || !asset.base64) {
      Alert.alert('Upload Error', 'Unable to read image. Please try again.');
      return;
    }

    setDesignImage(asset.base64);
    setDesignPreviewUri(asset.uri);
    setDesignFileName(asset.fileName || 'design-reference.jpg');
  };

  const handleAddVariation = () => {
    setVariations((prev) => [
      ...prev,
      { id: String(Date.now()), name: '', quantity: '1' },
    ]);
  };

  const handleUpdateVariation = (variationId, key, value) => {
    setVariations((prev) =>
      prev.map((item) =>
        item.id === variationId
          ? { ...item, [key]: value }
          : item,
      ),
    );
  };

  const handleRemoveVariation = (variationId) => {
    setVariations((prev) => prev.filter((item) => item.id !== variationId));
  };

  const handleSaveDraft = async () => {
    if (!user?.id) {
      Alert.alert('Unable to save', 'Please log in before saving an order.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        id: orderId,
        userId: user.id,
        shapeId,
        setCount: Number(setCount) || 1,
        variations,
        sizes,
        deliveryMethod,
        deliverySpeed,
        designImage,
        designFileName,
        notes,
        status: 'draft',
      };
      const response = await createOrUpdateOrder(payload);
      setOrderId(response.order.id);
      onDraftSaved?.(response.order);
      Alert.alert('Draft Saved', 'Your order draft has been saved.');
    } catch (error) {
      Alert.alert('Unable to save draft', error.message);
    } finally {
      setLoading(false);
    }
  };

  const prepareOrderForPayment = async () => {
    if (!canContinue) {
      Alert.alert('Missing Details', 'Please complete required fields before continuing.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        id: orderId,
        userId: user.id,
        shapeId,
        setCount: Number(setCount) || 1,
        variations,
        sizes,
        deliveryMethod,
        deliverySpeed,
        designImage,
        designFileName,
        notes,
        status: 'pending_payment',
      };
      const response = await createOrUpdateOrder(payload);
      setOrderId(response.order.id);
      const paymentIntentResponse = await createPaymentIntent(response.order.id);
      setClientSecret(paymentIntentResponse.clientSecret);
      setStep('payment');
    } catch (error) {
      Alert.alert('Unable to proceed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!clientSecret) {
      Alert.alert('Payment unavailable', 'Payment setup is incomplete. Please try again.');
      return;
    }
    setPaymentProcessing(true);

    const { paymentIntent, error } = await confirmPayment(clientSecret, {
      paymentMethodType: 'Card',
      paymentMethodData: {
        billingDetails: {
          name: user?.name || 'Guest',
          email: user?.email || undefined,
        },
      },
    });

    if (error) {
      Alert.alert('Payment failed', error.message);
      setPaymentProcessing(false);
      return;
    }

    try {
      const completion = await completeOrder(orderId, {
        paymentIntentId: paymentIntent?.id,
      });
      onPaymentComplete?.(completion.order);
    } catch (completionError) {
      Alert.alert('Order completion failed', completionError.message);
    } finally {
      setPaymentProcessing(false);
    }
  };

  const headerStyles = [
    styles.sectionHeader,
    {
      backgroundColor: theme?.colors?.secondaryBackground || styles.sectionHeader.backgroundColor,
    },
  ];

  return (
    <ScreenContainer>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.closeLink}>← Back</Text>
      </TouchableOpacity>

      <Text
        style={[
          styles.pageTitle,
          { color: theme?.colors?.primaryFont || styles.pageTitle.color },
        ]}
      >
        {step === 'details' ? 'Build Your Order' : 'Complete Payment'}
      </Text>

      {step === 'details' ? (
        <>
          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Choose Shape</Text>
          </View>
          <View style={styles.shapeGrid}>
            {shapes.map((shape) => {
              const selected = shape.id === shapeId;
              return (
                <TouchableOpacity
                  key={shape.id}
                  style={[
                    styles.shapeCard,
                    selected && {
                      borderColor: theme?.colors?.accent || '#272b75',
                    },
                  ]}
                  onPress={() => setShapeId(shape.id)}
                  disabled={loadingShapes}
                >
                  {shape.imageUrl ? (
                    <Image source={{ uri: shape.imageUrl }} style={styles.shapeImage} />
                  ) : (
                    <View style={styles.shapePlaceholder}>
                      <Text style={styles.shapePlaceholderText}>{shape.name}</Text>
                    </View>
                  )}
                  <Text style={styles.shapeName}>{shape.name}</Text>
                  <Text style={styles.shapePrice}>{formatCurrency(shape.basePrice)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Design Details</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Number of Sets</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={setCount}
              onChangeText={setSetCount}
              placeholder="1"
            />
            <Text style={styles.label}>Design Variations</Text>
            {variations.map((variation) => (
              <View key={variation.id} style={styles.variationRow}>
                <TextInput
                  style={[styles.input, styles.variationInput]}
                  placeholder="Variation name"
                  value={variation.name}
                  onChangeText={(value) => handleUpdateVariation(variation.id, 'name', value)}
                />
                <TextInput
                  style={[styles.input, styles.quantityInput]}
                  placeholder="Qty"
                  keyboardType="number-pad"
                  value={variation.quantity}
                  onChangeText={(value) => handleUpdateVariation(variation.id, 'quantity', value)}
                />
                <TouchableOpacity onPress={() => handleRemoveVariation(variation.id)}>
                  <Text style={styles.removeVariation}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity onPress={handleAddVariation}>
              <Text style={styles.addLink}>+ Add variation</Text>
            </TouchableOpacity>
          </View>

          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Upload Design</Text>
          </View>
          <View style={styles.section}>
            <PrimaryButton label="Upload Inspiration" onPress={handleSelectDesign} />
            {designPreviewUri ? (
              <Image source={{ uri: designPreviewUri }} style={styles.designPreview} />
            ) : (
              <Text style={styles.helperText}>Upload your inspiration photo to guide the design.</Text>
            )}
          </View>

          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Custom Sizes</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.helperText}>Enter custom measurements if you have them.</Text>
            <View style={styles.sizeGrid}>
              {Object.keys(DEFAULT_SIZES).map((finger) => (
                <View key={finger} style={styles.sizeItem}>
                  <Text style={styles.sizeLabel}>{finger.toUpperCase()}</Text>
                  <TextInput
                    style={styles.input}
                    value={sizes[finger]}
                    onChangeText={(value) =>
                      setSizes((prev) => ({
                        ...prev,
                        [finger]: value,
                      }))
                    }
                    placeholder="Size"
                  />
                </View>
              ))}
            </View>
          </View>

          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Fulfillment</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Delivery Method</Text>
            <View style={styles.optionRow}>
              {DELIVERY_OPTIONS.map((option) => {
                const selected = deliveryMethod === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      selected && {
                        borderColor: theme?.colors?.accent || '#272b75',
                      },
                    ]}
                    onPress={() => setDeliveryMethod(option.id)}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.label, styles.speedLabel]}>Turnaround Speed</Text>
            <View style={styles.optionRow}>
              {SPEED_OPTIONS.map((option) => {
                const selected = deliverySpeed === option.id;
                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.optionButton,
                      selected && {
                        borderColor: theme?.colors?.accent || '#272b75',
                      },
                    ]}
                    onPress={() => setDeliverySpeed(option.id)}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Notes</Text>
          </View>
          <View style={styles.section}>
            <TextInput
              style={[styles.input, styles.notesInput]}
              placeholder="Add any extra details or inspo links..."
              multiline
              numberOfLines={4}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <View style={headerStyles}>
            <Text style={styles.sectionTitle}>Price Breakdown</Text>
          </View>
          <View style={styles.section}>
            {priceDetails.lineItems.map((item) => (
              <View key={item.id} style={styles.breakdownRow}>
                <Text style={styles.breakdownLabel}>{item.label}</Text>
                <Text style={styles.breakdownAmount}>{formatCurrency(item.amount)}</Text>
              </View>
            ))}
            <View style={styles.breakdownTotalRow}>
              <Text style={styles.breakdownTotalLabel}>Total Due</Text>
              <Text style={styles.breakdownTotalAmount}>{formatCurrency(priceDetails.total)}</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity onPress={handleSaveDraft} disabled={loading}>
              <Text style={styles.secondaryAction}>Save Draft</Text>
            </TouchableOpacity>
            <PrimaryButton
              label="Continue to Payment"
              onPress={prepareOrderForPayment}
              disabled={!canContinue || loading}
              loading={loading}
            />
          </View>
        </>
      ) : (
        <View style={styles.paymentSection}>
          <Text style={styles.helperText}>
            Enter your payment details below to secure your order. Total due:{' '}
            <Text style={styles.breakdownTotalAmount}>{formatCurrency(priceDetails.total)}</Text>
          </Text>
          <CardField
            postalCodeEnabled
            placeholders={{
              number: '4242 4242 4242 4242',
            }}
            cardStyle={styles.cardField}
            style={styles.cardFieldContainer}
            onCardChange={() => {}}
          />
          <PrimaryButton
            label="Pay & Submit Order"
            onPress={handleConfirmPayment}
            loading={paymentProcessing}
          />
          <TouchableOpacity onPress={() => setStep('details')} style={styles.backLink}>
            <Text style={styles.secondaryAction}>← Back to details</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  closeLink: {
    color: '#272b75',
    marginBottom: 16,
    fontWeight: '600',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#15133d',
    marginBottom: 12,
  },
  sectionHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f1f6',
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#272b75',
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  shapeCard: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d9ddff',
    padding: 12,
    backgroundColor: '#fff',
  },
  shapeImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    marginBottom: 8,
  },
  shapePlaceholder: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shapePlaceholderText: {
    color: '#555',
    fontWeight: '600',
  },
  shapeName: {
    fontWeight: '600',
    color: '#272b75',
  },
  shapePrice: {
    color: '#555',
    marginTop: 4,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '600',
    color: '#272b75',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },
  variationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  variationInput: {
    flex: 1,
    marginRight: 8,
  },
  quantityInput: {
    width: 60,
    marginRight: 8,
  },
  removeVariation: {
    color: '#b00020',
  },
  addLink: {
    marginTop: 8,
    color: '#272b75',
    fontWeight: '600',
  },
  designPreview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    marginTop: 12,
  },
  helperText: {
    marginTop: 12,
    color: '#555',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  sizeItem: {
    width: '30%',
  },
  sizeLabel: {
    marginBottom: 4,
    fontWeight: '600',
    color: '#272b75',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  optionButton: {
    borderWidth: 2,
    borderColor: '#d9ddff',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  optionText: {
    color: '#272b75',
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#111',
  },
  speedLabel: {
    marginTop: 24,
  },
  notesInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  breakdownLabel: {
    color: '#272b75',
  },
  breakdownAmount: {
    color: '#272b75',
    fontWeight: '600',
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d9ddff',
  },
  breakdownTotalLabel: {
    fontWeight: '700',
    color: '#272b75',
  },
  breakdownTotalAmount: {
    fontWeight: '700',
    color: '#272b75',
  },
  actionRow: {
    marginTop: 24,
    gap: 12,
  },
  secondaryAction: {
    color: '#272b75',
    fontWeight: '600',
    marginBottom: 12,
  },
  paymentSection: {
    marginTop: 16,
    gap: 20,
  },
  cardField: {
    backgroundColor: '#fff',
    textColor: '#000',
  },
  cardFieldContainer: {
    height: 50,
    marginVertical: 20,
  },
  backLink: {
    alignItems: 'center',
  },
});

export default OrderBuilderScreen;

