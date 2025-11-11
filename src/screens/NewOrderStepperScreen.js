import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { calculatePriceBreakdown, pricingConstants, formatCurrency } from '../utils/pricing';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { launchImageLibrary } from 'react-native-image-picker';

const SET_STEPS = ['shape', 'design', 'size'];
const ORDER_FLOW_STEPS = ['summary', 'fulfillment', 'review'];

const STEP_DEFINITIONS = [
  {
    key: 'shape',
    title: 'Choose a shape',
    subtitle: 'Pick the silhouette for this set.',
  },
  {
    key: 'design',
    title: 'Design details',
    subtitle: 'Share inspiration - add images, notes, or request ideas',
  },
  {
    key: 'size',
    title: 'Sizing',
    subtitle: 'Select sizes for each finger or use sizing guide.',
  },
  {
    key: 'summary',
    title: 'Your nail sets',
    subtitle: 'Make sure your sets are perfect — review, edit, or add.',
  },
  {
    key: 'fulfillment',
    title: 'Delivery details',
    subtitle: 'How should we deliver your sets?',
  },
  {
    key: 'review',
    title: 'Review & submit',
    subtitle: 'Double-check everything looks right.',
  },
];

const STEP_TOOLTIPS = {
  shape: 'Pick a shape (Almond, Square, Oval…)',
  design: 'Share inspiration - add images, notes, or request ideas',
  size: 'Select sizes for each finger or use sizing guide',
  summary: 'Review your nail sets and decide if you want to add another',
  fulfillment: 'Continue to delivery & shipping',
  review: 'Review all sets and submit order',
};

const DEFAULT_SIZES = {
  thumb: '',
  index: '',
  middle: '',
  ring: '',
  pinky: '',
};
const FINGER_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky'];

function createEmptySetDraft() {
  return {
    id: null,
    shapeId: null,
    designDescription: '',
    designUploads: [],
    requiresFollowUp: false,
    quantity: 1,
    sizeMode: 'standard',
    sizes: { ...DEFAULT_SIZES },
  };
}

function createDefaultDeliveryDetails() {
  return {
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
    notes: '',
  };
}

function resolveUploadPreview(upload) {
  if (!upload) {
    return null;
  }

  const possible =
    upload.uri ||
    upload.url ||
    upload.preview ||
    upload.data ||
    upload.content ||
    upload.base64 ||
    upload.thumbnail ||
    upload.source ||
    null;

  if (!possible || typeof possible !== 'string') {
    return null;
  }

  if (upload.uri || upload.url || upload.preview || /^data:/.test(possible)) {
    return possible;
  }

  if (possible.startsWith('http')) {
    return possible;
  }

  return `data:image/jpeg;base64,${possible}`;
}

function normalizeDraftSizes(sizes) {
  const base = { ...DEFAULT_SIZES };
  if (!sizes) {
    return base;
  }

  if (sizes.mode === 'perSet') {
    if (sizes.values && !Array.isArray(sizes.values)) {
      return { ...base, ...sizes.values };
    }

    if (Array.isArray(sizes.values)) {
      return sizes.values.reduce((acc, value, index) => {
        const key = FINGER_KEYS[index];
        if (key) {
          acc[key] = value || '';
        }
        return acc;
      }, { ...base });
    }

    if (Array.isArray(sizes.details)) {
      const next = { ...base };
      sizes.details.forEach((detail) => {
        if (detail?.finger) {
          next[detail.finger] = detail.value || '';
        }
      });
      return next;
    }
  }

  if (sizes.values && typeof sizes.values === 'object') {
    return { ...base, ...sizes.values };
  }

  return base;
}

function NewOrderStepperScreen({ route }) {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, handleDraftSaved, handleOrderComplete } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const colors = theme?.colors || {};
  const {
    primaryBackground,
    secondaryBackground,
    surface,
    surfaceMuted,
    primaryFont,
    secondaryFont,
    accent,
    accentContrast,
    border,
    divider,
    success,
    error: errorColor,
    warning: warningColor,
    shadow,
  } = colors;
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
  const hydratedDraftRef = useRef(null);
  const isFinalStep = currentStep === STEP_DEFINITIONS.length - 1;

  const [currentSetDraft, setCurrentSetDraft] = useState(createEmptySetDraft());
  const [orderDraft, setOrderDraft] = useState({
    sets: [],
    deliveryDetails: createDefaultDeliveryDetails(),
    promoCode: '',
  });
  const [editingSetId, setEditingSetId] = useState(null);
  const [stepErrors, setStepErrors] = useState({
    shape: false,
    design: false,
    size: false,
    summary: false,
    fulfillment: false,
  });
  const [previewSet, setPreviewSet] = useState(null);
  const [isPromoInputVisible, setPromoInputVisible] = useState(false);
  const [promoInputValue, setPromoInputValue] = useState('');

  useEffect(() => {
    logEvent('start_order_step', { step: STEP_DEFINITIONS[currentStep].key });
  }, [currentStep]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2500);
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [toastMessage]);

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
    () => shapes.find((shape) => shape.id === currentSetDraft.shapeId),
    [currentSetDraft.shapeId, shapes],
  );

  useEffect(() => {
    setPromoInputValue(orderDraft.promoCode || '');
  }, [orderDraft.promoCode]);

  const resumeFlag = Boolean(route?.params?.resume);
  const resumeDraft =
    resumeFlag && state.activeOrder?.status === 'draft' ? state.activeOrder : null;
  const stepperTitle = resumeDraft ? 'Edit Draft Order' : 'Design & Order Your Nails';

  useEffect(() => {
    if (!resumeDraft) {
      return;
    }

    if (hydratedDraftRef.current === resumeDraft.id) {
      return;
    }

    const draftSets = Array.isArray(resumeDraft.nailSets) ? resumeDraft.nailSets : [];
    const method = resumeDraft.fulfillment?.method || 'pickup';
    const methodConfigCandidate = pricingConstants.DELIVERY_METHODS[method];
    const fallbackMethodConfig = pricingConstants.DELIVERY_METHODS.pickup;
    const methodConfigForDraft = methodConfigCandidate || fallbackMethodConfig;
    const speed =
      resumeDraft.fulfillment?.speed || methodConfigForDraft?.defaultSpeed || 'standard';

    const normalizedAddress = {
      name: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      ...(resumeDraft.fulfillment?.address || {}),
    };

    setDraftOrderId(resumeDraft.id || mappedSets[0]?.id || null);
    const mappedSets = draftSets.map((set, index) => ({
      id: set.id || `set_${index}`,
      name: set.name || null,
      shapeId: set.shapeId || null,
      designDescription: set.description || '',
      designUploads: Array.isArray(set.designUploads)
        ? set.designUploads.map((upload, uploadIndex) => ({
            ...upload,
            id: upload?.id || `upload_${index}_${uploadIndex}`,
            preview: resolveUploadPreview(upload),
          }))
        : [],
      requiresFollowUp: Boolean(set.requiresFollowUp),
      quantity: Number(set.quantity) || 1,
      sizeMode: set.sizes?.mode === 'perSet' ? 'perSet' : 'standard',
      sizes:
        set.sizes?.mode === 'perSet'
          ? normalizeDraftSizes(set.sizes)
          : { ...DEFAULT_SIZES },
      price: set.price || null,
    }));

    setOrderDraft({
      sets: mappedSets,
      deliveryDetails: {
        method,
        speed,
        address: normalizedAddress,
        notes: resumeDraft.fulfillment?.notes || '',
      },
      promoCode: resumeDraft.promoCode || '',
    });

    const initialSet = mappedSets.length ? mappedSets[0] : createEmptySetDraft();
    setCurrentSetDraft({
      ...initialSet,
      designUploads: (initialSet.designUploads || []).map((upload) => ({
        ...upload,
      })),
    });
    setEditingSetId(mappedSets.length ? mappedSets[0].id : null);
    setCurrentStep(0);
    hydratedDraftRef.current = resumeDraft.id || true;
    if (navigation.setParams) {
      navigation.setParams({ ...(route?.params || {}), resume: false });
    }
  }, [navigation, resumeDraft, resumeFlag, route?.params]);

  const priceDetails = useMemo(
    () =>
      calculatePriceBreakdown({
        nailSets: orderDraft.sets.map((set) => ({
          ...set,
          designUploads: (set.designUploads || []).map((upload, index) => ({
            id: upload.id || `upload_${index}`,
            fileName: upload.fileName || null,
            base64: upload.base64 || null,
          })),
        })),
        fulfillment: {
          method: orderDraft.deliveryDetails.method,
          speed: orderDraft.deliveryDetails.speed,
        },
        promoCode: orderDraft.promoCode,
      }),
    [orderDraft],
  );

  const currentStepKey = STEP_DEFINITIONS[currentStep].key;
  const isSetStep = SET_STEPS.includes(currentStepKey);
  const flowSteps = isSetStep ? SET_STEPS : ORDER_FLOW_STEPS;
  const currentFlowStepIndex = flowSteps.indexOf(currentStepKey) + 1;
  const totalSavedSets = orderDraft.sets.length;
  const editingIndex = editingSetId
    ? orderDraft.sets.findIndex((set) => set.id === editingSetId)
    : -1;
  const activeSetPosition = isSetStep
    ? editingIndex >= 0
      ? editingIndex + 1
      : totalSavedSets + 1
    : Math.max(totalSavedSets, 1);
  const totalSetsCount = isSetStep
    ? Math.max(totalSavedSets + (editingSetId ? 0 : 1), 1)
    : Math.max(totalSavedSets, 1);
  const orderStepCount = ORDER_FLOW_STEPS.length;
  const setStepCount = flowSteps.length;
  const setProgressLabel = `Step ${currentFlowStepIndex} of ${setStepCount}`;
  const orderProgressLabel = `Step ${currentFlowStepIndex} of ${orderStepCount}`;
  const progressLabel = isSetStep ? setProgressLabel : orderProgressLabel;
  const setStatusLabel = editingSetId ? `Editing set ${activeSetPosition}` : `New set`;
  const progressBadgeLabel = isSetStep ? setStatusLabel : 'Order progress';
  const showNextButton = ['shape', 'design', 'summary', 'fulfillment'].includes(currentStepKey);
  const nextButtonWrapperStyle =
    currentStepKey === 'summary'
      ? styles.footerButtonWrapperSummary
      : currentStepKey === 'fulfillment'
      ? styles.footerButtonWrapperLargeTight
      : styles.footerButtonWrapperLarge;

  const handleNext = () => {
    setError(null);
    const currentStepKey = STEP_DEFINITIONS[currentStep].key;
    if (SET_STEPS.includes(currentStepKey)) {
      setStepErrors((prev) => ({ ...prev, [currentStepKey]: false }));
    }

    if (currentStepKey === 'shape' && !currentSetDraft.shapeId) {
      setError('Select a shape to continue.');
      setStepErrors((prev) => ({ ...prev, shape: true }));
      return;
    }

    if (currentStepKey === 'design') {
      const hasDescription = Boolean(
        currentSetDraft.designDescription && currentSetDraft.designDescription.trim(),
      );
      const hasUploads =
        Array.isArray(currentSetDraft.designUploads) && currentSetDraft.designUploads.length > 0;
      if (!hasDescription && !hasUploads && !currentSetDraft.requiresFollowUp) {
        setError('Add inspiration, describe your design, or mark for follow-up.');
        setStepErrors((prev) => ({ ...prev, design: true }));
        return;
      }
    }

    if (currentStepKey === 'fulfillment') {
      const delivery = orderDraft.deliveryDetails;
      if (
        (delivery.method === 'delivery' || delivery.method === 'shipping') &&
        (!delivery.address.name || !delivery.address.line1 || !delivery.address.city)
      ) {
        setError('Please provide a full delivery address.');
        setStepErrors((prev) => ({ ...prev, fulfillment: true }));
        return;
      }
      setStepErrors((prev) => ({ ...prev, fulfillment: false }));
    }

    if (currentStepKey === 'summary' && orderDraft.sets.length === 0) {
      setError('Save at least one set before continuing to delivery.');
      setStepErrors((prev) => ({ ...prev, summary: true }));
      return;
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

  const buildOrderPayload = (status = 'draft') => {
    const mappedSets = orderDraft.sets.map((set, index) => ({
      id: set.id || `set_${index}`,
      name: set.name || selectedShape?.name || 'Custom Set',
      shapeId: set.shapeId,
      quantity: Number(set.quantity) || 1,
      description: set.designDescription,
      setNotes: set.notes || '',
      designUploads: (set.designUploads || []).map((upload, uploadIndex) => ({
        id: upload.id || `upload_${index}_${uploadIndex}`,
        fileName: upload.fileName || null,
        base64: upload.base64 || null,
      })),
      requiresFollowUp: set.requiresFollowUp,
      sizes:
        set.sizeMode === 'perSet'
          ? { mode: 'perSet', values: set.sizes }
          : { mode: 'standard', values: {} },
      price: set.price || null,
    }));

    const fulfillment = orderDraft.deliveryDetails;

    return {
      id: draftOrderId,
      userId: state.currentUser?.id,
      nailSets: mappedSets,
      fulfillment: {
        method: fulfillment.method,
        speed: fulfillment.speed,
        address: {
          ...fulfillment.address,
        },
        notes: fulfillment.notes || null,
      },
      orderNotes: null,
      promoCode: orderDraft.promoCode ? orderDraft.promoCode.trim() : null,
      status,
    };
  };

  const persistDraftOrder = async () => {
    const payload = buildOrderPayload('draft');
    // eslint-disable-next-line no-console
    console.log('[OrderDraft] Persist payload', payload);
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
      Alert.alert('Draft saved', 'You can continue editing this set anytime.', [
        {
          text: 'OK',
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [
                {
                  name: 'MainTabs',
                  state: {
                    index: 2,
                    routes: [
                      { name: 'Home' },
                      { name: 'Gallery' },
                      {
                        name: 'Orders',
                        params: { initialTab: 'drafts' },
                      },
                      { name: 'Profile' },
                    ],
                  },
                },
              ],
            });
          },
        },
      ]);
    } catch (err) {
      const message = err?.details?.error || err.message || 'Please try again.';
      Alert.alert('Unable to save draft', message);
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
      if (!orderDraft.sets.length) {
        Alert.alert('Add a nail set', 'Save at least one nail set before submitting your order.');
        setCurrentStep(0);
        return;
      }
      const payload = buildOrderPayload('submitted');
      const response = await createOrUpdateOrder(payload);
      setDraftOrderId(response.order.id);
      handleOrderComplete(response.order, 'default');
      logEvent('complete_order', { order_id: response.order.id, variant: 'default' });
      navigation.replace('OrderConfirmation', { order: response.order });
    } catch (err) {
      const message = err?.details?.error || err.message || 'Please try again.';
      Alert.alert('Unable to submit order', message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddDesignUpload = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: true,
        quality: 0.85,
        maxWidth: 1500,
        selectionLimit: 0,
      });

      if (response.didCancel) {
        return;
      }

      if (response.errorCode || response.errorMessage) {
        Alert.alert('Upload error', response.errorMessage || 'Unable to select image.');
        return;
      }

      const assets = Array.isArray(response.assets) ? response.assets : [];
      if (!assets.length) {
        return;
      }

      const uploadsToAdd = assets
        .map((asset, index) => {
          const hasPreview = asset.base64 || asset.uri || asset.url;
          if (!hasPreview) {
            return null;
          }

          return {
            id: `upload_${Date.now()}_${index}`,
            uri: asset.uri || asset.url || null,
            fileName: asset.fileName || `design-reference-${index + 1}.jpg`,
            base64: asset.base64 || null,
            preview: asset.base64
              ? `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`
              : asset.uri || asset.url || null,
          };
        })
        .filter(Boolean);

      if (!uploadsToAdd.length) {
        Alert.alert('Upload error', 'Unable to read the selected images. Please try again.');
        return;
      }

      setCurrentSetDraft((prev) => ({
        ...prev,
        designUploads: [...(prev.designUploads || []), ...uploadsToAdd],
      }));
    } catch (err) {
      Alert.alert('Upload error', err.message || 'Something went wrong. Please try again.');
    }
  };

  const handleRemoveDesignUpload = (uploadId) => {
    setCurrentSetDraft((prev) => ({
      ...prev,
      designUploads: (prev.designUploads || []).filter((item) => item.id !== uploadId),
    }));
  };

  const handlePreviewSet = useCallback(
    (setId) => {
      const target = orderDraft.sets.find((set) => set.id === setId);
      if (!target) {
        return;
      }
      setPreviewSet(target);
    },
    [orderDraft.sets],
  );

  const closePreview = useCallback(() => {
    setPreviewSet(null);
  }, []);

  const handleTogglePromoInput = useCallback(() => {
    setPromoInputVisible((prev) => !prev);
  }, []);

  const handleChangePromoInput = useCallback((value) => {
    setPromoInputValue(value);
  }, []);

  const handleApplyPromoCode = useCallback(() => {
    const trimmed = promoInputValue.trim();
    setOrderDraft((prev) => ({
      ...prev,
      promoCode: trimmed,
    }));
    setPromoInputVisible(false);
  }, [promoInputValue]);

  const handleClearPromoCode = useCallback(() => {
    setOrderDraft((prev) => ({
      ...prev,
      promoCode: '',
    }));
    setPromoInputVisible(false);
    setPromoInputValue('');
  }, []);

  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  const computeSetPricing = useCallback(
    (setDraft) => {
      const pricing = calculatePriceBreakdown({
        nailSets: [
          {
            ...setDraft,
            designUploads: (setDraft.designUploads || []).map((upload, index) => ({
              id: upload.id || `preview_${index}`,
              fileName: upload.fileName || null,
              base64: upload.base64 || null,
            })),
          },
        ],
        fulfillment: {
          method: orderDraft.deliveryDetails.method,
          speed: orderDraft.deliveryDetails.speed,
        },
        promoCode: null,
      });

      const summaryLine = pricing.summary?.[0];
      return {
        total: summaryLine?.subtotal || 0,
        unitPrice: summaryLine?.unitPrice || 0,
        shapeName: summaryLine?.shapeName || selectedShape?.name || 'Custom Set',
      };
    },
    [orderDraft.deliveryDetails, selectedShape],
  );

  const validateCurrentSet = useCallback(() => {
    if (!currentSetDraft.shapeId) {
      setError('Select a shape to continue.');
      return false;
    }

    const hasDescription = Boolean(
      currentSetDraft.designDescription && currentSetDraft.designDescription.trim(),
    );
    const hasUploads =
      Array.isArray(currentSetDraft.designUploads) && currentSetDraft.designUploads.length > 0;
    if (!hasDescription && !hasUploads && !currentSetDraft.requiresFollowUp) {
      setError('Add inspiration, describe your design, or mark for follow-up.');
      return false;
    }

    setError(null);
    return true;
  }, [currentSetDraft]);

  const handleSaveCurrentSet = useCallback(() => {
    if (!validateCurrentSet()) {
      setStepErrors((prev) => ({ ...prev, size: true }));
      return;
    }
    setStepErrors((prev) => ({ ...prev, size: false }));
    const pricing = computeSetPricing(currentSetDraft);
    const setId = editingSetId || currentSetDraft.id || `set_${Date.now()}`;
    const preparedUploads = (currentSetDraft.designUploads || []).map((upload, index) => ({
      ...upload,
      id: upload.id || `upload_${setId}_${index}`,
    }));

    const setToSave = {
      ...currentSetDraft,
      id: setId,
      designUploads: preparedUploads,
      shapeName: pricing.shapeName,
      price: pricing.total,
      unitPrice: pricing.unitPrice,
    };

    let nextCount = 0;
    setOrderDraft((prev) => {
      const existingIndex = prev.sets.findIndex((set) => set.id === setId);
      const nextSets =
        existingIndex >= 0
          ? prev.sets.map((set, index) => (index === existingIndex ? setToSave : set))
          : [...prev.sets, setToSave];
      nextCount = nextSets.length;
      return {
        ...prev,
        sets: nextSets,
      };
    });
    setEditingSetId(null);
    setCurrentSetDraft(createEmptySetDraft());
    showToast(`Saved set ${nextCount} — add another or continue to delivery.`);
    setStepErrors((prev) => ({ ...prev, summary: false }));
    setCurrentStep(3);
  }, [computeSetPricing, currentSetDraft, editingSetId, showToast, validateCurrentSet]);

  const handleEditSet = useCallback(
    (setId) => {
      const target = orderDraft.sets.find((set) => set.id === setId);
      if (!target) {
        return;
      }
      setEditingSetId(setId);
      setCurrentSetDraft({
        ...target,
        designUploads: (target.designUploads || []).map((upload) => ({ ...upload })),
      });
      setCurrentStep(0);
    },
    [orderDraft.sets],
  );

  const handleRemoveSet = useCallback(
    (setId) => {
      Alert.alert('Remove set', 'Remove this nail set from your order?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setOrderDraft((prev) => ({
              ...prev,
              sets: prev.sets.filter((set) => set.id !== setId),
            }));
            if (editingSetId === setId) {
              setEditingSetId(null);
              setCurrentSetDraft(createEmptySetDraft());
            }
          },
        },
      ]);
    },
    [editingSetId],
  );

  const showToast = useCallback((message) => {
    setToastMessage(message);
  }, []);

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: primaryBackground },
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
        <Text
          style={[
            styles.stepperTitle,
            {
              color: primaryFont,
              paddingHorizontal: horizontalSpacing,
              marginTop: Math.max(insets.top - 34, 8),
            },
          ]}
        >
          {stepperTitle}
        </Text>
        <View
          style={[
            styles.progressContainer,
            { paddingHorizontal: horizontalSpacing },
          ]}
        >
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: accent,
                  width: `${((currentStep + 1) / STEP_DEFINITIONS.length) * 100}%`,
                },
              ]}
            />
          </View>
          <View style={styles.progressRow}>
            <Text
              style={[
                styles.setStatusPill,
                {
                  backgroundColor: withOpacity(accent || '#6F171F', 0.12),
                  color: accent || '#6F171F',
                  borderColor: withOpacity(accent || '#6F171F', 0.3),
                },
              ]}
            >
              {progressBadgeLabel}
            </Text>
            <Text
              style={[
                styles.progressLabel,
                { color: secondaryFont },
              ]}
            >
              {progressLabel}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.contentContainer,
            {
              flexDirection: 'column',
              gap: isCompact ? 16 : 24,
              paddingHorizontal: horizontalSpacing,
            },
          ]}
        >
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
                { color: primaryFont },
              ]}
            >
              {STEP_DEFINITIONS[currentStep].title}
            </Text>
            <Text
              style={[
                styles.stepSubtitle,
                { color: secondaryFont },
              ]}
            >
              {STEP_DEFINITIONS[currentStep].subtitle}
            </Text>

            {error ? (
              <Text
                style={[
                  styles.errorText,
                  { color: accent },
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
              selectedShapeId={currentSetDraft.shapeId}
              onSelect={(shapeId) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  shapeId,
                }))
              }
            />
            ) : null}

            {stepErrors.shape ? (
              <Text style={[styles.validationText, { color: accent }]}>
                Pick a shape to continue.
              </Text>
            ) : null}

            {currentStep === 1 ? (
              <DesignStep
                colors={colors}
              description={currentSetDraft.designDescription}
              designUploads={currentSetDraft.designUploads}
              requiresFollowUp={currentSetDraft.requiresFollowUp}
                onAddUpload={handleAddDesignUpload}
                onChangeDescription={(designDescription) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  designDescription,
                }))
                }
                onRemoveUpload={handleRemoveDesignUpload}
                onToggleFollowUp={(requiresFollowUp) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  requiresFollowUp,
                }))
                }
              />
            ) : null}

            {stepErrors.design ? (
              <Text style={[styles.validationText, { color: accent }]}>
                Add inspiration, describe your design, or mark for follow-up.
              </Text>
            ) : null}

            {currentStep === 2 ? (
              <SizingStep
                colors={colors}
              sizeMode={currentSetDraft.sizeMode}
              sizes={currentSetDraft.sizes}
                onSelectSizeMode={(sizeMode) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  sizeMode,
                }))
                }
                onChangeSizes={(sizes) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  sizes: { ...prev.sizes, ...sizes },
                }))
                }
              />
            ) : null}

          {currentStep === 3 ? (
            <OrderSummaryStep
              colors={colors}
              orderDraft={orderDraft}
              currentSetDraft={currentSetDraft}
              onAddAnother={() => {
                setEditingSetId(null);
                setCurrentSetDraft(createEmptySetDraft());
                setCurrentStep(0);
              }}
              onEditSet={(setId) => handleEditSet(setId)}
              onRemoveSet={(setId) => handleRemoveSet(setId)}
              onPreviewSet={(setId) => handlePreviewSet(setId)}
            />
          ) : null}

            {stepErrors.summary ? (
              <Text style={[styles.validationText, { color: accent }]}>
                Save at least one set to continue.
              </Text>
            ) : null}

          {currentStep === 4 ? (
            <FulfillmentStep
              colors={colors}
              fulfillment={orderDraft.deliveryDetails}
              onChangeMethod={(method) =>
                setOrderDraft((prev) => ({
                  ...prev,
                  deliveryDetails: {
                    ...prev.deliveryDetails,
                    method,
                    speed:
                      pricingConstants.DELIVERY_METHODS[method]?.defaultSpeed || 'standard',
                  },
                }))
              }
              onChangeSpeed={(speed) =>
                setOrderDraft((prev) => ({
                  ...prev,
                  deliveryDetails: {
                    ...prev.deliveryDetails,
                    speed,
                  },
                }))
              }
              onChangeAddress={(address) =>
                setOrderDraft((prev) => ({
                  ...prev,
                  deliveryDetails: {
                    ...prev.deliveryDetails,
                    address: {
                      ...prev.deliveryDetails.address,
                      ...address,
                    },
                  },
                }))
              }
            />
          ) : null}

            {stepErrors.fulfillment ? (
              <Text style={[styles.validationText, { color: accent }]}>
                Please provide a full delivery address.
              </Text>
            ) : null}

          {currentStep === 5 && priceDetails ? (
            <ReviewStep
              colors={colors}
            priceDetails={priceDetails}
            openingLegacy={openingLegacyBuilder}
              sets={orderDraft.sets}
            onEditSet={handleEditSet}
            onRemoveSet={handleRemoveSet}
            onAddAnotherSet={() => {
              setEditingSetId(null);
              setCurrentSetDraft(createEmptySetDraft());
              setCurrentStep(0);
            }}
            onPreviewSet={handlePreviewSet}
            deliveryDetails={orderDraft.deliveryDetails}
            onEditDelivery={() => {
              const fulfillmentIndex = STEP_DEFINITIONS.findIndex((step) => step.key === 'fulfillment');
              if (fulfillmentIndex > -1) {
                setCurrentStep(fulfillmentIndex);
              }
            }}
            promoCode={orderDraft.promoCode}
            isPromoInputVisible={isPromoInputVisible}
            promoInputValue={promoInputValue}
            onTogglePromoInput={handleTogglePromoInput}
            onChangePromoInput={handleChangePromoInput}
            onApplyPromoCode={handleApplyPromoCode}
            onClearPromoCode={handleClearPromoCode}
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
          <View style={styles.footerButtonWrapperSmall}>
            {currentStepKey === 'summary' ? (
              <TouchableOpacity
                style={[
                  styles.footerButton,
                  {
                    borderColor: border,
                    backgroundColor: surface,
                  },
                ]}
                onPress={handleSaveDraft}
                disabled={savingDraft}
                accessibilityRole="button"
                accessibilityLabel="Save draft"
                accessibilityHint="Save this order as draft"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {savingDraft ? (
                  <ActivityIndicator color={accent} />
                ) : (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.footerButtonText,
                      { color: accent },
                    ]}
                  >
                    Save Draft
                  </Text>
                )}
              </TouchableOpacity>
            ) : currentStepKey !== 'summary' ? (
              <TouchableOpacity
                style={[
                  styles.footerButton,
                  {
                    borderColor: border,
                    backgroundColor: surface,
                  },
                ]}
                onPress={handleBack}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={[
                    styles.footerButtonText,
                    { color: secondaryFont },
                  ]}
                >
                  Back
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.footerButtonSpacer} />
            )}
          </View>

          {['fulfillment', 'review'].includes(currentStepKey) ? (
            <View style={styles.footerButtonWrapperMedium}>
              <TouchableOpacity
                style={[
                  styles.footerButton,
                  {
                    borderColor: border,
                    backgroundColor: surface,
                  },
                ]}
                onPress={handleSaveDraft}
                disabled={savingDraft}
                accessibilityRole="button"
                accessibilityLabel="Save draft"
                accessibilityHint="Save this order as draft"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {savingDraft ? (
                  <ActivityIndicator color={accent} />
                ) : (
                  <Text
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    style={[
                      styles.footerButtonText,
                      { color: accent },
                    ]}
                  >
                    Save Draft
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          {currentStepKey === 'review' ? (
            <View style={styles.footerButtonWrapperLarge}>
              <PrimaryButton
                label={submitting ? 'Submitting…' : 'Order Now'}
                onPress={handleSubmit}
                loading={submitting}
                style={styles.footerPrimaryButton}
                accessibilityLabel="Submit your nail set order"
              />
            </View>
          ) : null}

          {currentStepKey === 'size' ? (
            <View style={styles.footerButtonWrapperLarge}>
              <PrimaryButton
                label="Save this nail set"
                onPress={handleSaveCurrentSet}
                style={styles.footerPrimaryButton}
                accessibilityLabel="Save this nail set"
              />
            </View>
          ) : null}

          {showNextButton ? (
            <View style={nextButtonWrapperStyle}>
              <PrimaryButton
                label={
          currentStepKey === 'summary' ? 'Continue to delivery' : 'Next'
        }
                onPress={handleNext}
                style={styles.footerPrimaryButton}
                accessibilityLabel={
                  currentStepKey === 'summary'
                    ? 'Continue to delivery'
                    : 'Go to next step'
                }
                accessibilityHint={STEP_TOOLTIPS[currentStepKey]}
              />
            </View>
          ) : null}
        </View>
        {previewSet ? (
          <Modal transparent animationType="slide" visible onRequestClose={closePreview}>
            <View style={styles.previewModalContainer}>
              <View
                style={[
                  styles.previewModalCard,
                  {
                    backgroundColor: surface || '#FFFFFF',
                    borderColor: withOpacity(border || '#D9C8A9', 0.6),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.previewModalTitle,
                    { color: primaryFont },
                  ]}
                >
                  {previewSet.name || previewSet.shapeName || 'Nail set preview'}
                </Text>
                <Text
                  style={[
                    styles.previewModalSubtitle,
                    { color: secondaryFont },
                  ]}
                >
                  Shape: {previewSet.shapeName || 'Custom'}
                </Text>
                <ScrollView style={styles.previewModalBody} contentContainerStyle={styles.previewModalBodyContent}>
                  {(previewSet.designUploads || []).map((upload, index) => {
                    const source = resolveUploadPreview(upload);
                    return source ? (
                      <Image
                        key={upload.id || `preview_${index}`}
                        source={{ uri: source }}
                        style={styles.previewModalImage}
                      />
                    ) : null;
                  })}
                  {previewSet.designDescription ? (
                    <View style={styles.previewModalSection}>
                      <Text
                        style={[
                          styles.previewModalSectionTitle,
                          { color: primaryFont },
                        ]}
                      >
                        Description
                      </Text>
                      <Text
                        style={[
                          styles.previewModalSectionCopy,
                          { color: secondaryFont },
                        ]}
                      >
                        {previewSet.designDescription}
                      </Text>
                    </View>
                  ) : null}
                </ScrollView>
                <PrimaryButton label="Close preview" onPress={closePreview} />
              </View>
            </View>
          </Modal>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function ShapeStep({ colors, shapes, selectedShapeId, onSelect, loading }) {
  const {
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
  } = colors || {};

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={accent} />
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
                  ? accent
                  : border,
                backgroundColor: isSelected ? withOpacity(accent, 0.06) : surface,
              },
            ]}
            onPress={() => onSelect(shape.id)}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.shapeName,
                { color: primaryFont },
              ]}
            >
              {shape.name}
            </Text>
            <Text
              style={[
                styles.shapeDescription,
                { color: secondaryFont },
              ]}
            >
              Base ${Number(shape.basePrice || 0).toFixed(2)}
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
  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    surfaceMuted = '#F4EBE3',
    secondaryBackground = '#BF9B7A',
    shadow = '#000000',
  } = colors || {};

  const uploads = Array.isArray(designUploads) ? designUploads : [];
  const uploadCount = uploads.length;

  return (
    <View style={styles.designContainer}>
      <View
        style={[
          styles.designUploadCard,
          {
            borderColor: border,
            backgroundColor: surface,
          },
        ]}
      >
        <View style={styles.designUploadHeader}>
          <View style={styles.designUploadHeaderCopy}>
            <Text
              style={[
                styles.sectionLabel,
                { color: primaryFont },
              ]}
            >
              Design uploads
            </Text>
            <Text
              style={[
                styles.designUploadHint,
                { color: secondaryFont },
              ]}
            >
              Add images if you have any inspiration to share.
            </Text>
          </View>
          <TouchableOpacity
            onPress={onAddUpload}
            accessibilityRole="button"
            style={[
              styles.designUploadAction,
              {
                borderColor: withOpacity(accent, 0.35),
                backgroundColor: withOpacity(accent, 0.08),
              },
            ]}
          >
            <Icon name="plus" color={accent} size={16} />
            <Text
              style={[
                styles.designUploadActionLabel,
                { color: accent },
              ]}
            >
              Add image
            </Text>
          </TouchableOpacity>
        </View>
        {uploadCount > 0 ? (
          <View style={styles.designUploadGrid}>
            {uploads.map((upload) => {
              const previewUri = resolveUploadPreview(upload);
              const imageSource = previewUri ? { uri: previewUri } : null;
              return (
                <View
                  key={upload.id}
                  style={[
                    styles.designUploadItem,
                    {
                      borderColor: withOpacity(border, 0.6),
                      backgroundColor: surfaceMuted,
                      shadowColor: shadow,
                    },
                  ]}
                >
                  <View style={styles.designUploadThumbnailFrame}>
                    {imageSource ? (
                      <Image source={imageSource} style={styles.designUploadImage} />
                    ) : (
                      <View
                        style={[
                          styles.designUploadEmpty,
                          { backgroundColor: withOpacity(secondaryBackground, 0.35) },
                        ]}
                      >
                        <Icon name="image" color={withOpacity(primaryFont, 0.4)} size={18} />
                        <Text
                          style={[
                            styles.designUploadEmptyText,
                            { color: primaryFont },
                          ]}
                        >
                          No preview
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.designUploadMeta}>
                    <Text
                      style={[
                        styles.designUploadName,
                        { color: primaryFont },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {upload.fileName || 'Inspiration image'}
                    </Text>
                    <TouchableOpacity onPress={() => onRemoveUpload(upload.id)}>
                      <Text
                        style={[
                          styles.designUploadRemove,
                          { color: accent },
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View
            style={[
              styles.designUploadPlaceholder,
              {
                borderColor: withOpacity(border, 0.4),
                backgroundColor: withOpacity(surfaceMuted, 0.75),
              },
            ]}
          >
            <Icon name="image" color={withOpacity(accent, 0.5)} size={28} />
            <Text
              style={[
                styles.designUploadPlaceholderTitle,
                { color: primaryFont },
              ]}
            >
              No images yet
            </Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.designDescriptionCard,
          {
            borderColor: border,
            backgroundColor: surface,
          },
        ]}
      >
        <View style={styles.designDescriptionHeader}>
          <Text
            style={[
              styles.sectionLabel,
              { color: primaryFont },
            ]}
          >
            Design description
          </Text>
          <Text
            style={[
              styles.designDescriptionHint,
              { color: secondaryFont },
            ]}
          >
            Share inspiration references or special instructions.
          </Text>
        </View>
        <TextInput
          value={description}
          onChangeText={onChangeDescription}
          placeholder="Tell us about the look—palette, art style, finishes, accents."
          placeholderTextColor={withOpacity(primaryFont, 0.4)}
          multiline
          numberOfLines={4}
          style={[
            styles.designDescriptionInput,
            {
              color: primaryFont,
              borderColor: withOpacity(border, 0.75),
              backgroundColor: withOpacity(surfaceMuted, 0.45),
            },
          ]}
        />
      </View>
      <View
        style={[
          styles.designHelpCard,
          {
            borderColor: withOpacity(border, 0.5),
            backgroundColor: withOpacity(surfaceMuted, 0.4),
          },
        ]}
      >
        <View style={styles.designHelpCopy}>
          <Text
            style={[
              styles.designHelpTitle,
              { color: primaryFont },
            ]}
          >
            Need design help?
          </Text>
          <Text
            style={[
              styles.designHelpHint,
              { color: secondaryFont },
            ]}
          >
            Toggle on if you'd like Abri to suggest ideas or finalize details with you.
          </Text>
        </View>
        <Switch
          value={requiresFollowUp}
          onValueChange={onToggleFollowUp}
          trackColor={{
            false: withOpacity(border, 0.6),
            true: withOpacity(accent, 0.4),
          }}
          thumbColor={requiresFollowUp ? accent : surface}
          ios_backgroundColor={withOpacity(border, 0.6)}
        />
      </View>
    </View>
  );
}

function OrderSummaryStep({
  colors,
  orderDraft,
  onAddAnother,
  onEditSet,
  onRemoveSet,
  onPreviewSet,
}) {
  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    surfaceMuted = '#F4EBE3',
    shadow = '#000000',
    error: danger = '#B33A3A',
  } = colors || {};

  const sets = orderDraft.sets || [];

  return (
    <View style={styles.summaryContainer}>
      <View style={styles.summaryActionsRow}>
        <TouchableOpacity
          onPress={onAddAnother}
          style={[
            styles.summaryAddButton,
            {
              borderColor: withOpacity(accent, 0.35),
              backgroundColor: withOpacity(accent, 0.08),
            },
          ]}
          accessibilityLabel="Add another set"
          accessibilityHint="Save this set and add another"
        >
          <Icon name="plus" color={accent} size={16} />
          <Text
            style={[
              styles.summaryAddLabel,
              { color: accent },
            ]}
          >
            Add another set
          </Text>
        </TouchableOpacity>
      </View>

      {sets.length ? (
        <View style={styles.summaryList}>
          {sets.map((set, index) => {
            const previewSource = resolveUploadPreview(set.designUploads?.[0]);
            const quantity = set.quantity || 1;
            const subtotal =
              set.price ??
              (typeof set.unitPrice === 'number' ? set.unitPrice * quantity : 0);
            const requiresFollowUp = !!set.requiresFollowUp;

            return (
              <View
                key={set.id || `set_${index}`}
                style={[
                  styles.summaryCard,
                  {
                    borderColor: withOpacity(border, 0.45),
                    backgroundColor: surface,
                  },
                ]}
              >
                <View style={styles.summaryCardContent}>
                  <View style={styles.summaryPreviewWrapper}>
                    {previewSource ? (
                      <TouchableOpacity
                        onPress={() => onPreviewSet(set.id)}
                        style={styles.summaryPreviewImageWrapper}
                        accessibilityLabel={`Preview nail set ${index + 1}`}
                      >
                        <Image source={{ uri: previewSource }} style={styles.summaryPreviewImage} />
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.summaryPreviewPlaceholder,
                          { backgroundColor: withOpacity(surfaceMuted, 0.7) },
                        ]}
                      >
                        <Icon name="image" color={withOpacity(primaryFont, 0.35)} size={22} />
                        <Text
                          style={[
                            styles.summaryPreviewPlaceholderText,
                            { color: secondaryFont },
                          ]}
                        >
                          No image
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.summaryMeta}>
                    <Text
                      style={[
                        styles.summaryTitle,
                        { color: primaryFont },
                      ]}
                    >
                      {`Nail Set #${index + 1}`}
                    </Text>
                    <View style={styles.reviewMetaRow}>
                      <Text
                        style={[
                          styles.reviewMetaLabel,
                          { color: withOpacity(primaryFont, 0.7) },
                        ]}
                      >
                        Shape
                      </Text>
                      <Text
                        style={[
                          styles.reviewMetaValue,
                          { color: primaryFont },
                        ]}
                      >
                        {set.shapeName || 'Custom shape'}
                      </Text>
                    </View>
                    {set.designDescription ? (
                      <View style={styles.reviewMetaRow}>
                        <Text
                          style={[
                            styles.reviewMetaLabel,
                            { color: withOpacity(primaryFont, 0.7) },
                          ]}
                        >
                          Description
                        </Text>
                        <Text
                          style={[
                            styles.reviewMetaValue,
                            { color: secondaryFont },
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {set.designDescription}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.reviewMetaRow}>
                      <Text
                        style={[
                          styles.reviewMetaLabel,
                          { color: withOpacity(primaryFont, 0.7) },
                        ]}
                      >
                        Quantity
                      </Text>
                      <Text
                        style={[
                          styles.reviewMetaValue,
                          { color: primaryFont },
                        ]}
                      >
                        {quantity}
                      </Text>
                    </View>
                    {requiresFollowUp ? (
                      <View style={styles.reviewMetaRow}>
                        <Text
                          style={[
                            styles.reviewMetaLabel,
                            { color: withOpacity(primaryFont, 0.7) },
                          ]}
                        >
                          Follow-up
                        </Text>
                        <Text
                          style={[
                            styles.reviewMetaValue,
                            { color: accent },
                          ]}
                        >
                          Needs design assistance
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.summaryCardFooter}>
                  <Text
                    style={[
                      styles.summarySetPrice,
                      { color: accent },
                    ]}
                  >
                    {formatCurrency(subtotal)}
                  </Text>
                  <View style={styles.summaryActions}>
                    <TouchableOpacity
                      onPress={() => onEditSet(set.id)}
                      accessibilityLabel="Edit this nail set"
                      style={[
                        styles.reviewActionButton,
                        {
                          borderColor: withOpacity(accent, 0.35),
                          backgroundColor: withOpacity(accent, 0.08),
                        },
                      ]}
                    >
                      <Icon name="edit" color={accent} size={16} />
                      <Text
                        style={[
                          styles.reviewActionLabel,
                          { color: accent },
                        ]}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onRemoveSet(set.id)}
                      accessibilityLabel="Remove this nail set"
                      style={[
                        styles.reviewActionButton,
                        {
                          borderColor: withOpacity(border, 0.5),
                          backgroundColor: withOpacity(surfaceMuted, 0.5),
                        },
                      ]}
                    >
                      <Icon name="trash" color={withOpacity(primaryFont, 0.7)} size={16} />
                      <Text
                        style={[
                          styles.reviewActionLabel,
                          { color: withOpacity(primaryFont, 0.7) },
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View
          style={[
            styles.summaryEmpty,
            {
              borderColor: withOpacity(border, 0.5),
              backgroundColor: withOpacity(surfaceMuted, 0.7),
            },
          ]}
        >
          <Icon name="info" color={withOpacity(primaryFont, 0.4)} size={20} />
          <Text
            style={[
              styles.summaryEmptyTitle,
              { color: primaryFont },
            ]}
          >
            No sets saved yet
          </Text>
          <Text
            style={[
              styles.summaryEmptyCopy,
              { color: secondaryFont },
            ]}
          >
            Save your first nail set to continue to delivery.
          </Text>
        </View>
      )}
    </View>
  );
}

function SizingStep({ colors, sizeMode, sizes, onSelectSizeMode, onChangeSizes }) {
  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
  } = colors || {};

  return (
    <View style={styles.sizingContainer}>
      <Text
        style={[
          styles.sectionLabel,
          { color: primaryFont },
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
                  sizeMode === mode ? accent : border,
                backgroundColor:
                  sizeMode === mode ? withOpacity(accent, 0.07) : surface,
              },
            ]}
            onPress={() => onSelectSizeMode(mode)}
          >
            <Text
              style={[
                styles.modeLabel,
                {
                  color:
                    sizeMode === mode ? accent : secondaryFont,
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
                  { color: secondaryFont },
                ]}
              >
                {finger.toUpperCase()}
              </Text>
              <TextInput
                value={sizes[finger]}
                onChangeText={(value) => onChangeSizes({ [finger]: value })}
                placeholder="Size"
                placeholderTextColor={secondaryFont}
                style={[
                  styles.sizeInput,
                  {
                    borderColor: border,
                    color: primaryFont,
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
  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
  } = colors || {};

  return (
    <View style={styles.fulfillmentContainer}>
      <Text
        style={[
          styles.sectionLabel,
          { color: primaryFont },
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
                    ? accent
                    : border,
                  backgroundColor: isActive ? withOpacity(accent, 0.07) : surface,
                },
              ]}
              onPress={() => onChangeMethod(method.id)}
            >
              <Text
                style={[
                  styles.methodTitle,
                  { color: primaryFont },
                ]}
              >
                {method.label}
              </Text>
              <Text
                style={[
                  styles.methodDescription,
                  { color: secondaryFont },
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
          { color: primaryFont },
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
                    ? accent
                    : border,
                  backgroundColor: isActive ? withOpacity(accent, 0.06) : surface,
                },
              ]}
              onPress={() => onChangeSpeed(speed.id)}
            >
              <Text
                style={[
                  styles.speedTitle,
                  { color: primaryFont },
                ]}
              >
                {speed.label}
              </Text>
              <Text
                style={[
                  styles.speedDescription,
                  { color: secondaryFont },
                ]}
              >
                {speed.description}
              </Text>
              <Text
                style={[
                  styles.speedFee,
                  { color: accent },
                ]}
              >
                ${Number(speed.fee || 0).toFixed(2)}
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
              { color: primaryFont },
            ]}
          >
            Delivery address
          </Text>
          <TextInput
            value={fulfillment.address.name}
            onChangeText={(value) => onChangeAddress({ name: value })}
            placeholder="Full name"
            placeholderTextColor={secondaryFont}
            style={[
              styles.addressInput,
              {
                borderColor: border,
                color: primaryFont,
              },
            ]}
          />
          <TextInput
            value={fulfillment.address.line1}
            onChangeText={(value) => onChangeAddress({ line1: value })}
            placeholder="Address line 1"
            placeholderTextColor={secondaryFont}
            style={[
              styles.addressInput,
              {
                borderColor: border,
                color: primaryFont,
              },
            ]}
          />
          <TextInput
            value={fulfillment.address.line2}
            onChangeText={(value) => onChangeAddress({ line2: value })}
            placeholder="Address line 2 (optional)"
            placeholderTextColor={secondaryFont}
            style={[
              styles.addressInput,
              {
                borderColor: border,
                color: primaryFont,
              },
            ]}
          />
          <View style={styles.addressRow}>
            <TextInput
              value={fulfillment.address.city}
              onChangeText={(value) => onChangeAddress({ city: value })}
              placeholder="City"
              placeholderTextColor={secondaryFont}
              style={[
                styles.addressInputHalf,
                {
                  borderColor: border,
                  color: primaryFont,
                },
              ]}
            />
            <TextInput
              value={fulfillment.address.state}
              onChangeText={(value) => onChangeAddress({ state: value })}
              placeholder="State"
              placeholderTextColor={secondaryFont}
              autoCapitalize="characters"
              style={[
                styles.addressInputQuarter,
                {
                  borderColor: border,
                  color: primaryFont,
                },
              ]}
            />
            <TextInput
              value={fulfillment.address.postalCode}
              onChangeText={(value) => onChangeAddress({ postalCode: value })}
              placeholder="Postcode"
              placeholderTextColor={secondaryFont}
              style={[
                styles.addressInputQuarter,
                {
                  borderColor: border,
                  color: primaryFont,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function ReviewStep({
  colors,
  priceDetails,
  openingLegacy,
  sets = [],
  onEditSet,
  onRemoveSet,
  onAddAnotherSet,
  onPreviewSet,
  deliveryDetails,
  onEditDelivery,
  promoCode = '',
  isPromoInputVisible = false,
  promoInputValue = '',
  onTogglePromoInput = () => {},
  onChangePromoInput = () => {},
  onApplyPromoCode = () => {},
  onClearPromoCode = () => {},
}) {
  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    surfaceMuted = '#F4EBE3',
  } = colors || {};

  const methodConfig = pricingConstants.DELIVERY_METHODS[deliveryDetails?.method] || null;
  const speedConfig = methodConfig?.speedOptions?.[deliveryDetails?.speed] || null;
  const estimatedDate = priceDetails?.estimatedCompletionDate
    ? new Date(priceDetails.estimatedCompletionDate).toLocaleDateString()
    : null;
  const addressLines = deliveryDetails?.address
    ? [
        deliveryDetails.address.name,
        deliveryDetails.address.line1,
        deliveryDetails.address.line2,
        [deliveryDetails.address.city, deliveryDetails.address.state]
          .filter(Boolean)
          .join(', '),
        deliveryDetails.address.postalCode,
      ].filter(Boolean)
    : [];

  return (
    <View style={styles.reviewContainer}>
      <View style={styles.reviewSection}>
        <View style={styles.reviewSectionHeader}>
          <Text
            style={[
              styles.reviewHeading,
              { color: primaryFont },
            ]}
          >
            Order Summary
          </Text>
        </View>
        <View style={styles.reviewSetList}>
          {sets.map((set, index) => {
            const previewSource = resolveUploadPreview(set.designUploads?.[0]);
            const quantity = set.quantity || 1;
            const subtotal =
              set.price ??
              (typeof set.unitPrice === 'number' ? set.unitPrice * quantity : 0);
            const requiresFollowUp = !!set.requiresFollowUp;

            return (
              <View
                key={set.id || `summary_set_${index}`}
                style={[
                  styles.reviewSetCard,
                  {
                    borderColor: withOpacity(border, 0.45),
                    backgroundColor: surface,
                  },
                ]}
              >
                <View style={styles.reviewSetContent}>
                  <View style={styles.reviewSetPreview}>
                    {previewSource ? (
                      <TouchableOpacity
                        onPress={() => onPreviewSet?.(set.id)}
                        style={styles.reviewPreviewImageWrapper}
                        accessibilityLabel={`Preview nail set ${index + 1}`}
                      >
                        <Image source={{ uri: previewSource }} style={styles.reviewPreviewImage} />
                      </TouchableOpacity>
                    ) : (
                      <View
                        style={[
                          styles.reviewPreviewPlaceholder,
                          { backgroundColor: withOpacity(surfaceMuted, 0.7) },
                        ]}
                      >
                        <Icon name="image" color={withOpacity(primaryFont, 0.35)} size={22} />
                        <Text
                          style={[
                            styles.reviewPreviewPlaceholderText,
                            { color: secondaryFont },
                          ]}
                        >
                          No image
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.reviewSetMeta}>
                    <Text
                      style={[
                        styles.reviewSetTitle,
                        { color: primaryFont },
                      ]}
                    >
                      {`Nail Set #${index + 1}`}
                    </Text>
                    <View style={styles.reviewMetaRow}>
                      <Text
                        style={[
                          styles.reviewMetaLabel,
                          { color: withOpacity(primaryFont, 0.7) },
                        ]}
                      >
                        Shape
                      </Text>
                      <Text
                        style={[
                          styles.reviewMetaValue,
                          { color: primaryFont },
                        ]}
                      >
                        {set.shapeName || 'Custom shape'}
                      </Text>
                    </View>
                    {set.designDescription ? (
                      <View style={styles.reviewMetaRow}>
                        <Text
                          style={[
                            styles.reviewMetaLabel,
                            { color: withOpacity(primaryFont, 0.7) },
                          ]}
                        >
                          Description
                        </Text>
                        <Text
                          style={[
                            styles.reviewMetaValue,
                            { color: secondaryFont },
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {set.designDescription}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.reviewMetaRow}>
                      <Text
                        style={[
                          styles.reviewMetaLabel,
                          { color: withOpacity(primaryFont, 0.7) },
                        ]}
                      >
                        Quantity
                      </Text>
                      <Text
                        style={[
                          styles.reviewMetaValue,
                          { color: primaryFont },
                        ]}
                      >
                        {quantity}
                      </Text>
                    </View>
                    {requiresFollowUp ? (
                      <View style={styles.reviewMetaRow}>
                        <Text
                          style={[
                            styles.reviewMetaLabel,
                            { color: withOpacity(primaryFont, 0.7) },
                          ]}
                        >
                          Follow-up
                        </Text>
                        <Text
                          style={[
                            styles.reviewMetaValue,
                            { color: accent },
                          ]}
                        >
                          Needs design assistance
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View style={styles.reviewSetFooter}>
                  <Text
                    style={[
                      styles.reviewSetPrice,
                      { color: accent },
                    ]}
                  >
                    {formatCurrency(subtotal)}
                  </Text>
                  <View style={styles.reviewSetActions}>
                    <TouchableOpacity
                      onPress={() => onEditSet?.(set.id)}
                      style={[
                        styles.reviewActionButton,
                        {
                          borderColor: withOpacity(accent, 0.35),
                          backgroundColor: withOpacity(accent, 0.08),
                        },
                      ]}
                      accessibilityLabel={`Edit nail set ${index + 1}`}
                    >
                      <Icon name="edit" color={accent} size={16} />
                      <Text
                        style={[
                          styles.reviewActionLabel,
                          { color: accent },
                        ]}
                      >
                        Edit
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onRemoveSet?.(set.id)}
                      style={[
                        styles.reviewActionButton,
                        {
                          borderColor: withOpacity(border, 0.5),
                          backgroundColor: withOpacity(surfaceMuted, 0.5),
                        },
                      ]}
                      accessibilityLabel={`Remove nail set ${index + 1}`}
                    >
                      <Icon name="trash" color={withOpacity(primaryFont, 0.7)} size={16} />
                      <Text
                        style={[
                          styles.reviewActionLabel,
                          { color: withOpacity(primaryFont, 0.7) },
                        ]}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        <TouchableOpacity
          onPress={onAddAnotherSet}
          style={[
            styles.summaryAddButton,
            {
              alignSelf: 'flex-end',
              borderColor: withOpacity(accent, 0.35),
              backgroundColor: withOpacity(accent, 0.08),
              marginBottom: 12,
            },
          ]}
          accessibilityLabel="Add another nail set"
        >
          <Icon name="plus" color={accent} size={16} />
          <Text
            style={[
              styles.summaryAddLabel,
              { color: accent },
            ]}
          >
            Add another set
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.reviewSection}>
        <View style={styles.reviewSectionHeader}>
          <Text
            style={[
              styles.reviewHeading,
              { color: primaryFont },
            ]}
          >
            Delivery Details
          </Text>
          <TouchableOpacity
            onPress={onEditDelivery}
            accessibilityRole="button"
            accessibilityLabel="Edit delivery details"
          >
            <Text
              style={[
                styles.reviewLink,
                { color: accent },
              ]}
            >
              Edit delivery details
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.deliveryCard,
            {
              borderColor: withOpacity(border, 0.5),
              backgroundColor: surface,
            },
          ]}
        >
          <View style={styles.reviewMetaRow}>
            <Text style={[styles.deliveryLabel, { color: secondaryFont }]}>Method</Text>
            <Text style={[styles.deliveryValue, { color: primaryFont }]}>
              {methodConfig ? methodConfig.label : 'Not selected'}
            </Text>
          </View>
          <View style={styles.reviewMetaRow}>
            <Text style={[styles.deliveryLabel, { color: secondaryFont }]}>Timing</Text>
            <Text style={[styles.deliveryValue, { color: primaryFont }]}>
              {speedConfig ? `${speedConfig.label} • ${speedConfig.description}` : 'Not selected'}
            </Text>
          </View>
          <View style={styles.reviewMetaRow}>
            <Text style={[styles.deliveryLabel, { color: secondaryFont }]}>Estimated ready date</Text>
            <Text style={[styles.deliveryValue, { color: accent }]}>
              {estimatedDate || `${priceDetails?.estimatedCompletionDays || 0} business days`}
            </Text>
          </View>
          {addressLines.length ? (
            <View style={styles.reviewMetaRow}>
              <Text style={[styles.deliveryLabel, { color: secondaryFont }]}>Shipping</Text>
              <View style={styles.deliveryAddressBlock}>
                {addressLines.map((line, idx) => (
                  <Text
                    key={`address_line_${idx}`}
                    style={[styles.deliveryValue, { color: primaryFont }]}
                  >
                    {line}
                  </Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.reviewSection}>
        <View style={styles.reviewSectionHeader}>
          <Text
            style={[
              styles.reviewHeading,
              { color: primaryFont },
            ]}
          >
            Price Breakdown
          </Text>
          <TouchableOpacity accessibilityRole="button" onPress={onTogglePromoInput}>
            <Text
              style={[
                styles.reviewLink,
                { color: withOpacity(primaryFont, 0.7) },
              ]}
            >
              {promoCode ? `Promo code applied: ${promoCode.toUpperCase()}` : 'Have a promo code?'}
            </Text>
          </TouchableOpacity>
        </View>
        <View
          style={[
            styles.priceCard,
            {
              borderColor: withOpacity(border, 0.5),
              backgroundColor: surface,
            },
          ]}
        >
          <View style={styles.promoContainer}>
            {promoCode ? (
              <View style={styles.promoBadgeRow}>
                <View
                  style={[
                    styles.promoBadge,
                    {
                      backgroundColor: withOpacity(accent, 0.12),
                      borderColor: withOpacity(accent, 0.3),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.promoBadgeText,
                      { color: accent },
                    ]}
                  >
                    {promoCode.toUpperCase()}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={onClearPromoCode}
                  accessibilityRole="button"
                  accessibilityLabel="Remove promo code"
                >
                  <Text
                    style={[
                      styles.promoRemoveLabel,
                      { color: withOpacity(primaryFont, 0.65) },
                    ]}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
            {isPromoInputVisible ? (
              <View style={styles.promoInputRow}>
                <TextInput
                  value={promoInputValue}
                  onChangeText={onChangePromoInput}
                  placeholder="Enter promo code"
                  placeholderTextColor={withOpacity(primaryFont, 0.4)}
                  style={[
                    styles.promoInput,
                    {
                      color: primaryFont,
                      borderColor: withOpacity(border, 0.6),
                      backgroundColor: withOpacity(surfaceMuted, 0.55),
                    },
                  ]}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  keyboardType="default"
                  returnKeyType="done"
                  onSubmitEditing={onApplyPromoCode}
                />
                <TouchableOpacity
                  style={[
                    styles.promoApplyButton,
                    {
                      backgroundColor: accent,
                    },
                  ]}
                  onPress={onApplyPromoCode}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.promoApplyLabel,
                      { color: colors.accentContrast || '#FFFFFF' },
                    ]}
                  >
                    Apply
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
          <View style={styles.priceList}>
            {priceDetails.lineItems.map((item) => (
              <View key={item.id} style={styles.priceRow}>
                <Text
                  style={[
                    styles.priceLabel,
                    { color: secondaryFont },
                  ]}
                >
                  {item.label}
                </Text>
                <Text
                  style={[
                    styles.priceValue,
                    { color: primaryFont },
                  ]}
                >
                  ${Number(item.amount || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.totalRow}>
            <Text
              style={[
                styles.totalLabel,
                { color: primaryFont },
              ]}
            >
              Total
            </Text>
            <Text
              style={[
                styles.totalValue,
                { color: accent },
              ]}
            >
              ${Number(priceDetails.total || 0).toFixed(2)}
            </Text>
          </View>
        </View>
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
  stepperTitle: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 12,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 8,
    gap: 4,
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
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  setStatusPill: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 20,
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
    borderRadius: 18,
    padding: 18,
    gap: 16,
  },
  designUploadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  designUploadHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  designUploadHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  designUploadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  designUploadActionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  designUploadGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  designUploadItem: {
    width: '48%',
    minWidth: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    gap: 10,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  designUploadThumbnailFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  designUploadImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  designUploadEmpty: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  designUploadEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  designUploadMeta: {
    gap: 4,
  },
  designUploadName: {
    fontSize: 13,
    fontWeight: '600',
  },
  designUploadRemove: {
    fontSize: 12,
    fontWeight: '700',
  },
  designUploadPlaceholder: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  designUploadPlaceholderTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  designDescriptionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
    gap: 14,
  },
  designDescriptionHeader: {
    gap: 4,
  },
  designDescriptionHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  designDescriptionInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 14,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  designHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    gap: 12,
  },
  designHelpCopy: {
    flex: 1,
    gap: 4,
  },
  designHelpTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  designHelpHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  validationText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  summaryContainer: {
    gap: 16,
  },
  summaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  summaryAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  summaryAddLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryList: {
    gap: 12,
  },
  summaryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  summaryCardContent: {
    flexDirection: 'row',
    gap: 16,
  },
  summaryPreviewWrapper: {
    width: 84,
  },
  summaryPreviewImageWrapper: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: 'hidden',
  },
  summaryPreviewImage: {
    width: '100%',
    height: '100%',
  },
  summaryPreviewPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  summaryPreviewPlaceholderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  summaryMeta: {
    flex: 1,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summarySetPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  summaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryEmpty: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    gap: 10,
  },
  summaryEmptyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryEmptyCopy: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
  },
  previewModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  previewModalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 16,
  },
  previewModalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  previewModalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  previewModalBody: {
    maxHeight: 280,
  },
  previewModalBodyContent: {
    gap: 12,
  },
  previewModalImage: {
    width: '100%',
    height: 180,
    borderRadius: 16,
  },
  previewModalSection: {
    gap: 6,
  },
  previewModalSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  previewModalSectionCopy: {
    fontSize: 13,
    lineHeight: 19,
  },
  sizingContainer: {
    gap: 20,
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
    gap: 18,
  },
  reviewSection: {
    gap: 12,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  reviewSetList: {
    gap: 12,
  },
  reviewSetCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 16,
  },
  reviewSetContent: {
    flexDirection: 'row',
    gap: 16,
  },
  reviewSetPreview: {
    width: 84,
  },
  reviewPreviewImageWrapper: {
    width: 84,
    height: 84,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reviewPreviewImage: {
    width: '100%',
    height: '100%',
  },
  reviewPreviewPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  reviewPreviewPlaceholderText: {
    fontSize: 11,
    fontWeight: '600',
  },
  reviewSetMeta: {
    flex: 1,
    gap: 8,
  },
  reviewSetTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  reviewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
  },
  reviewMetaLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexBasis: 90,
  },
  reviewMetaValue: {
    fontSize: 12,
    flex: 1,
  },
  reviewSetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  reviewSetPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  reviewSetActions: {
    flexDirection: 'row',
    gap: 12,
  },
  reviewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  reviewActionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  reviewLink: {
    fontSize: 13,
    fontWeight: '700',
  },
  deliveryCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  deliveryLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  deliveryValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  deliveryAddressBlock: {
    gap: 2,
    flex: 1,
  },
  priceCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  promoContainer: {
    gap: 8,
  },
  promoBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  promoBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  promoBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  promoRemoveLabel: {
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  promoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  promoInput: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  promoApplyButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoApplyLabel: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.75,
  },
  priceList: {
    gap: 8,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    paddingTop: 12,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  etaText: {
    fontSize: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    gap: 16,
    columnGap: 16,
  },
  footerButtonWrapper: {
    flex: 1,
    minWidth: 0,
  },
  footerButtonWrapperSmall: {
    flex: 0.7,
    minWidth: 0,
  },
  footerButtonWrapperLarge: {
    flex: 1.05,
    minWidth: 0,
  },
  footerButtonSpacer: {
    flex: 1,
  },
  footerButtonWrapperMedium: {
    flex: 0.95,
    minWidth: 0,
  },
  footerButton: {
    flex: 1,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    width: '100%',
  },
  footerButtonText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  footerPrimaryButton: {
    flex: 1,
    minHeight: 52,
    width: '100%',
  },
  legacyBuilderButton: {
    marginTop: 16,
  },
  footerButtonWrapperLargeTight: {
    flex: 0.95,
    minWidth: 0,
  },
  footerButtonWrapperSummary: {
    flex: 1,
  },
  toast: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: withOpacity('#6F171F', 0.92),
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
    alignItems: 'center',
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default NewOrderStepperScreen;


