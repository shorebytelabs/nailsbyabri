import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { fetchShapes, createOrUpdateOrder } from '../services/api';
import { calculatePriceBreakdown, pricingConstants } from '../utils/pricing';
import PrimaryButton from '../components/PrimaryButton';
import { logEvent } from '../utils/analytics';
import { launchImageLibrary } from 'react-native-image-picker';

const STEP_DEFINITIONS = [
  { key: 'shape', title: 'Choose a shape', subtitle: 'Pick the silhouette for this set.' },
  {
    key: 'design',
    title: 'Design details',
    subtitle: 'Upload inspiration images or describe your art direction.',
  },
  { key: 'sizing', title: 'Sizing & quantity', subtitle: 'Select quantity and sizing mode.' },
  { key: 'fulfillment', title: 'Fulfilment', subtitle: 'How should we deliver your set?' },
  { key: 'review', title: 'Review & submit', subtitle: 'Double-check everything looks right.' },
];

const DEFAULT_SIZES = {
  thumb: '',
  index: '',
  middle: '',
  ring: '',
  pinky: '',
};

const VARIANT_OPTIONS = ['Create Set', 'Design', 'Make Magic'];

function NewOrderStepperScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleDraftSaved, handleOrderComplete } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const colors = theme?.colors || {};
  const horizontalSpacing = Math.max(16, Math.min(28, width * 0.06));
  const isCompact = width < 900;

  const [shapes, setShapes] = useState([]);
  const [loadingShapes, setLoadingShapes] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [openingLegacyBuilder, setOpeningLegacyBuilder] = useState(false);
  const [draftOrderId, setDraftOrderId] = useState(null);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    shapeId: null,
    designDescription: '',
    designUploads: [],
    requiresFollowUp: false,
    quantity: 1,
    sizeMode: 'standard',
    sizes: DEFAULT_SIZES,
    fulfillment: {
      method: 'pickup',
      speed: 'standard',
      address: {
        name: '',
        line1: '',
        line2: '',
        city: '',
        state: '',
        postalCode: '',
      },
    },
  });

  useEffect(() => {
    logEvent('start_order_step', { step: STEP_DEFINITIONS[currentStep].key });
  }, [currentStep]);

  useEffect(() => {
    const loadShapes = async () => {
      try {
        setLoadingShapes(true);
        const catalog = await fetchShapes();
        setShapes(catalog);
      } catch (err) {
        setShapes([]);
      } finally {
        setLoadingShapes(false);
      }
    };

    loadShapes();
  }, []);

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === form.shapeId),
    [form.shapeId, shapes],
  );

  const priceDetails = useMemo(() => {
    if (!form.shapeId) {
      return null;
    }
    const payload = {
      nailSets: [
        {
          id: draftOrderId || `set_${Date.now()}`,
          name: selectedShape?.name || 'Custom Set',
          shapeId: form.shapeId,
          quantity: form.quantity,
          description: form.designDescription,
          setNotes: '',
          designUploads: form.designUploads,
          requiresFollowUp: form.requiresFollowUp,
          sizes:
            form.sizeMode === 'perSet'
              ? { mode: 'perSet', values: form.sizes }
              : { mode: 'standard', values: {} },
        },
      ],
      fulfillment: form.fulfillment,
      promoCode: null,
    };
    return calculatePriceBreakdown(payload);
  }, [draftOrderId, form, selectedShape]);

  const handleNext = () => {
    setError(null);
    if (currentStep === 0 && !form.shapeId) {
      setError('Select a shape to continue.');
      return;
    }
    if (currentStep === 1) {
      const hasDescription = Boolean(form.designDescription && form.designDescription.trim());
      const hasUploads = Array.isArray(form.designUploads) && form.designUploads.length > 0;
      if (!hasDescription && !hasUploads && !form.requiresFollowUp) {
        setError('Add inspiration, describe your design, or mark for follow-up.');
        return;
      }
    }
    if (currentStep === 2) {
      if (!form.quantity || Number.isNaN(Number(form.quantity)) || Number(form.quantity) < 1) {
        setError('Quantity must be at least 1.');
        return;
      }
    }
    if (currentStep === 3) {
      if (
        (form.fulfillment.method === 'delivery' || form.fulfillment.method === 'shipping') &&
        (!form.fulfillment.address.name || !form.fulfillment.address.line1 || !form.fulfillment.address.city)
      ) {
        setError('Please provide a full delivery address.');
        return;
      }
    }

    if (currentStep < STEP_DEFINITIONS.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const buildOrderPayload = (status = 'draft') => ({
    id: draftOrderId,
    userId: state.currentUser?.id,
    nailSets: [
      {
        id: draftOrderId || `set_${Date.now()}`,
        name: selectedShape?.name || 'Custom Set',
        shapeId: form.shapeId,
        quantity: Number(form.quantity) || 1,
        description: form.designDescription,
        setNotes: '',
        designUploads: (form.designUploads || []).map((upload, index) => ({
          id: upload.id || `upload_${index}`,
          fileName: upload.fileName || null,
          base64: upload.base64 || null,
        })),
        requiresFollowUp: form.requiresFollowUp,
        sizes:
          form.sizeMode === 'perSet'
            ? { mode: 'perSet', values: form.sizes }
            : { mode: 'standard', values: {} },
      },
    ],
    fulfillment: form.fulfillment,
    orderNotes: null,
    promoCode: null,
    status,
  });

  const persistDraftOrder = async () => {
    const payload = buildOrderPayload('draft');
    const response = await createOrUpdateOrder(payload);
    setDraftOrderId(response.order.id);
    handleDraftSaved(response.order);
    return response.order;
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      const order = await persistDraftOrder();
      logEvent('save_order_draft', { order_id: order.id });
      Alert.alert('Draft saved', 'You can continue editing this set anytime.');
    } catch (err) {
      Alert.alert('Unable to save draft', err.message || 'Please try again.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleOpenLegacyBuilder = async () => {
    try {
      setOpeningLegacyBuilder(true);
      const order = await persistDraftOrder();
      logEvent('tap_open_legacy_builder', { order_id: order.id });
      navigation.navigate('LegacyOrderBuilder');
    } catch (err) {
      Alert.alert('Unable to open advanced builder', err.message || 'Please try again.');
    } finally {
      setOpeningLegacyBuilder(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const payload = buildOrderPayload('submitted');
      const response = await createOrUpdateOrder(payload);
      setDraftOrderId(response.order.id);
      handleOrderComplete(response.order, 'default');
      logEvent('complete_order', { order_id: response.order.id, variant: 'default' });
      navigation.replace('OrderConfirmation', { order: response.order });
    } catch (err) {
      Alert.alert('Unable to submit order', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const methodConfig =
    pricingConstants.DELIVERY_METHODS[form.fulfillment.method] ||
    pricingConstants.DELIVERY_METHODS.pickup;

  const handleAddDesignUpload = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.85,
        maxWidth: 1500,
      });

      if (response.didCancel) {
        return;
      }

      if (response.errorCode || response.errorMessage) {
        Alert.alert('Upload error', response.errorMessage || 'Unable to select image.');
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.base64) {
        Alert.alert('Upload error', 'Unable to read the selected image. Please try again.');
        return;
      }

      const upload = {
        id: `upload_${Date.now()}`,
        uri: asset.uri || null,
        fileName: asset.fileName || 'design-reference.jpg',
        base64: asset.base64,
      };

      setForm((prev) => ({
        ...prev,
        designUploads: [...(prev.designUploads || []), upload],
      }));
    } catch (err) {
      Alert.alert('Upload error', err.message || 'Something went wrong. Please try again.');
    }
  };

  const handleRemoveDesignUpload = (uploadId) => {
    setForm((prev) => ({
      ...prev,
      designUploads: (prev.designUploads || []).filter((item) => item.id !== uploadId),
    }));
  };

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: colors.primaryBackground || '#F7F7FB' },
      ]}
      edges={['top', 'left', 'right']}
    >
      <View
        style={[
          styles.screen,
          {
            paddingBottom: Math.max(insets.bottom, 0),
          },
        ]}
      >
        <View
          style={[
            styles.progressContainer,
            { paddingHorizontal: horizontalSpacing, paddingTop: Math.max(insets.top, 12) },
          ]}
        >
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent || '#531C22',
                  width: `${((currentStep + 1) / STEP_DEFINITIONS.length) * 100}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.progressLabel,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            Step {currentStep + 1} of {STEP_DEFINITIONS.length}
          </Text>
        </View>

        <View
          style={[
            styles.contentContainer,
            {
              flexDirection: isCompact ? 'column' : 'row',
              gap: isCompact ? 16 : 24,
              paddingHorizontal: horizontalSpacing,
            },
          ]}
        >
          <View
            style={[
              styles.previewPanel,
              {
                width: isCompact ? '100%' : 180,
                flexDirection: 'column',
                gap: 12,
                marginBottom: isCompact ? 8 : 0,
              },
            ]}
          >
            <Text
              style={[
                styles.previewTitle,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              Mini preview
            </Text>
            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor: colors.surface || '#FFFFFF',
                  borderColor: colors.border || '#D9C8A9',
                },
              ]}
            >
              <Text
                style={[
                  styles.previewHeading,
                  { color: colors.primaryFont || '#220707' },
                ]}
              >
                {selectedShape?.name || 'Shape'}
              </Text>
              <Text
                style={[
                  styles.previewDetail,
                  { color: colors.secondaryFont || '#5C5F5D' },
                ]}
              >
                {form.designDescription || 'Design description will appear here.'}
              </Text>
              <View style={styles.previewMeta}>
                <Text
                  style={[
                    styles.previewMetaText,
                    { color: colors.secondaryFont || '#5C5F5D' },
                  ]}
                >
                  Inspiration images: {form.designUploads?.length || 0}
                </Text>
                <Text
                  style={[
                    styles.previewMetaText,
                    { color: colors.secondaryFont || '#5C5F5D' },
                  ]}
                >
                  Follow-up: {form.requiresFollowUp ? 'Requested' : 'Not needed'}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.stepContainer,
              { paddingBottom: Math.max(insets.bottom + 160, 200) },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.stepTitle,
                { color: colors.primaryFont || '#220707' },
              ]}
            >
              {STEP_DEFINITIONS[currentStep].title}
            </Text>
            <Text
              style={[
                styles.stepSubtitle,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              {STEP_DEFINITIONS[currentStep].subtitle}
            </Text>

            {error ? (
              <Text
                style={[
                  styles.errorText,
                  { color: colors.accent || '#531C22' },
                ]}
              >
                {error}
              </Text>
            ) : null}

            {currentStep === 0 ? (
              <ShapeStep
                colors={colors}
                shapes={shapes}
                loading={loadingShapes}
                selectedShapeId={form.shapeId}
                onSelect={(shapeId) => setForm((prev) => ({ ...prev, shapeId }))}
              />
            ) : null}

            {currentStep === 1 ? (
              <DesignStep
                colors={colors}
                description={form.designDescription}
                designUploads={form.designUploads}
                requiresFollowUp={form.requiresFollowUp}
                onAddUpload={handleAddDesignUpload}
                onChangeDescription={(designDescription) =>
                  setForm((prev) => ({ ...prev, designDescription }))
                }
                onRemoveUpload={handleRemoveDesignUpload}
                onToggleFollowUp={(requiresFollowUp) =>
                  setForm((prev) => ({ ...prev, requiresFollowUp }))
                }
              />
            ) : null}

            {currentStep === 2 ? (
              <SizingStep
                colors={colors}
                quantity={String(form.quantity)}
                sizeMode={form.sizeMode}
                sizes={form.sizes}
                onChangeQuantity={(quantity) => setForm((prev) => ({ ...prev, quantity }))}
                onSelectSizeMode={(sizeMode) =>
                  setForm((prev) => ({ ...prev, sizeMode }))
                }
                onChangeSizes={(sizes) =>
                  setForm((prev) => ({ ...prev, sizes: { ...prev.sizes, ...sizes } }))
                }
              />
            ) : null}

            {currentStep === 3 ? (
              <FulfillmentStep
                colors={colors}
                fulfillment={form.fulfillment}
                onChangeMethod={(method) =>
                  setForm((prev) => ({
                    ...prev,
                    fulfillment: {
                      ...prev.fulfillment,
                      method,
                      speed:
                        pricingConstants.DELIVERY_METHODS[method]?.defaultSpeed || 'standard',
                    },
                  }))
                }
                onChangeSpeed={(speed) =>
                  setForm((prev) => ({
                    ...prev,
                    fulfillment: {
                      ...prev.fulfillment,
                      speed,
                    },
                  }))
                }
                onChangeAddress={(address) =>
                  setForm((prev) => ({
                    ...prev,
                    fulfillment: {
                      ...prev.fulfillment,
                      address: {
                        ...prev.fulfillment.address,
                        ...address,
                      },
                    },
                  }))
                }
              />
            ) : null}

            {currentStep === 4 && priceDetails ? (
              <ReviewStep
                colors={colors}
                priceDetails={priceDetails}
                variantText={VARIANT_OPTIONS}
                onOpenAdvancedBuilder={handleOpenLegacyBuilder}
                openingLegacy={openingLegacyBuilder}
              />
            ) : null}
          </ScrollView>
        </View>

        <View
          style={[
            styles.footer,
            {
              paddingHorizontal: horizontalSpacing,
              paddingBottom: Math.max(insets.bottom + 12, 28),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text
              style={[
                styles.backText,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              Back
            </Text>
          </TouchableOpacity>
          {currentStep < STEP_DEFINITIONS.length - 1 ? (
            <PrimaryButton
              label="Next"
              onPress={handleNext}
              style={styles.nextButton}
              accessibilityLabel="Go to next step"
            />
          ) : (
            <View style={styles.submitActions}>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { borderColor: colors.accent || '#531C22' },
                ]}
                onPress={handleSaveDraft}
                disabled={savingDraft}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {savingDraft ? (
                  <ActivityIndicator color={colors.accent || '#531C22'} />
                ) : (
                  <Text
                    style={[
                      styles.secondaryButtonText,
                      { color: colors.accent || '#531C22' },
                    ]}
                  >
                    Save draft
                  </Text>
                )}
              </TouchableOpacity>
              <PrimaryButton
                label={submitting ? 'Submitting…' : 'Submit order'}
                onPress={handleSubmit}
                loading={submitting}
                style={styles.nextButton}
                accessibilityLabel="Submit your nail set order"
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ShapeStep({ colors, shapes, selectedShapeId, onSelect, loading }) {
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.accent || '#531C22'} />
      </View>
    );
  }

  return (
    <View style={styles.shapeGrid}>
      {shapes.map((shape) => {
        const isSelected = selectedShapeId === shape.id;
        return (
          <TouchableOpacity
            key={shape.id}
            style={[
              styles.shapeCard,
              {
                borderColor: isSelected
                  ? colors.accent || '#531C22'
                  : colors.border || '#D9C8A9',
                backgroundColor: isSelected ? `${(colors.accent || '#531C22')}10` : '#FFFFFF',
              },
            ]}
            onPress={() => onSelect(shape.id)}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.shapeName,
                { color: colors.primaryFont || '#220707' },
              ]}
            >
              {shape.name}
            </Text>
            <Text
              style={[
                styles.shapeDescription,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              Base £{Number(shape.basePrice || 0).toFixed(2)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DesignStep({
  colors,
  description,
  designUploads,
  requiresFollowUp,
  onAddUpload,
  onChangeDescription,
  onRemoveUpload,
  onToggleFollowUp,
}) {
  const uploads = Array.isArray(designUploads) ? designUploads : [];
  const uploadCount = uploads.length;

  return (
    <View style={styles.designContainer}>
      <View
        style={[
          styles.designUploadCard,
          {
            borderColor: colors.border || '#D9C8A9',
            backgroundColor: colors.surface || '#FFFFFF',
          },
        ]}
      >
        <View style={styles.designUploadHeader}>
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.primaryFont || '#220707' },
            ]}
          >
            Design uploads
          </Text>
          {uploadCount > 0 ? (
            <Text
              style={[
                styles.designUploadCount,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              {uploadCount} {uploadCount === 1 ? 'image' : 'images'} added
            </Text>
          ) : null}
        </View>
        <PrimaryButton
          label="Add Inspiration Image"
          onPress={onAddUpload}
          style={styles.designUploadButton}
        />
        {uploadCount > 0 ? (
          <View style={styles.designUploadGrid}>
            {uploads.map((upload) => {
              const imageSource =
                upload.uri
                  ? { uri: upload.uri }
                  : upload.base64
                  ? { uri: `data:image/jpeg;base64,${upload.base64}` }
                  : null;
              return (
                <View
                  key={upload.id}
                  style={[
                    styles.designUploadItem,
                    {
                      borderColor: colors.border || '#D9C8A9',
                      backgroundColor: colors.surface || '#FFFFFF',
                    },
                  ]}
                >
                  {imageSource ? (
                    <Image source={imageSource} style={styles.designUploadImage} />
                  ) : (
                    <View
                      style={[
                        styles.designUploadEmpty,
                        { backgroundColor: `${(colors.secondaryBackground || '#E7D8CA')}80` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.designUploadEmptyText,
                          { color: colors.primaryFont || '#220707' },
                        ]}
                      >
                        No preview
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity onPress={() => onRemoveUpload(upload.id)}>
                    <Text
                      style={[
                        styles.designUploadRemove,
                        { color: colors.accent || '#531C22' },
                      ]}
                    >
                      Remove
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          <Text
            style={[
              styles.designUploadHint,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            Upload photos of the designs or describe it below. If neither, mark for follow-up.
          </Text>
        )}
      </View>

      <View style={styles.designDescriptionBlock}>
        <Text
          style={[
            styles.sectionLabel,
            { color: colors.primaryFont || '#220707' },
          ]}
        >
          Design description
        </Text>
        <TextInput
          value={description}
          onChangeText={onChangeDescription}
          placeholder="Describe colour, finish, art placement or upload instructions…"
          placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
          multiline
          style={[
            styles.designInput,
            {
              borderColor: colors.border || '#D9C8A9',
              color: colors.primaryFont || '#220707',
              backgroundColor: colors.surface || '#FFFFFF',
            },
          ]}
        />
      </View>

      <View style={styles.followUpRow}>
        <View style={styles.followUpCopy}>
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.primaryFont || '#220707' },
            ]}
          >
            Need design help?
          </Text>
          <Text
            style={[
              styles.designUploadHint,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            Mark for follow-up and we’ll contact you to finalise details.
          </Text>
        </View>
        <Switch
          value={requiresFollowUp}
          onValueChange={onToggleFollowUp}
          trackColor={{
            false: `${(colors.secondaryBackground || '#E7D8CA')}70`,
            true: colors.accent || '#531C22',
          }}
        />
      </View>
    </View>
  );
}

function SizingStep({
  colors,
  quantity,
  sizeMode,
  sizes,
  onChangeQuantity,
  onSelectSizeMode,
  onChangeSizes,
}) {
  return (
    <View style={styles.sizingContainer}>
      <Text
        style={[
          styles.sectionLabel,
          { color: colors.primaryFont || '#220707' },
        ]}
      >
        Quantity
      </Text>
      <View style={styles.quantityRow}>
        <TouchableOpacity
          style={[
            styles.quantityButton,
            { borderColor: colors.border || '#D9C8A9' },
          ]}
          onPress={() =>
            onChangeQuantity(String(Math.max(1, Number(quantity || 1) - 1)))
          }
        >
          <Text style={styles.quantityButtonText}>-</Text>
        </TouchableOpacity>
        <TextInput
          value={quantity}
          onChangeText={(value) => onChangeQuantity(value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          style={[
            styles.quantityInput,
            {
              borderColor: colors.border || '#D9C8A9',
              color: colors.primaryFont || '#220707',
            },
          ]}
        />
        <TouchableOpacity
          style={[
            styles.quantityButton,
            { borderColor: colors.border || '#D9C8A9' },
          ]}
          onPress={() => onChangeQuantity(String(Number(quantity || 1) + 1))}
        >
          <Text style={styles.quantityButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <Text
        style={[
          styles.sectionLabel,
          { color: colors.primaryFont || '#220707' },
        ]}
      >
        Sizing
      </Text>
      <View style={styles.modeRow}>
        {['standard', 'perSet'].map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeChip,
              {
                borderColor:
                  sizeMode === mode ? colors.accent || '#531C22' : colors.border || '#D9C8A9',
                backgroundColor:
                  sizeMode === mode ? `${(colors.accent || '#531C22')}12` : '#FFFFFF',
              },
            ]}
            onPress={() => onSelectSizeMode(mode)}
          >
            <Text
              style={[
                styles.modeLabel,
                {
                  color:
                    sizeMode === mode ? colors.accent || '#531C22' : colors.secondaryFont || '#5C5F5D',
                },
              ]}
            >
              {mode === 'standard' ? 'Standard sizes' : 'Enter sizes'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sizeMode === 'perSet' ? (
        <View style={styles.sizeGrid}>
          {Object.keys(sizes).map((finger) => (
            <View key={finger} style={styles.sizeCell}>
              <Text
                style={[
                  styles.sizeLabel,
                  { color: colors.secondaryFont || '#5C5F5D' },
                ]}
              >
                {finger.toUpperCase()}
              </Text>
              <TextInput
                value={sizes[finger]}
                onChangeText={(value) => onChangeSizes({ [finger]: value })}
                placeholder="Size"
                placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
                style={[
                  styles.sizeInput,
                  {
                    borderColor: colors.border || '#D9C8A9',
                    color: colors.primaryFont || '#220707',
                  },
                ]}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function FulfillmentStep({ colors, fulfillment, onChangeMethod, onChangeSpeed, onChangeAddress }) {
  return (
    <View style={styles.fulfillmentContainer}>
      <Text
        style={[
          styles.sectionLabel,
          { color: colors.primaryFont || '#220707' },
        ]}
      >
        Delivery method
      </Text>
      <View style={styles.methodRow}>
        {Object.values(pricingConstants.DELIVERY_METHODS).map((method) => {
          const isActive = fulfillment.method === method.id;
          return (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.methodCard,
                {
                  borderColor: isActive
                    ? colors.accent || '#531C22'
                    : colors.border || '#D9C8A9',
                  backgroundColor: isActive ? `${(colors.accent || '#531C22')}12` : '#FFFFFF',
                },
              ]}
              onPress={() => onChangeMethod(method.id)}
            >
              <Text
                style={[
                  styles.methodTitle,
                  { color: colors.primaryFont || '#220707' },
                ]}
              >
                {method.label}
              </Text>
              <Text
                style={[
                  styles.methodDescription,
                  { color: colors.secondaryFont || '#5C5F5D' },
                ]}
              >
                {method.description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text
        style={[
          styles.sectionLabel,
          { color: colors.primaryFont || '#220707' },
        ]}
      >
        Delivery timing
      </Text>
      <View style={styles.speedRow}>
        {Object.values(
          pricingConstants.DELIVERY_METHODS[fulfillment.method].speedOptions,
        ).map((speed) => {
          const isActive = fulfillment.speed === speed.id;
          return (
            <TouchableOpacity
              key={speed.id}
              style={[
                styles.speedCard,
                {
                  borderColor: isActive
                    ? colors.accent || '#531C22'
                    : colors.border || '#D9C8A9',
                  backgroundColor: isActive ? `${(colors.accent || '#531C22')}10` : '#FFFFFF',
                },
              ]}
              onPress={() => onChangeSpeed(speed.id)}
            >
              <Text
                style={[
                  styles.speedTitle,
                  { color: colors.primaryFont || '#220707' },
                ]}
              >
                {speed.label}
              </Text>
              <Text
                style={[
                  styles.speedDescription,
                  { color: colors.secondaryFont || '#5C5F5D' },
                ]}
              >
                {speed.description}
              </Text>
              <Text
                style={[
                  styles.speedFee,
                  { color: colors.accent || '#531C22' },
                ]}
              >
                £{Number(speed.fee || 0).toFixed(2)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {(fulfillment.method === 'delivery' || fulfillment.method === 'shipping') && (
        <View style={styles.addressForm}>
          <Text
            style={[
              styles.sectionLabel,
              { color: colors.primaryFont || '#220707' },
            ]}
          >
            Delivery address
          </Text>
          <TextInput
            value={fulfillment.address.name}
            onChangeText={(value) => onChangeAddress({ name: value })}
            placeholder="Full name"
            placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
            style={[
              styles.addressInput,
              {
                borderColor: colors.border || '#D9C8A9',
                color: colors.primaryFont || '#220707',
              },
            ]}
          />
          <TextInput
            value={fulfillment.address.line1}
            onChangeText={(value) => onChangeAddress({ line1: value })}
            placeholder="Address line 1"
            placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
            style={[
              styles.addressInput,
              {
                borderColor: colors.border || '#D9C8A9',
                color: colors.primaryFont || '#220707',
              },
            ]}
          />
          <TextInput
            value={fulfillment.address.line2}
            onChangeText={(value) => onChangeAddress({ line2: value })}
            placeholder="Address line 2 (optional)"
            placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
            style={[
              styles.addressInput,
              {
                borderColor: colors.border || '#D9C8A9',
                color: colors.primaryFont || '#220707',
              },
            ]}
          />
          <View style={styles.addressRow}>
            <TextInput
              value={fulfillment.address.city}
              onChangeText={(value) => onChangeAddress({ city: value })}
              placeholder="City"
              placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
              style={[
                styles.addressInputHalf,
                {
                  borderColor: colors.border || '#D9C8A9',
                  color: colors.primaryFont || '#220707',
                },
              ]}
            />
            <TextInput
              value={fulfillment.address.state}
              onChangeText={(value) => onChangeAddress({ state: value })}
              placeholder="State"
              placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
              autoCapitalize="characters"
              style={[
                styles.addressInputQuarter,
                {
                  borderColor: colors.border || '#D9C8A9',
                  color: colors.primaryFont || '#220707',
                },
              ]}
            />
            <TextInput
              value={fulfillment.address.postalCode}
              onChangeText={(value) => onChangeAddress({ postalCode: value })}
              placeholder="Postcode"
              placeholderTextColor={colors.secondaryFont || '#5C5F5D'}
              style={[
                styles.addressInputQuarter,
                {
                  borderColor: colors.border || '#D9C8A9',
                  color: colors.primaryFont || '#220707',
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function ReviewStep({ colors, priceDetails, variantText, onOpenAdvancedBuilder, openingLegacy }) {
  return (
    <View style={styles.reviewContainer}>
      <Text
        style={[
          styles.reviewHeading,
          { color: colors.primaryFont || '#220707' },
        ]}
      >
        Summary
      </Text>
      <View style={styles.priceList}>
        {priceDetails.lineItems.map((item) => (
          <View key={item.id} style={styles.priceRow}>
            <Text
              style={[
                styles.priceLabel,
                { color: colors.secondaryFont || '#5C5F5D' },
              ]}
            >
              {item.label}
            </Text>
            <Text
              style={[
                styles.priceValue,
                { color: colors.primaryFont || '#220707' },
              ]}
            >
              £{Number(item.amount || 0).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.totalRow}>
        <Text
          style={[
            styles.totalLabel,
            { color: colors.primaryFont || '#220707' },
          ]}
        >
          Total
        </Text>
        <Text
          style={[
            styles.totalValue,
            { color: colors.accent || '#531C22' },
          ]}
        >
          £{Number(priceDetails.total || 0).toFixed(2)}
        </Text>
      </View>
      <Text
        style={[
          styles.etaText,
          { color: colors.secondaryFont || '#5C5F5D' },
        ]}
      >
        Estimated completion: {priceDetails.estimatedCompletionDate ? new Date(priceDetails.estimatedCompletionDate).toLocaleDateString() : `${priceDetails.estimatedCompletionDays} business days`}
      </Text>
      <View style={styles.variantBlock}>
        <Text
          style={[
            styles.variantTitle,
            { color: colors.primaryFont || '#220707' },
          ]}
        >
          Playful CTA variants
        </Text>
        {variantText.map((variant) => (
          <Text
            key={variant}
            style={[
              styles.variantText,
              { color: colors.secondaryFont || '#5C5F5D' },
            ]}
          >
            • {variant}
          </Text>
        ))}
      </View>
      <View
        style={[
          styles.advancedCard,
          {
            borderColor: colors.border || '#D9C8A9',
            backgroundColor: colors.surface || '#FFFFFF',
          },
        ]}
      >
        <Text
          style={[
            styles.advancedTitle,
            { color: colors.primaryFont || '#220707' },
          ]}
        >
          Need advanced options?
        </Text>
        <Text
          style={[
            styles.advancedHint,
            { color: colors.secondaryFont || '#5C5F5D' },
          ]}
        >
          Add multiple nail sets, upload inspiration photos, or tweak fulfilment in detail.
        </Text>
        <TouchableOpacity
          style={[
            styles.advancedButton,
            { borderColor: colors.accent || '#531C22' },
          ]}
          onPress={onOpenAdvancedBuilder}
          disabled={openingLegacy}
          accessibilityLabel="Open advanced nail set builder"
        >
          {openingLegacy ? (
            <ActivityIndicator color={colors.accent || '#531C22'} />
          ) : (
            <Text
              style={[
                styles.advancedButtonText,
                { color: colors.accent || '#531C22' },
              ]}
            >
              Open advanced builder
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  screen: {
    flex: 1,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    gap: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 20,
  },
  previewPanel: {
    gap: 12,
  },
  previewTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  previewCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  previewHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  previewDetail: {
    fontSize: 12,
    lineHeight: 18,
  },
  previewMeta: {
    gap: 4,
  },
  previewMetaText: {
    fontSize: 11,
    fontWeight: '600',
  },
  stepContainer: {
    flexGrow: 1,
    paddingBottom: 120,
    gap: 16,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  stepSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shapeCard: {
    width: '48%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  shapeName: {
    fontSize: 16,
    fontWeight: '700',
  },
  shapeDescription: {
    fontSize: 12,
  },
  designContainer: {
    gap: 16,
  },
  designUploadCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  designUploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  designUploadCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  designUploadButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  designUploadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  designUploadItem: {
    width: 92,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
  },
  designUploadImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
  },
  designUploadEmpty: {
    width: 80,
    height: 80,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  designUploadEmptyText: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  designUploadRemove: {
    fontSize: 12,
    fontWeight: '600',
  },
  designUploadHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  designDescriptionBlock: {
    gap: 8,
  },
  designInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    minHeight: 130,
    textAlignVertical: 'top',
    fontSize: 14,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  followUpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  followUpCopy: {
    flex: 1,
    gap: 4,
    paddingRight: 12,
  },
  sizingContainer: {
    gap: 20,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontSize: 24,
    fontWeight: '700',
  },
  quantityInput: {
    width: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    paddingVertical: 10,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeChip: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sizeCell: {
    width: '30%',
    gap: 6,
  },
  sizeLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  sizeInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
  },
  fulfillmentContainer: {
    gap: 18,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  methodCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  methodTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  methodDescription: {
    fontSize: 12,
  },
  speedRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  speedCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 4,
  },
  speedTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  speedDescription: {
    fontSize: 12,
  },
  speedFee: {
    fontSize: 12,
    fontWeight: '700',
  },
  addressForm: {
    gap: 12,
  },
  addressInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressInputHalf: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  addressInputQuarter: {
    flex: 0.7,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
  },
  reviewContainer: {
    gap: 12,
  },
  reviewHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  priceList: {
    gap: 6,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  priceLabel: {
    fontSize: 13,
  },
  priceValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 10,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  etaText: {
    fontSize: 12,
  },
  variantBlock: {
    marginTop: 8,
    gap: 4,
  },
  variantTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  variantText: {
    fontSize: 12,
  },
  advancedCard: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 10,
  },
  advancedTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  advancedHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  advancedButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 16,
  },
  backButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 16,
    fontWeight: '700',
  },
  nextButton: {
    flex: 1,
  },
  submitActions: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  legacyBuilderButton: {
    marginTop: 16,
  },
});

export default NewOrderStepperScreen;

