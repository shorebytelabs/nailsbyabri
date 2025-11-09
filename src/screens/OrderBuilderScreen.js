import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
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
import {
  calculatePriceBreakdown,
  formatCurrency,
  getShapeCatalog,
  pricingConstants,
} from '../utils/pricing';
import {
  createOrUpdateOrder,
  createPaymentIntent,
  completeOrder,
  fetchShapes,
} from '../services/api';

const SIZE_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

const BASE_SIZE_VALUES = SIZE_KEYS.reduce((acc, key) => {
  acc[key] = '';
  return acc;
}, {});

function createEmptyNailSet(shapes) {
  return {
    id: `temp_${Date.now()}`,
    name: '',
    shapeId: shapes[0]?.id || '',
    quantity: '1',
    description: '',
    designUploads: [],
    setNotes: '',
    sizes: {
      mode: 'standard',
      values: BASE_SIZE_VALUES,
    },
    requiresFollowUp: false,
  };
}

function transformUploadsForSave(uploads) {
  return uploads.map((upload) => ({
    id: upload.id,
    fileName: upload.fileName || null,
    data: upload.base64,
  }));
}

function validateNailSet(set) {
  const hasDesign = Array.isArray(set.designUploads) && set.designUploads.length > 0;
  const hasDescription = Boolean(set.description && set.description.trim().length > 0);
  return hasDesign || hasDescription || Boolean(set.requiresFollowUp);
}

function NailSetEditor({
  visible,
  shapes,
  theme,
  value,
  onCancel,
  onSave,
}) {
  const [form, setForm] = useState(value);

  useEffect(() => {
    setForm(value);
  }, [value]);

  const currentForm = form || value;
  const isNewSet = !currentForm?.id || currentForm.id.startsWith('temp_');

  if (!visible || !currentForm) {
    return null;
  }

  const handleSelectShape = (shapeId) => {
    setForm((prev) => ({ ...prev, shapeId }));
  };

  const handleUploadDesign = async () => {
    const response = await launchImageLibrary({
      mediaType: 'photo',
      includeBase64: true,
      maxWidth: 1280,
    });

    if (response.didCancel) {
      return;
    }
    if (response.errorMessage) {
      Alert.alert('Upload Error', response.errorMessage);
      return;
    }

    const asset = response.assets?.[0];
    if (!asset?.base64) {
      Alert.alert('Upload Error', 'Unable to read image. Please try again.');
      return;
    }

    const upload = {
      id: `upload_${Date.now()}`,
      uri: asset.uri,
      fileName: asset.fileName || 'design-reference.jpg',
      base64: asset.base64,
    };

    setForm((prev) => ({
      ...prev,
      designUploads: [...prev.designUploads, upload],
    }));
  };

  const handleRemoveUpload = (uploadId) => {
    setForm((prev) => ({
      ...prev,
      designUploads: prev.designUploads.filter((item) => item.id !== uploadId),
    }));
  };

  const toggleSizeMode = (mode) => {
    setForm((prev) => ({
      ...prev,
      sizes: {
        mode,
        values: mode === 'perSet' ? prev.sizes.values : BASE_SIZE_VALUES,
      },
    }));
  };

  return (
    <View style={styles.formContainer}>
      <Text style={[styles.formTitle, { color: theme?.colors?.primaryFont || styles.formTitle.color }]}>
        {isNewSet ? 'Create Your Nail Set' : 'Edit Nail Set'}
      </Text>
      <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent}>
        <Text style={styles.label}>Set Name (optional)</Text>
        <TextInput
          style={styles.input}
        value={currentForm.name}
          placeholder="e.g. Fuchsia French"
          onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
        />

        <Text style={styles.label}>Shape</Text>
        <View style={styles.shapeGrid}>
          {shapes.map((shape) => {
              const selected = shape.id === currentForm.shapeId;
            return (
              <TouchableOpacity
                key={shape.id}
                style={[
                  styles.shapeCard,
                  selected && { borderColor: theme?.colors?.accent || '#272b75' },
                ]}
                onPress={() => handleSelectShape(shape.id)}
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

        <Text style={styles.label}>Quantity</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={currentForm.quantity}
          onChangeText={(text) => setForm((prev) => ({ ...prev, quantity: text }))}
          placeholder="1"
        />
        <Text style={styles.helperText}>One set = 10 nails (left & right hands).</Text>

        <Text style={styles.label}>Design Uploads</Text>
        <PrimaryButton label="Add Inspiration Image" onPress={handleUploadDesign} />
        {currentForm.designUploads.length === 0 ? (
          <Text style={styles.helperText}>
            Upload photos of the design or describe it below. If neither, mark for follow-up.
          </Text>
        ) : (
          <View style={styles.uploadGrid}>
            {currentForm.designUploads.map((upload) => (
              <View key={upload.id} style={styles.uploadItem}>
                <Image source={{ uri: upload.uri || `data:image/jpeg;base64,${upload.base64}` }} style={styles.uploadPreview} />
                <TouchableOpacity onPress={() => handleRemoveUpload(upload.id)}>
                  <Text style={styles.removeLink}>Remove</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.label}>Design Description</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          multiline
          numberOfLines={4}
          value={currentForm.description}
          onChangeText={(text) => setForm((prev) => ({ ...prev, description: text }))}
          placeholder="Describe colors, finishes, decals, etc."
        />

        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={() => setForm((prev) => ({ ...prev, requiresFollowUp: !prev.requiresFollowUp }))}
        >
          <View
          style={[
            styles.checkbox,
            currentForm.requiresFollowUp && { backgroundColor: theme?.colors?.accent || '#272b75' },
          ]}
          />
          <Text style={styles.checkboxLabel}>We&apos;ll finalize design details later</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Sizing</Text>
        <View style={styles.optionRow}>
          {['standard', 'perSet'].map((mode) => {
            const selected = currentForm.sizes.mode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.optionButton,
                  selected && { borderColor: theme?.colors?.accent || '#272b75' },
                ]}
                onPress={() => toggleSizeMode(mode)}
              >
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                  {mode === 'standard' ? 'Standard Sizes' : 'Enter Sizes'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {currentForm.sizes.mode === 'perSet' ? (
          <View style={styles.sizeGrid}>
            {SIZE_KEYS.map((finger) => (
              <View key={finger} style={styles.sizeItem}>
                <Text style={styles.sizeLabel}>{finger.toUpperCase()}</Text>
                <TextInput
                  style={styles.input}
                  value={currentForm.sizes.values[finger]}
                  onChangeText={(text) =>
                    setForm((prev) => ({
                      ...prev,
                      sizes: {
                        ...prev.sizes,
                        values: {
                          ...prev.sizes.values,
                          [finger]: text,
                        },
                      },
                    }))
                  }
                  placeholder="Size"
                />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.label}>Set Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={currentForm.setNotes}
          onChangeText={(text) => setForm((prev) => ({ ...prev, setNotes: text }))}
          placeholder="Finish, decals, special instructions..."
          multiline
          numberOfLines={3}
        />
      </ScrollView>

      <View style={styles.formActions}>
        <TouchableOpacity onPress={onCancel}>
          <Text style={styles.secondaryAction}>Cancel</Text>
        </TouchableOpacity>
        <PrimaryButton
          label="Save Nail Set"
          onPress={() => onSave(currentForm)}
          disabled={!validateNailSet(currentForm)}
        />
      </View>
    </View>
  );
}

function OrderBuilderScreen({
  user,
  onClose,
  onDraftSaved,
  onPaymentComplete,
  initialOrder,
  startInCreateMode = false,
}) {
  const { theme } = useTheme();
  const { confirmPayment } = useStripe();
  const defaultShapes = getShapeCatalog();
  const deliveryMethodConfig = pricingConstants.DELIVERY_METHODS;

  const [orderId, setOrderId] = useState(initialOrder?.id || null);
  const [shapes, setShapes] = useState(defaultShapes);
  const [loadingShapes, setLoadingShapes] = useState(false);
  const [step, setStep] = useState('summary');
  const [editingSet, setEditingSet] = useState(null);
  const [isEditorVisible, setEditorVisible] = useState(false);
  const [clientSecret, setClientSecret] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isProcessingPayment, setProcessingPayment] = useState(false);

  const [nailSets, setNailSets] = useState(
    Array.isArray(initialOrder?.nailSets)
      ? initialOrder.nailSets.map((set) => ({
          ...set,
          quantity: String(set.quantity || 1),
          designUploads: Array.isArray(set.designUploads)
            ? set.designUploads.map((upload) => ({
                id: upload.id || `upload_${Date.now()}`,
                fileName: upload.fileName || 'design-reference.jpg',
                uri: upload.uri || null,
                base64: upload.data || upload.base64 || upload.content || '',
              }))
            : [],
        }))
      : [],
  );
  const previousNailSetCount = useRef(nailSets.length);
  const hasOpenedInitialSet = useRef(false);

  const [fulfillment, setFulfillment] = useState(
    initialOrder?.fulfillment || { method: 'pickup', speed: 'standard', address: null },
  );
  const [orderNotes, setOrderNotes] = useState(initialOrder?.orderNotes || '');
  const [promoCode, setPromoCode] = useState(initialOrder?.promoCode || '');
  const [nailSetsExpanded, setNailSetsExpanded] = useState(nailSets.length === 0);
  const [showDetails, setShowDetails] = useState(nailSets.length > 0);
  const [deliveryExpanded, setDeliveryExpanded] = useState(false);
  const [notesExpanded, setNotesExpanded] = useState(false);
  const [notesDraft, setNotesDraft] = useState(orderNotes);
  const [promoDraft, setPromoDraft] = useState(promoCode);

  useEffect(() => {
    async function loadShapes() {
      try {
        setLoadingShapes(true);
        const catalog = await fetchShapes();
        if (catalog?.length) {
          setShapes(catalog);
        }
      } catch (error) {
        console.warn('Falling back to bundled shape catalog', error);
      } finally {
        setLoadingShapes(false);
      }
    }
    loadShapes();
  }, []);

  useEffect(() => {
    const methodCfg = deliveryMethodConfig[fulfillment.method] || deliveryMethodConfig.pickup;
    if (fulfillment.method !== methodCfg.id || !methodCfg.speedOptions[fulfillment.speed]) {
      setFulfillment((prev) => ({
        ...prev,
        method: methodCfg.id,
        speed: methodCfg.speedOptions[prev.speed] ? prev.speed : methodCfg.defaultSpeed,
      }));
    }
  }, [deliveryMethodConfig, fulfillment.method, fulfillment.speed]);

  const priceDetails = useMemo(
    () =>
      calculatePriceBreakdown({
        nailSets: nailSets.map((set) => ({
          ...set,
          quantity: Number(set.quantity) || 1,
          designUploads: transformUploadsForSave(set.designUploads),
        })),
        fulfillment,
        promoCode,
      }),
    [nailSets, fulfillment, promoCode],
  );

  useEffect(() => {
    if (nailSets.length === 0) {
      setShowDetails(false);
      setNailSetsExpanded(true);
      setDeliveryExpanded(false);
      setNotesExpanded(false);
    } else if (!showDetails) {
      setShowDetails(true);
      setNailSetsExpanded(false);
      setDeliveryExpanded(false);
      setNotesExpanded(false);
    }
    previousNailSetCount.current = nailSets.length;
  }, [nailSets.length, showDetails]);

  useEffect(() => {
    setNotesDraft(orderNotes);
    setPromoDraft(promoCode);
  }, [orderNotes, promoCode]);

  const addSetButtonLabel = nailSets.length === 0 ? 'Create Nail Set' : 'Add Another Nail Set';

  const selectedMethodConfig =
    deliveryMethodConfig[fulfillment.method] || deliveryMethodConfig.pickup;
  const selectedSpeedConfig =
    selectedMethodConfig.speedOptions[fulfillment.speed] ||
    selectedMethodConfig.speedOptions[selectedMethodConfig.defaultSpeed];

  const handleAddSet = useCallback(() => {
    const emptySet = createEmptyNailSet(shapes);
    setEditingSet(emptySet);
    setEditorVisible(true);
  }, [shapes]);

  useEffect(() => {
    if (startInCreateMode && !hasOpenedInitialSet.current && nailSets.length === 0 && !isEditorVisible) {
      hasOpenedInitialSet.current = true;
      handleAddSet();
    }
  }, [startInCreateMode, nailSets.length, isEditorVisible, handleAddSet]);

  const handleEditSet = (setId) => {
    const target = nailSets.find((set) => set.id === setId);
    if (!target) {
      return;
    }
    setEditingSet({
      ...target,
      designUploads: target.designUploads.map((upload) => ({
        id: upload.id || `upload_${Date.now()}`,
        fileName: upload.fileName || 'design-reference.jpg',
        uri: upload.uri || null,
        base64: upload.base64 || upload.data || upload.content || '',
      })),
    });
    setEditorVisible(true);
  };

  const handleDuplicateSet = (setId) => {
    const target = nailSets.find((set) => set.id === setId);
    if (!target) {
      return;
    }
    const clone = {
      ...target,
      id: `duplicate_${Date.now()}`,
      name: target.name ? `${target.name} Copy` : null,
      designUploads: target.designUploads.map((upload) => ({
        ...upload,
        id: `upload_${Date.now()}_${Math.random()}`,
      })),
    };
    setNailSets((prev) => [...prev, clone]);
  };

  const handleRemoveSet = (setId) => {
    setNailSets((prev) => prev.filter((set) => set.id !== setId));
  };

  const handleSaveSet = (formValues) => {
    const normalizedSet = {
      ...formValues,
      quantity: formValues.quantity || '1',
    };

    setNailSets((prev) => {
      const exists = prev.some((set) => set.id === normalizedSet.id);
      if (exists) {
        return prev.map((set) => (set.id === normalizedSet.id ? normalizedSet : set));
      }
      return [...prev, normalizedSet];
    });
    setEditorVisible(false);
    setEditingSet(null);
  };

  const invalidSets = useMemo(
    () => nailSets.filter((set) => !validateNailSet(set)),
    [nailSets],
  );

  const proceedHelperText = useMemo(() => {
    if (loadingShapes) {
      return 'Loading catalog...';
    }
    if (nailSets.length === 0) {
      return 'Add a nail set and confirm delivery to continue.';
    }
    if (invalidSets.length > 0) {
      return 'Complete your nail set details to continue.';
    }
    if (!fulfillment.method || !fulfillment.speed) {
      return 'Confirm delivery to continue.';
    }
    return null;
  }, [fulfillment.method, fulfillment.speed, invalidSets.length, loadingShapes, nailSets.length]);

  const canProceedToPayment = !proceedHelperText;

  const handleOpenNotes = useCallback(() => {
    setNotesDraft(orderNotes);
    setPromoDraft(promoCode);
    setNotesExpanded(true);
  }, [orderNotes, promoCode]);

  const handleCancelNotes = useCallback(() => {
    setNotesDraft(orderNotes);
    setPromoDraft(promoCode);
    setNotesExpanded(false);
  }, [orderNotes, promoCode]);

  const handleSaveNotes = useCallback(() => {
    setOrderNotes(notesDraft || '');
    setPromoCode(promoDraft ? promoDraft.toUpperCase() : '');
    setNotesExpanded(false);
  }, [notesDraft, promoDraft]);

  const buildOrderPayload = useCallback(
    (status) => ({
      id: orderId,
      userId: user.id,
      nailSets: nailSets.map((set) => ({
        ...set,
        quantity: Number(set.quantity) || 1,
        designUploads: transformUploadsForSave(set.designUploads),
      })),
      fulfillment,
      orderNotes,
      promoCode: promoCode || null,
      status,
    }),
    [orderId, user.id, nailSets, fulfillment, orderNotes, promoCode],
  );

  const handleSaveDraft = async () => {
    if (!user?.id) {
      Alert.alert('Unable to save', 'Please log in to save your order.');
      return;
    }
    if (!nailSets.length) {
      Alert.alert('Add a Nail Set', 'Please create at least one nail set before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await createOrUpdateOrder(buildOrderPayload('draft'));
      setOrderId(response.order.id);
      onDraftSaved?.(response.order);
      Alert.alert('Draft saved', 'Your order has been saved as a draft.');
    } catch (error) {
      Alert.alert('Unable to save draft', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!canProceedToPayment) {
      Alert.alert('Almost there!', proceedHelperText || 'Add at least one complete nail set before continuing.');
      return;
    }
    setIsSaving(true);
    try {
      const response = await createOrUpdateOrder(buildOrderPayload('pending_payment'));
      setOrderId(response.order.id);
      const intent = await createPaymentIntent(response.order.id);
      setClientSecret(intent.clientSecret);
      setStep('payment');
    } catch (error) {
      Alert.alert('Unable to proceed', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!clientSecret) {
      Alert.alert('Payment Error', 'Payment is not ready yet. Please try again.');
      return;
    }
    setProcessingPayment(true);
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
      setProcessingPayment(false);
      return;
    }

    try {
      const completion = await completeOrder(orderId, { paymentIntentId: paymentIntent?.id });
      onPaymentComplete?.(completion.order);
    } catch (completionError) {
      Alert.alert('Order completion failed', completionError.message);
    } finally {
      setProcessingPayment(false);
    }
  };

  const deliverySummary = useMemo(() => {
    const methodLabel = selectedMethodConfig.label;
    const methodDescription = selectedMethodConfig.description;
    const speedLabel = selectedSpeedConfig.label;
    const speedDescription = selectedSpeedConfig.description;
    if (!methodLabel || !speedLabel) {
      return 'Choose how and when you would like your order delivered.';
    }
    return `${speedLabel} – ${methodLabel} ${speedDescription ? `(${speedDescription})` : ''} ${methodDescription ? `• ${methodDescription}` : ''}`.trim();
  }, [selectedMethodConfig, selectedSpeedConfig]);

  const notesSummary = useMemo(() => {
    const hasNotes = Boolean(orderNotes && orderNotes.trim().length);
    const hasPromo = Boolean(promoCode && promoCode.trim().length);
    if (!hasNotes && !hasPromo) {
      return 'No notes or promo added yet.';
    }
    if (hasNotes && hasPromo) {
      return `Notes added • Promo: ${promoCode.toUpperCase()}`;
    }
    if (hasNotes) {
      return 'Notes added';
    }
    return `Promo: ${promoCode.toUpperCase()}`;
  }, [orderNotes, promoCode]);

  const priceSummary = useMemo(() => {
    const setCount = nailSets.length;
    if (!setCount) {
      return 'No nail sets yet.';
    }
    return `${setCount} nail set${setCount > 1 ? 's' : ''} • Total ${formatCurrency(priceDetails.total)}`;
  }, [nailSets.length, priceDetails.total]);

  const nailSetsSummary = useMemo(() => {
    if (!nailSets.length) {
      return 'No nail sets added yet.';
    }
    const names = nailSets.map((set, index) => {
      const displayName =
        set.name && set.name.trim().length > 0 ? set.name.trim() : `Set #${index + 1}`;
      return displayName;
    });
    if (nailSets.length === 1) {
      return `1 set added: ${names[0]}`;
    }
    return `${nailSets.length} sets added: ${names.join(', ')}`;
  }, [nailSets]);

  const showDeliveryAttention = showDetails && (!fulfillment.method || !fulfillment.speed);

  return (
    <ScreenContainer>
      <TouchableOpacity onPress={onClose}>
        <Text style={styles.closeLink}>← Back</Text>
      </TouchableOpacity>
      <Text style={[styles.pageTitle, { color: theme?.colors?.primaryFont || styles.pageTitle.color }]}>
        {step === 'summary' ? 'Build Your Order' : 'Complete Payment'}
      </Text>

      {step === 'summary' ? (
        <>
          {nailSets.length === 0 ? (
            <View style={styles.section}>
              <View style={styles.emptyStateBox}>
                <Text style={styles.emptyStateIcon}>💅</Text>
                <Text style={styles.emptyStateText}>
                  No nail sets added yet.{'\n'}Tap “Create Nail Set” to design your nail set!
                </Text>
                <PrimaryButton
                  label={addSetButtonLabel}
                  onPress={handleAddSet}
                  style={[
                    styles.addSetButton,
                    {
                      borderWidth: 2,
                      borderColor: theme?.colors?.accent || styles.summaryAction.color,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}

          {showDetails ? (
            <>
              <View style={styles.summarySection}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryHeaderText}>
                    <Text
                      style={[
                        styles.summaryTitle,
                        { color: theme?.colors?.primaryFont || styles.summaryTitle.color },
                      ]}
                    >
                      Nail Sets
                    </Text>
                    <Text
                      style={[
                        styles.summarySubtitle,
                        { color: theme?.colors?.secondaryFont || styles.summarySubtitle.color },
                      ]}
                    >
                      {nailSetsSummary}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setNailSetsExpanded((prev) => !prev)}>
                    <Text
                      style={[
                        styles.summaryAction,
                        { color: theme?.colors?.accent || styles.summaryAction.color },
                      ]}
                    >
                      {nailSetsExpanded ? 'Done' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {nailSetsExpanded ? (
                  <View style={[styles.editPanel, styles.section]}>
                    <Text style={styles.sectionSubheader}>Your Nail Sets</Text>
                    {nailSets.map((set, index) => {
                      const shape = shapes.find((item) => item.id === set.shapeId);
                      const warning = !validateNailSet(set);
                      const preview = set.designUploads[0];
                      return (
                        <View key={set.id} style={styles.setCard}>
                          <View style={styles.setCardHeader}>
                            <View style={styles.setCardTitleRow}>
                              <View style={styles.setThumbnail}>
                                {preview ? (
                                  <Image
                                    source={{ uri: preview.uri || `data:image/jpeg;base64,${preview.base64}` }}
                                    style={styles.setThumbnailImage}
                                  />
                                ) : (
                                  <Text style={styles.setThumbnailPlaceholder}>
                                    {shape?.name?.charAt(0) || 'S'}
                                  </Text>
                                )}
                              </View>
                              <View style={styles.setTitleContent}>
                                <Text style={styles.setTitle}>{set.name || `Set #${index + 1}`}</Text>
                                <Text style={styles.setSubTitle}>
                                  {shape?.name || 'Shape'} • {set.quantity} set
                                  {Number(set.quantity) > 1 ? 's' : ''}
                                </Text>
                              </View>
                            </View>
                            <View style={styles.setActions}>
                              <TouchableOpacity onPress={() => handleDuplicateSet(set.id)}>
                                <Text style={styles.secondaryAction}>Duplicate</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleEditSet(set.id)}>
                                <Text style={styles.secondaryAction}>Edit</Text>
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => handleRemoveSet(set.id)}>
                                <Text style={[styles.secondaryAction, styles.destructiveAction]}>Remove</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                          {warning ? (
                            <Text style={styles.warningText}>
                              No art uploaded — we&apos;ll contact you to clarify design.
                            </Text>
                          ) : null}
                          {set.setNotes ? <Text style={styles.helperText}>Notes: {set.setNotes}</Text> : null}
                        </View>
                      );
                    })}
                    <PrimaryButton
                      label="Add Another Nail Set"
                      onPress={handleAddSet}
                      style={styles.addSetButton}
                    />
                  </View>
                ) : null}
              </View>

              <View
                style={[
                  styles.summarySection,
                  showDeliveryAttention && {
                    borderColor: theme?.colors?.accent || styles.summarySection.borderColor,
                  },
                ]}
              >
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryHeaderText}>
                    <Text
                      style={[
                        styles.summaryTitle,
                        { color: theme?.colors?.primaryFont || styles.summaryTitle.color },
                      ]}
                    >
                      Delivery Options
                    </Text>
                    <Text
                      style={[
                        styles.summarySubtitle,
                        { color: theme?.colors?.secondaryFont || styles.summarySubtitle.color },
                      ]}
                    >
                      {deliverySummary}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setDeliveryExpanded((prev) => !prev)}>
                    <Text
                      style={[
                        styles.summaryAction,
                        { color: theme?.colors?.accent || styles.summaryAction.color },
                      ]}
                    >
                      {deliveryExpanded ? 'Done' : 'Edit'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {deliveryExpanded ? (
                  <View style={styles.editPanel}>
                    <Text style={styles.stepLabel}>How you&apos;ll get your nails</Text>
                    <View style={styles.methodGrid}>
                      {Object.values(deliveryMethodConfig).map((method) => {
                        const selected = selectedMethodConfig.id === method.id;
                        return (
                          <TouchableOpacity
                            key={method.id}
                            style={[
                              styles.methodCard,
                              selected && {
                                borderColor: theme?.colors?.accent || styles.methodCard.borderColor,
                              },
                            ]}
                            onPress={() =>
                              setFulfillment((prev) => ({
                                ...prev,
                                method: method.id,
                                speed: method.defaultSpeed,
                                address:
                                  method.id === 'shipping' || method.id === 'delivery'
                                    ? prev.address || {}
                                    : null,
                              }))
                            }
                          >
                            <Text style={styles.methodTitle}>{method.label}</Text>
                            <Text style={styles.methodDescription}>{method.description}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {selectedMethodConfig.id === 'shipping' || selectedMethodConfig.id === 'delivery' ? (
                      <View style={styles.subSection}>
                        <Text style={styles.label}>Shipping Address</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="Full Name"
                          value={fulfillment.address?.name || ''}
                          onChangeText={(text) =>
                            setFulfillment((prev) => ({
                              ...prev,
                              address: { ...prev.address, name: text },
                            }))
                          }
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Address Line 1"
                          value={fulfillment.address?.line1 || ''}
                          onChangeText={(text) =>
                            setFulfillment((prev) => ({
                              ...prev,
                              address: { ...prev.address, line1: text },
                            }))
                          }
                        />
                        <TextInput
                          style={styles.input}
                          placeholder="Address Line 2"
                          value={fulfillment.address?.line2 || ''}
                          onChangeText={(text) =>
                            setFulfillment((prev) => ({
                              ...prev,
                              address: { ...prev.address, line2: text },
                            }))
                          }
                        />
                        <View style={styles.addressRow}>
                          <TextInput
                            style={[styles.input, styles.addressHalf]}
                            placeholder="City"
                            value={fulfillment.address?.city || ''}
                            onChangeText={(text) =>
                              setFulfillment((prev) => ({
                                ...prev,
                                address: { ...prev.address, city: text },
                              }))
                            }
                          />
                          <TextInput
                            style={[styles.input, styles.addressQuarter]}
                            placeholder="State"
                            autoCapitalize="characters"
                            value={fulfillment.address?.state || ''}
                            onChangeText={(text) =>
                              setFulfillment((prev) => ({
                                ...prev,
                                address: { ...prev.address, state: text },
                              }))
                            }
                          />
                          <TextInput
                            style={[styles.input, styles.addressQuarter]}
                            placeholder="ZIP"
                            keyboardType="number-pad"
                            value={fulfillment.address?.postalCode || ''}
                            onChangeText={(text) =>
                              setFulfillment((prev) => ({
                                ...prev,
                                address: { ...prev.address, postalCode: text },
                              }))
                            }
                          />
                        </View>
                      </View>
                    ) : null}

                    <Text style={styles.stepLabel}>Delivery Timing</Text>
                    <View style={styles.speedList}>
                      {Object.values(selectedMethodConfig.speedOptions).map((option) => {
                        const selected = selectedSpeedConfig.id === option.id;
                        const costLabel =
                          option.fee > 0 ? `(+${formatCurrency(option.fee)})` : '(Included)';
                        return (
                          <TouchableOpacity
                            key={option.id}
                            style={[
                              styles.speedCard,
                              selected && {
                                borderColor: theme?.colors?.accent || styles.speedCard.borderColor,
                              },
                            ]}
                            onPress={() =>
                              setFulfillment((prev) => ({
                                ...prev,
                                speed: option.id,
                              }))
                            }
                          >
                            <Text style={styles.speedTitle}>
                              {option.label} – {option.description} {costLabel}
                            </Text>
                            {option.tagline ? (
                              <Text style={styles.speedTagline}>{option.tagline}</Text>
                            ) : null}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.summarySection}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryHeaderText}>
                    <Text
                      style={[
                        styles.summaryTitle,
                        { color: theme?.colors?.primaryFont || styles.summaryTitle.color },
                      ]}
                    >
                      Order Notes & Promo
                    </Text>
                    <Text
                      style={[
                        styles.summarySubtitle,
                        { color: theme?.colors?.secondaryFont || styles.summarySubtitle.color },
                      ]}
                    >
                      {notesSummary}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={notesExpanded ? handleCancelNotes : handleOpenNotes}>
                    <Text
                      style={[
                        styles.summaryAction,
                        { color: theme?.colors?.accent || styles.summaryAction.color },
                      ]}
                    >
                      {notesExpanded ? 'Cancel' : orderNotes || promoCode ? 'Edit' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {notesExpanded ? (
                  <View style={styles.editPanel}>
                    <TextInput
                      style={[styles.input, styles.notesInput]}
                      placeholder="Any global notes? e.g. Gift wrap please."
                      value={notesDraft}
                      onChangeText={setNotesDraft}
                      multiline
                      numberOfLines={3}
                    />
                    <TextInput
                      style={styles.input}
                      placeholder="Promo code"
                      autoCapitalize="characters"
                      value={promoDraft}
                      onChangeText={setPromoDraft}
                    />
                    <View style={styles.inlineActions}>
                      <TouchableOpacity onPress={handleCancelNotes}>
                        <Text style={styles.secondaryAction}>Cancel</Text>
                      </TouchableOpacity>
                      <PrimaryButton label="Save" onPress={handleSaveNotes} />
                    </View>
                  </View>
                ) : null}
              </View>

              <View style={styles.summarySection}>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryHeaderText}>
                    <Text
                      style={[
                        styles.summaryTitle,
                        { color: theme?.colors?.primaryFont || styles.summaryTitle.color },
                      ]}
                    >
                      Price Breakdown
                    </Text>
                    <Text
                      style={[
                        styles.summarySubtitle,
                        { color: theme?.colors?.secondaryFont || styles.summarySubtitle.color },
                      ]}
                    >
                      {priceSummary}
                    </Text>
                  </View>
                </View>
                <View style={styles.section}>
                  {priceDetails.lineItems.map((item) => (
                    <View key={item.id} style={styles.breakdownRow}>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                      <Text style={styles.breakdownAmount}>{formatCurrency(item.amount)}</Text>
                    </View>
                  ))}
                  <View style={styles.breakdownTotalRow}>
                    <Text style={styles.breakdownTotalLabel}>Total</Text>
                    <Text style={styles.breakdownTotalAmount}>{formatCurrency(priceDetails.total)}</Text>
                  </View>
                  <Text style={styles.helperText}>
                    Estimated completion: {priceDetails.estimatedCompletionDays} business days after payment.
                  </Text>
                </View>
              </View>
            </>
          ) : null}

          {showDetails ? (
            <>
              <View style={styles.actionRow}>
                <TouchableOpacity onPress={handleSaveDraft} disabled={isSaving}>
                  <Text style={styles.secondaryAction}>Save Draft</Text>
                </TouchableOpacity>
                <PrimaryButton
                  label="Proceed to Payment"
                  onPress={handleProceedToPayment}
                  disabled={!canProceedToPayment || isSaving}
                  loading={isSaving}
                />
              </View>
              {proceedHelperText ? (
                <Text
                  style={[
                    styles.helperText,
                    styles.proceedHelper,
                    { color: theme?.colors?.secondaryFont || styles.helperText.color },
                  ]}
                >
                  {proceedHelperText}
                </Text>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <View style={styles.paymentSection}>
          <Text style={styles.helperText}>
            Total due {formatCurrency(priceDetails.total)}. Enter your payment details to finalize your order.
          </Text>
          <CardField
            postalCodeEnabled
            placeholders={{ number: '4242 4242 4242 4242' }}
            cardStyle={styles.cardField}
            style={styles.cardFieldContainer}
            onCardChange={() => {}}
          />
          <PrimaryButton
            label="Pay & Submit Order"
            onPress={handleConfirmPayment}
            loading={isProcessingPayment}
          />
          <TouchableOpacity onPress={() => setStep('summary')} style={styles.backLink}>
            <Text style={styles.secondaryAction}>← Back to order details</Text>
          </TouchableOpacity>
        </View>
      )}

      <NailSetEditor
        visible={isEditorVisible}
        value={editingSet}
        shapes={shapes}
        theme={theme}
        onCancel={() => {
          setEditorVisible(false);
          setEditingSet(null);
        }}
        onSave={handleSaveSet}
      />
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
    marginTop: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#f1f1f6',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#272b75',
  },
  sectionHeaderIcon: {
    fontSize: 16,
    color: '#272b75',
  },
  helperText: {
    marginTop: 8,
    color: '#555',
  },
  section: {
    marginTop: 12,
    paddingHorizontal: 4,
  },
  stepLabel: {
    marginTop: 16,
    marginBottom: 8,
    fontWeight: '700',
    color: '#272b75',
  },
  sectionSubheader: {
    marginTop: 12,
    marginBottom: 8,
    fontWeight: '600',
    color: '#272b75',
  },
  emptyStateBox: {
    marginTop: 12,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d9ddff',
    borderStyle: 'dashed',
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  emptyStateIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#5c5f8d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  summarySection: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d9ddff',
    backgroundColor: '#fff',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  summaryHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  summaryTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#272b75',
  },
  summarySubtitle: {
    marginTop: 4,
    color: '#5c5f8d',
  },
  summaryAction: {
    fontWeight: '600',
    color: '#272b75',
  },
  editPanel: {
    marginTop: 16,
  },
  subSection: {
    marginTop: 16,
  },
  setCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e1e4ff',
    marginTop: 12,
  },
  setCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  setThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#f1f1f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  setThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  setThumbnailPlaceholder: {
    color: '#272b75',
    fontWeight: '700',
    fontSize: 18,
  },
  setTitleContent: {
    flex: 1,
  },
  setTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#272b75',
  },
  setSubTitle: {
    marginTop: 4,
    color: '#5c5f8d',
  },
  setActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  warningText: {
    color: '#b00020',
    marginTop: 12,
  },
  addSetButton: {
    marginTop: 16,
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
    marginBottom: 8,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
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
  methodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  methodCard: {
    flexGrow: 1,
    minWidth: '45%',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d9ddff',
    padding: 16,
    backgroundColor: '#fff',
  },
  methodTitle: {
    fontWeight: '700',
    color: '#272b75',
    marginBottom: 6,
  },
  methodDescription: {
    color: '#5c5f8d',
  },
  sizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  sizeItem: {
    width: '30%',
  },
  sizeLabel: {
    marginBottom: 4,
    fontWeight: '600',
    color: '#272b75',
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
  },
  addressHalf: {
    flex: 1,
  },
  addressQuarter: {
    width: '30%',
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
    gap: 16,
  },
  inlineActions: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  secondaryAction: {
    color: '#272b75',
    fontWeight: '600',
  },
  destructiveAction: {
    color: '#b00020',
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
  proceedHelper: {
    marginTop: 12,
    textAlign: 'center',
  },
  shapeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
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
  speedList: {
    marginTop: 12,
    gap: 12,
  },
  speedCard: {
    borderWidth: 2,
    borderColor: '#d9ddff',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
  },
  speedTitle: {
    fontWeight: '600',
    color: '#272b75',
  },
  speedTagline: {
    marginTop: 4,
    color: '#5c5f8d',
  },
  formContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  formScroll: {
    backgroundColor: '#fff',
    borderRadius: 16,
    maxHeight: '75%',
  },
  formScrollContent: {
    padding: 20,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#272b75',
    marginBottom: 12,
    textAlign: 'center',
  },
  formActions: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uploadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  uploadItem: {
    width: 90,
  },
  uploadPreview: {
    width: 90,
    height: 90,
    borderRadius: 12,
  },
  removeLink: {
    color: '#b00020',
    marginTop: 6,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#272b75',
  },
  checkboxLabel: {
    color: '#272b75',
  },
});

export default OrderBuilderScreen;

