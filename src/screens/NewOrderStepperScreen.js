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
  TouchableWithoutFeedback,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme';
import { useAppState } from '../context/AppContext';
import { fetchShapes, createOrUpdateOrder } from '../services/api';
import { calculatePriceBreakdown, calculatePriceBreakdownSync, getDeliveryMethods, getDeliveryMethodsSync, clearDeliveryMethodsCache, formatCurrency } from '../utils/pricing';
import { validatePromoCode } from '../services/promoCodeService';
import PrimaryButton from '../components/PrimaryButton';
import Icon from '../icons/Icon';
import { logEvent } from '../utils/analytics';
import { withOpacity } from '../utils/color';
import { launchImageLibrary } from 'react-native-image-picker';
import { uploadImageToStorage } from '../services/imageStorageService';

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
    subtitle: 'Get your nail sizes just right!',
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
const FINGER_LABELS = {
  thumb: 'Thumb',
  index: 'Index',
  middle: 'Middle',
  ring: 'Ring',
  pinky: 'Pinky',
};

function createEmptySetDraft() {
  return {
    id: null,
    shapeId: null,
    designDescription: '',
    designUploads: [],
    sizingUploads: [],
    // Separate help flags for design and sizing
    requiresDesignHelp: false,
    requiresSizingHelp: false,
    // Keep requiresFollowUp for backward compatibility (derived from the above)
    requiresFollowUp: false,
    quantity: 1,
    sizeMode: 'standard',
    sizes: { ...DEFAULT_SIZES },
      selectedSizingOption: null,
      selectedProfileId: null,
      saveAsDefault: false, // Track if user wants to save sizes as default
    };
  }

function createDefaultDeliveryDetails() {
  return {
    method: 'pickup',
    speed: 'standard',
    address: {
      label: '',
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

function resolveSizingOptionFromSet(set = {}) {
  if (set.selectedSizingOption) {
    return set.selectedSizingOption;
  }

  if (Array.isArray(set.sizingUploads) && set.sizingUploads.length > 0) {
    return 'camera';
  }

  if (set.sizeMode === 'manual') {
    return 'manual';
  }

  return 'saved';
}

function getSetSizeDetails(set = {}) {
  const mode = set.sizeMode || set.sizes?.mode || 'standard';
  const sizes = set.sizes || {};
  // Use requiresSizingHelp if available, fall back to requiresFollowUp for backward compatibility
  const requiresSizingHelp = Boolean(set.requiresSizingHelp ?? set.requiresFollowUp);
  const presetLabel =
    set.sizePresetLabel ||
    set.sizePreset ||
    set.sizeLabel ||
    (typeof sizes.label === 'string' ? sizes.label : null);

  const entries = FINGER_KEYS.map((finger, index) => {
    const value =
      sizes?.[finger] ||
      sizes?.values?.[finger] ||
      (Array.isArray(sizes?.values) ? sizes.values[index] : null);
    if (!value) {
      return null;
    }
    return {
      finger,
      label: FINGER_LABELS[finger] || finger,
      value,
    };
  }).filter(Boolean);

  if (entries.length) {
    return { entries, requiresSizingHelp };
  }

  if (presetLabel) {
    return { fallback: presetLabel, requiresSizingHelp };
  }

  const hasSizingPhotos = Array.isArray(set.sizingUploads) && set.sizingUploads.length > 0;

  if (hasSizingPhotos) {
    return { fallback: 'Photos provided', requiresSizingHelp };
  }

  if (mode === 'perSet') {
    return { fallback: 'Custom sizes provided', requiresSizingHelp };
  }

  return { fallback: 'Standard sizes', requiresSizingHelp };
}

function ImagePreviewModal({ preview, onClose, colors }) {
  if (!preview || !preview.uri) {
    return null;
  }

  const {
    surface = '#FFFFFF',
    border = '#D9C8A9',
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
  } = colors || {};

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.previewModalContainer}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.previewModalCard,
            {
              backgroundColor: surface,
              borderColor: withOpacity(border, 0.6),
              maxWidth: 480,
            },
          ]}
        >
          <Image
            source={{ uri: preview.uri }}
            style={styles.previewModalImageLarge}
            resizeMode="contain"
          />
          {preview.name ? (
            <Text
              style={[
                styles.previewModalSubtitle,
                { color: secondaryFont },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {preview.name}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            style={[
              styles.previewCloseButton,
              {
                borderColor: withOpacity(border, 0.5),
                backgroundColor: withOpacity(surface, 0.95),
              },
            ]}
          >
            <Text
              style={[
                styles.previewCloseLabel,
                { color: primaryFont },
              ]}
            >
              Close
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function NewOrderStepperScreen({ route }) {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { state, setState, handleDraftSaved, handleOrderComplete, handleUpdatePreferences } = useAppState();
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
  const [deliveryMethods, setDeliveryMethods] = useState(null);
  const [loadingDeliveryMethods, setLoadingDeliveryMethods] = useState(true);
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
    customerSizes: null, // Store customerSizes at order level for easy access
    saveAddress: false, // Store whether user wants to save the address
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
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [capacityInfo, setCapacityInfo] = useState(null);

  const savedSizeProfiles = useMemo(() => {
    const nailSizes = state?.preferences?.nailSizes;
    if (!nailSizes) {
      return [];
    }

    const options = [];

    const addProfileOption = (profile, fallbackLabel, isDefault, index = 0) => {
      if (!profile) {
        return;
      }

      const normalizedSizes = { ...DEFAULT_SIZES, ...(profile.sizes || {}) };
      const hasValues = FINGER_KEYS.some((finger) => {
        const value = normalizedSizes[finger];
        return value !== undefined && value !== null && String(value).trim().length > 0;
      });

      if (!hasValues) {
        return;
      }

      options.push({
        id: profile.id || (isDefault ? 'default' : `profile_${index}`),
        label:
          typeof profile.label === 'string' && profile.label.trim().length
            ? profile.label.trim()
            : fallbackLabel,
        sizes: normalizedSizes,
        isDefault,
      });
    };

    addProfileOption(nailSizes.defaultProfile, 'Default nail size', true, 0);

    if (Array.isArray(nailSizes.profiles)) {
      nailSizes.profiles.forEach((profile, index) => {
        addProfileOption(profile, `Size profile ${index + 1}`, false, index);
      });
    }

    return options;
  }, [state?.preferences?.nailSizes]);

  // Check if user has default sizes (use ref to track initial state so checkbox doesn't disappear after saving)
  const initialHasDefaultSizesRef = useRef(null);
  const hasDefaultSizes = useMemo(() => {
    const nailSizes = state?.preferences?.nailSizes;
    if (!nailSizes?.defaultProfile) {
      if (initialHasDefaultSizesRef.current === null) {
        initialHasDefaultSizesRef.current = false;
      }
      return false;
    }
    const defaultSizes = nailSizes.defaultProfile?.sizes || {};
    const hasDefaults = FINGER_KEYS.some((finger) => {
      const value = defaultSizes[finger];
      return value !== undefined && value !== null && String(value).trim().length > 0;
    });
    if (initialHasDefaultSizesRef.current === null) {
      initialHasDefaultSizesRef.current = hasDefaults;
    }
    return hasDefaults;
  }, [state?.preferences?.nailSizes]);
  
  // Use initial state for checkbox visibility (so it doesn't disappear after saving)
  const shouldShowSaveAsDefaultCheckbox = initialHasDefaultSizesRef.current === false;

  // Handler to save sizes as default
  const handleSaveDefaultSizes = useCallback(async (sizes, shouldSave) => {
    if (!shouldSave || !state.currentUser) {
      return;
    }

    try {
      const nextPreferences = {
        ...state.preferences,
        nailSizes: {
          ...state.preferences.nailSizes,
          defaultProfile: {
            id: 'default',
            label: 'My default sizes',
            sizes: sizes || {},
          },
        },
      };
      await handleUpdatePreferences(nextPreferences);
      logEvent('nail_sizes_saved_as_default');
    } catch (error) {
      console.error('[NewOrderStepper] Failed to save default sizes:', error);
      Alert.alert('Error', 'Unable to save default sizes. Please try again.');
    }
  }, [state.currentUser, state.preferences, handleUpdatePreferences]);

  useEffect(() => {
    logEvent('start_order_step', { step: STEP_DEFINITIONS[currentStep].key });
  }, [currentStep]);

  // Fetch capacity info when on review step
  useEffect(() => {
    const currentStepKey = STEP_DEFINITIONS[currentStep]?.key;
    if (currentStepKey === 'review') {
      // Load capacity info when user reaches review step
      const loadCapacityInfo = async () => {
        try {
          const { checkCapacityAvailability } = await import('../services/workloadService');
          const info = await checkCapacityAvailability();
          setCapacityInfo(info);
        } catch (error) {
          console.error('[NewOrderStepper] Failed to load capacity info:', error);
          // Don't block user if capacity check fails
          setCapacityInfo(null);
        }
      };
      loadCapacityInfo();
    }
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
      setToastType('default');
    }, 5000); // Auto-dismiss after 5 seconds (matching OrdersScreen)
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, [toastMessage]);

  const loadDeliveryMethods = useCallback(async () => {
    try {
      setLoadingDeliveryMethods(true);
      // Clear cache to get fresh data
      clearDeliveryMethodsCache();
      const methods = await getDeliveryMethods();
      if (methods && Object.keys(methods).length > 0) {
        setDeliveryMethods(methods);
      } else {
        // Fallback to static methods
        const { pricingConstants } = require('../utils/pricing');
        setDeliveryMethods(pricingConstants.DELIVERY_METHODS);
      }
    } catch (err) {
      console.error('[NewOrderStepper] Error loading delivery methods:', err);
      // Fallback to static methods
      const { pricingConstants } = require('../utils/pricing');
      setDeliveryMethods(pricingConstants.DELIVERY_METHODS);
    } finally {
      setLoadingDeliveryMethods(false);
    }
  }, []);

  useEffect(() => {
    const loadShapes = async () => {
      try {
        setLoadingShapes(true);
        const catalog = await fetchShapes();
        if (__DEV__) {
          console.log('[NewOrderStepper] Loaded shapes:', catalog?.length || 0);
        }
        if (Array.isArray(catalog) && catalog.length > 0) {
          setShapes(catalog);
        } else {
          console.warn('[NewOrderStepper] No shapes returned from fetchShapes, using fallback');
          // Import the fallback catalog directly
          const shapeCatalog = require('../../shared/catalog/shapes.json');
          if (Array.isArray(shapeCatalog) && shapeCatalog.length > 0) {
            setShapes(shapeCatalog);
          } else {
            console.error('[NewOrderStepper] Fallback catalog is also empty!');
            setShapes([]);
          }
        }
      } catch (err) {
        console.error('[NewOrderStepper] Error loading shapes:', err);
        // Try to use fallback catalog directly
        try {
          const shapeCatalog = require('../../shared/catalog/shapes.json');
          if (Array.isArray(shapeCatalog) && shapeCatalog.length > 0) {
            setShapes(shapeCatalog);
          } else {
            setShapes([]);
          }
        } catch (fallbackErr) {
          console.error('[NewOrderStepper] Failed to load fallback catalog:', fallbackErr);
          setShapes([]);
        }
      } finally {
        setLoadingShapes(false);
      }
    };

    loadShapes();
    loadDeliveryMethods();
  }, [loadDeliveryMethods]);

  // Reload delivery methods when screen comes into focus (in case admin made changes)
  useFocusEffect(
    useCallback(() => {
      loadDeliveryMethods();
    }, [loadDeliveryMethods])
  );

  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === currentSetDraft.shapeId),
    [currentSetDraft.shapeId, shapes],
  );

  useEffect(() => {
    setPromoInputValue(orderDraft.promoCode || '');
  }, [orderDraft.promoCode]);

  // Re-validate promo code when order changes (sets, delivery details)
  // This ensures discount stays accurate if order is modified after applying promo
  useEffect(() => {
    const revalidatePromoCode = async () => {
      if (!orderDraft.promoCode || !orderDraft.promoCodeData?.valid) {
        return;
      }

      try {
        const validationResult = await validatePromoCode(orderDraft.promoCode, {
          nailSets: orderDraft.sets,
          fulfillment: orderDraft.deliveryDetails,
        }, state.currentUser?.id);

        if (validationResult.valid) {
          // Update the promo code data with new discount amount
          setOrderDraft((prev) => ({
            ...prev,
            promoCodeData: validationResult,
          }));
        } else {
          // Promo code is no longer valid - clear it
          setOrderDraft((prev) => ({
            ...prev,
            promoCode: '',
            promoCodeData: null,
          }));
          showToast(validationResult.error || 'Promo code is no longer valid', 'error');
        }
      } catch (error) {
        console.error('[NewOrderStepper] Error re-validating promo code:', error);
        // Don't clear on error - keep existing discount
      }
    };

    // Only re-validate if we have sets and delivery details
    if (orderDraft.sets.length > 0 && orderDraft.deliveryDetails?.method) {
      revalidatePromoCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderDraft.sets.length, orderDraft.deliveryDetails?.method, orderDraft.deliveryDetails?.speed, orderDraft.promoCode, state.currentUser?.id, showToast]);

  const resumeFlag = Boolean(route?.params?.resume);
  // Check if order is a draft or "Awaiting Submission" (both can be edited)
  const orderStatusLower = (state.activeOrder?.status || '').toLowerCase();
  const isDraftStatus = orderStatusLower === 'draft';
  const isAwaitingSubmission = orderStatusLower === 'awaiting submission';
  const isEditableOrder = isDraftStatus || isAwaitingSubmission;
  const resumeDraft = resumeFlag && isEditableOrder ? state.activeOrder : null;
  const stepperTitle = resumeDraft 
    ? (isAwaitingSubmission ? 'Resubmit Order' : 'Edit Draft Order')
    : 'Design & Order Your Nails';

  useEffect(() => {
    if (!resumeDraft) {
      return;
    }

    if (hydratedDraftRef.current === resumeDraft.id) {
      return;
    }

    const draftSets = Array.isArray(resumeDraft.nailSets) ? resumeDraft.nailSets : [];
    const method = resumeDraft.fulfillment?.method || 'pickup';
    const methods = deliveryMethods || getDeliveryMethodsSync();
    const methodConfigCandidate = methods[method];
    const fallbackMethodConfig = methods.pickup || Object.values(methods)[0];
    const methodConfigForDraft = methodConfigCandidate || fallbackMethodConfig;
    const speed =
      resumeDraft.fulfillment?.speed || methodConfigForDraft?.defaultSpeed || 'standard';

    if (__DEV__) {
      console.log('[NewOrderStepper] Loading draft order:', {
        orderId: resumeDraft.id,
        customerSizes: resumeDraft.customerSizes,
        customerSizesProfileId: resumeDraft.customerSizes?.profileId,
        setsCount: draftSets.length,
      });
    }

    const normalizedAddress = {
      label: '',
      name: '',
      line1: '',
      line2: '',
      city: '',
      state: '',
      postalCode: '',
      ...(resumeDraft.fulfillment?.address || {}),
    };

    const mappedSets = draftSets.map((set, index) => {
      // Determine if this set uses saved sizing
      const usesSavedSizing = set.selectedSizingOption === 'saved' || 
        (set.sizes?.mode !== 'perSet' && !set.sizingUploads?.length && resumeDraft?.customerSizes?.profileId);
      
      // Restore sizes - if using saved profile, get from customerSizes
      const restoredSizes = set.sizes?.mode === 'perSet'
        ? normalizeDraftSizes(set.sizes)
        : (usesSavedSizing && resumeDraft?.customerSizes?.values
          ? resumeDraft.customerSizes.values
          : (set.sizes?.values || { ...DEFAULT_SIZES }));

      // Restore profile ID - prioritize customerSizes.profileId (order-level) over set-level
      const restoredProfileId = resumeDraft?.customerSizes?.profileId || set.selectedProfileId || null;

      // Preserve selectedSizingOption from database first, then fall back to inference
      // Only override to 'saved' if we have a profileId AND the original option was 'saved' or undefined
      const restoredSizingOption = set.selectedSizingOption
        ? set.selectedSizingOption // Prioritize saved option from database
        : (usesSavedSizing && restoredProfileId
          ? 'saved'
          : resolveSizingOptionFromSet(set));

      if (__DEV__) {
        console.log('[NewOrderStepper] Restoring set:', {
          setId: set.id,
          usesSavedSizing,
          restoredSizingOption,
          restoredProfileId,
          hasCustomerSizes: !!resumeDraft?.customerSizes,
          customerSizesProfileId: resumeDraft?.customerSizes?.profileId,
        });
      }

      return {
        id: set.id || `set_${index}`,
        name: set.name || null,
        shapeId: set.shapeId || null,
        designDescription: set.description || '',
        designUploads: Array.isArray(set.designUploads)
          ? set.designUploads.map((upload, uploadIndex) => {
              const base64Data = upload.data || upload.base64 || upload.content || null;
              const preview = resolveUploadPreview(upload);
              return {
                ...upload,
                id: upload?.id || `upload_${index}_${uploadIndex}`,
                // Ensure base64 data is preserved
                base64: base64Data,
                data: base64Data,
                // Ensure uri is set for display
                uri: upload.uri || preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
                preview: preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
              };
            })
          : [],
        sizingUploads: Array.isArray(set.sizingUploads)
          ? set.sizingUploads.map((upload, uploadIndex) => {
              const base64Data = upload.data || upload.base64 || upload.content || null;
              const preview = resolveUploadPreview(upload);
              return {
                ...upload,
                id: upload?.id || `sizing_${index}_${uploadIndex}`,
                // Ensure base64 data is preserved
                base64: base64Data,
                data: base64Data,
                // Ensure uri is set for display
                uri: upload.uri || preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
                preview: preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
              };
            })
          : [],
        // Handle backward compatibility: if requiresFollowUp exists but separate fields don't, use it for both
        requiresDesignHelp: Boolean(set.requiresDesignHelp ?? set.requiresFollowUp),
        requiresSizingHelp: Boolean(set.requiresSizingHelp ?? set.requiresFollowUp),
        // Keep requiresFollowUp for backward compatibility (derived from the separate fields)
        requiresFollowUp: Boolean(set.requiresDesignHelp || set.requiresSizingHelp || set.requiresFollowUp),
        quantity: Number(set.quantity) || 1,
        sizeMode: set.sizes?.mode === 'perSet' ? 'perSet' : 'standard',
        sizes: restoredSizes,
        price: set.price || null,
        selectedSizingOption: restoredSizingOption,
        selectedProfileId: restoredProfileId,
      };
    });

    setDraftOrderId(resumeDraft.id || mappedSets[0]?.id || null);

    setOrderDraft({
      sets: mappedSets,
      deliveryDetails: {
        method,
        speed,
        address: normalizedAddress,
        notes: resumeDraft.fulfillment?.notes || '',
      },
      promoCode: resumeDraft.promoCode || '',
      customerSizes: resumeDraft.customerSizes || null, // Store customerSizes for easy access
      saveAddress: resumeDraft.saveAddress || false, // Restore save address checkbox state
    });

    const resolvedStepKey = (() => {
      // Check if route params specify an initial step (e.g., for "Awaiting Submission" orders)
      const initialStep = route?.params?.initialStep;
      if (initialStep) {
        const exists = STEP_DEFINITIONS.some((step) => step.key === initialStep);
        if (exists) {
          return initialStep;
        }
      }
      if (resumeDraft.resumeStepKey) {
        const exists = STEP_DEFINITIONS.some((step) => step.key === resumeDraft.resumeStepKey);
        if (exists) {
          return resumeDraft.resumeStepKey;
        }
      }
      if (mappedSets.length) {
        return 'summary';
      }
      return 'shape';
    })();

    const targetStepIndex = Math.max(
      STEP_DEFINITIONS.findIndex((step) => step.key === resolvedStepKey),
      0,
    );

    let initialEditingId = null;
    let initialDraft = createEmptySetDraft();

    if (SET_STEPS.includes(resolvedStepKey)) {
      const preferredSetId = resumeDraft.resumeSetId;
      const matchedSet = preferredSetId
        ? mappedSets.find((set) => set.id === preferredSetId)
        : mappedSets[0];

      if (matchedSet) {
        initialEditingId = matchedSet.id;
        initialDraft = {
          ...matchedSet,
          designUploads: (matchedSet.designUploads || []).map((upload) => ({ ...upload })),
          sizingUploads: (matchedSet.sizingUploads || []).map((upload) => ({ ...upload })),
          selectedSizingOption: matchedSet.selectedSizingOption || null,
          selectedProfileId: matchedSet.selectedProfileId || null,
          saveAsDefault: Boolean(matchedSet.saveAsDefault), // Restore checkbox state
        };
      } else {
        initialDraft = createEmptySetDraft();
      }
    }

    setCurrentSetDraft(initialDraft);
    setEditingSetId(initialEditingId);
    // Restore saveAsDefault state when resuming draft
    setSaveAsDefault(Boolean(initialDraft.saveAsDefault));
    setCurrentStep(targetStepIndex);
    hydratedDraftRef.current = resumeDraft.id || true;
    if (navigation.setParams) {
      navigation.setParams({ ...(route?.params || {}), resume: false });
    }
  }, [navigation, resumeDraft, resumeFlag, route?.params]);

  const priceDetails = useMemo(
    () => {
      // If we have validated promo code data, use the discount from it
      // Otherwise, pass the promo code string for backward compatibility
      const promoCodeForPricing = orderDraft.promoCodeData?.valid
        ? orderDraft.promoCodeData // Pass the validated promo data
        : orderDraft.promoCode; // Fallback to string

      const breakdown = calculatePriceBreakdownSync({
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
        promoCode: promoCodeForPricing,
      });

      if (__DEV__ && orderDraft.promoCode) {
        console.log('[NewOrderStepper] Price breakdown:', {
          hasPromoCode: !!orderDraft.promoCode,
          hasPromoCodeData: !!orderDraft.promoCodeData,
          promoCodeForPricing: typeof promoCodeForPricing,
          discount: breakdown.discounts,
          total: breakdown.total,
          lineItemsCount: breakdown.lineItems.length,
        });
      }

      return breakdown;
    },
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
      // Check for design help specifically (not sizing help)
      if (!hasDescription && !hasUploads && !currentSetDraft.requiresDesignHelp) {
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
        // Store Storage URL if available, fallback to base64 for backward compatibility
        url: upload.url || upload.storageUrl || null,
        base64: upload.url ? null : (upload.base64 || null), // Only include base64 if no URL
      })),
      sizingUploads: (set.sizingUploads || []).map((upload, uploadIndex) => ({
        id: upload.id || `sizing_${index}_${uploadIndex}`,
        fileName: upload.fileName || null,
        // Store Storage URL if available, fallback to base64 for backward compatibility
        url: upload.url || upload.storageUrl || null,
        base64: upload.url ? null : (upload.base64 || null), // Only include base64 if no URL
        uri: upload.url || upload.uri || null,
      })),
      // Save separate help flags
      requiresDesignHelp: set.requiresDesignHelp ?? set.requiresFollowUp,
      requiresSizingHelp: set.requiresSizingHelp ?? false,
      // Keep requiresFollowUp for backward compatibility (derived from the separate fields)
      requiresFollowUp: set.requiresDesignHelp || set.requiresSizingHelp || set.requiresFollowUp,
      sizes:
        set.sizeMode === 'perSet'
          ? { 
              mode: 'perSet', 
              values: set.sizes?.values || set.sizes || {} 
            }
          : { mode: 'standard', values: {} },
      price: set.price || null,
      selectedSizingOption: set.selectedSizingOption || resolveSizingOptionFromSet(set),
    }));

    const fulfillment = orderDraft.deliveryDetails;

    // Find the set with saved sizing option to get the selected profile ID and sizes
    // Check both orderDraft.sets AND currentSetDraft (if we're editing a set)
    // For saved sizing, sizes are stored at order level in customerSizes
    // Note: saved sizing can be used with either 'standard' or 'perSet' sizeMode
    let savedSizingSet = orderDraft.sets.find(
      (set) => set.selectedSizingOption === 'saved',
    );
    
    // If we're currently editing a set and it uses saved sizing, use that instead
    if (editingSetId && currentSetDraft.selectedSizingOption === 'saved') {
      savedSizingSet = currentSetDraft;
    } else if (!editingSetId && currentSetDraft.selectedSizingOption === 'saved') {
      // If we're creating a new set and it uses saved sizing, use currentSetDraft
      savedSizingSet = currentSetDraft;
    }
    
    const selectedProfileId = savedSizingSet?.selectedProfileId || null;
    const savedSizes = savedSizingSet?.sizes || {};

    if (__DEV__) {
      console.log('[buildOrderPayload] Saved sizing set:', {
        found: !!savedSizingSet,
        selectedProfileId,
        savedSizes,
        editingSetId,
        currentSetDraftSelectedProfileId: currentSetDraft.selectedProfileId,
        currentSetDraftSelectedSizingOption: currentSetDraft.selectedSizingOption,
      });
    }

    // Build customerSizes with profile ID and sizes if using saved profile
    // For saved sizing, we always store at order level regardless of sizeMode
    const customerSizes = savedSizingSet && savedSizingSet.selectedSizingOption === 'saved'
      ? {
          mode: savedSizingSet.sizeMode || 'standard', // Preserve the sizeMode
          values: savedSizes,
          profileId: selectedProfileId, // Store the selected profile ID
        }
      : { mode: 'standard', values: {} };

    // Include order ID if it exists (for updates)
    // Priority: resumeDraft > activeOrder > draftOrderId (set by ensureOrderExists)
    const orderId = resumeDraft?.id || state.activeOrder?.id || draftOrderId || null;
    
    return {
      id: orderId,
      userId: state.currentUser?.id,
      nailSets: mappedSets,
      customerSizes,
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

  const persistDraftOrder = async (options = {}) => {
    const { stepKey = currentStepKey, setId = editingSetId } = options || {};
    // When saving a draft, status is automatically set to "Draft"
    const payload = buildOrderPayload('Draft');
    // eslint-disable-next-line no-console
    console.log('[OrderDraft] Persist payload', payload);
    const response = await createOrUpdateOrder(payload);
    setDraftOrderId(response.order.id);
    
    // If user wants to save the address, save it to their profile
    if (orderDraft.saveAddress && payload.fulfillment?.address) {
      const address = payload.fulfillment.address;
      // Check if address is complete
      if (address.name && address.line1 && address.city && address.state && address.postalCode) {
        try {
          const { addSavedAddress, getSavedAddresses } = await import('../services/addressService');
          // Get current saved addresses to determine default label if needed
          const currentAddresses = await getSavedAddresses();
          const addressLabel = address.label || `Address ${(currentAddresses?.length || 0) + 1}`;
          await addSavedAddress({
            label: addressLabel,
            name: address.name,
            line1: address.line1,
            line2: address.line2 || null,
            city: address.city,
            state: address.state,
            postalCode: address.postalCode,
            isDefault: false, // Don't set as default automatically
          });
          if (__DEV__) {
            console.log('[NewOrderStepper] Address saved to profile with label:', addressLabel);
          }
        } catch (error) {
          console.error('[NewOrderStepper] Error saving address:', error);
          // Don't block draft save if address save fails
        }
      }
    }
    
    handleDraftSaved(response.order, {
      currentStepKey: stepKey,
      currentSetId: setId,
    });
    return response.order;
  };

  const handleSaveDraft = async () => {
    try {
      setSavingDraft(true);
      
      // If user selected manual entry with save-as-default checkbox checked, save as default
      const shouldSaveAsDefault = saveAsDefault || currentSetDraft.saveAsDefault;
      if (shouldSaveAsDefault && currentSetDraft.selectedSizingOption === 'manual') {
        const sizes = currentSetDraft.sizes?.values || currentSetDraft.sizes || {};
        const hasAllSizes = FINGER_KEYS.every((finger) => {
          const value = sizes[finger];
          return value !== undefined && value !== null && String(value).trim().length > 0;
        });
        
        if (hasAllSizes) {
          // Save as default when saving draft
          await handleSaveDefaultSizes(sizes, true).catch((error) => {
            console.error('[NewOrderStepper] Failed to save default sizes:', error);
            // Don't block the save if default saving fails
          });
        }
      }
      
      const order = await persistDraftOrder({
        stepKey: currentStepKey,
        setId: editingSetId,
      });
      logEvent('save_order_draft', { order_id: order.id });
      
      // Navigate to Orders tab with toast message (similar to "Awaiting Submission" toast)
      const toastMessage = 'Draft saved! You can continue editing this set anytime.';
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: {
              index: 2, // Orders tab index
              routes: [
                { name: 'Home' },
                { name: 'Gallery' },
                {
                  name: 'Orders',
                  params: { 
                    initialTab: 'drafts',
                    toastMessage,
                  },
                },
                { name: 'Profile' },
              ],
            },
          },
        ],
      });
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
      const order = await persistDraftOrder({
        stepKey: currentStepKey,
        setId: editingSetId,
      });
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
      
      // Check capacity availability before submitting
      const { checkCapacityAvailability, incrementWeeklyOrders, formatNextAvailability } = await import('../services/workloadService');
      const capacityInfo = await checkCapacityAvailability();
      
      let orderStatus = 'Submitted';
      let shouldIncrementCapacity = true;
      
      // If capacity is full, set status to "Awaiting Submission"
      if (capacityInfo.isFull) {
        orderStatus = 'Awaiting Submission';
        shouldIncrementCapacity = false; // Don't increment capacity for awaiting submission orders
      } else if (capacityInfo.available) {
        // Capacity available - increment count when order is submitted
        try {
          await incrementWeeklyOrders();
        } catch (capacityError) {
          console.warn('[NewOrderStepper] Failed to increment capacity, but allowing submission:', capacityError);
          // Continue with submission even if capacity increment fails
        }
      }
      
      // When submitting an order, status is set based on capacity
      const payload = buildOrderPayload(orderStatus);
      const response = await createOrUpdateOrder(payload);
      setDraftOrderId(response.order.id);
      
      // If user wants to save the address, save it to their profile
      if (orderDraft.saveAddress && payload.fulfillment?.address) {
        const address = payload.fulfillment.address;
        // Check if address is complete
        if (address.name && address.line1 && address.city && address.state && address.postalCode) {
          try {
            const { addSavedAddress, getSavedAddresses } = await import('../services/addressService');
            // Get current saved addresses to determine default label if needed
            const currentAddresses = await getSavedAddresses();
            const addressLabel = address.label || `Address ${(currentAddresses?.length || 0) + 1}`;
            await addSavedAddress({
              label: addressLabel,
              name: address.name,
              line1: address.line1,
              line2: address.line2 || null,
              city: address.city,
              state: address.state,
              postalCode: address.postalCode,
              isDefault: false, // Don't set as default automatically
            });
            if (__DEV__) {
              console.log('[NewOrderStepper] Address saved to profile on order submission with label:', addressLabel);
            }
          } catch (error) {
            console.error('[NewOrderStepper] Error saving address on submission:', error);
            // Don't block order submission if address save fails
          }
        }
      }
      
      handleOrderComplete(response.order, 'default');
      logEvent('complete_order', { order_id: response.order.id, variant: 'default', status: orderStatus });
      
      // If order is "Awaiting Submission", navigate to Orders tab with toast message
      if (orderStatus === 'Awaiting Submission') {
        // Calculate number of days until next availability
        let daysUntilNext = 0;
        if (capacityInfo.nextWeekStartDate) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const nextWeek = new Date(capacityInfo.nextWeekStartDate);
          nextWeek.setHours(0, 0, 0, 0);
          daysUntilNext = Math.ceil((nextWeek - today) / (1000 * 60 * 60 * 24));
        }
        
        const toastMessage = `Your order is in Awaiting Submission! Come back in ${daysUntilNext} day${daysUntilNext !== 1 ? 's' : ''} to submit it when availability opens.`;
        
        // Navigate to Orders tab with toast message in params
        navigation.reset({
          index: 0,
          routes: [
            {
              name: 'MainTabs',
              state: {
                index: 2, // Orders tab index
                routes: [
                  { name: 'Home' },
                  { name: 'Gallery' },
                  { name: 'Orders', params: { toastMessage } },
                ],
              },
            },
          ],
        });
      } else {
        // Normal submission - go to confirmation page
        navigation.replace('OrderConfirmation', { order: response.order });
      }
    } catch (err) {
      const message = err?.details?.error || err.message || 'Please try again.';
      Alert.alert('Unable to submit order', message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to ensure an order exists (create draft if needed)
  const ensureOrderExists = async () => {
    // If we already have an order ID, use it
    if (resumeDraft?.id || state.activeOrder?.id || draftOrderId) {
      return resumeDraft?.id || state.activeOrder?.id || draftOrderId;
    }

    // Create a new draft order immediately so we have an order ID for image uploads
    // This minimal payload allows creating a draft order even without nail sets yet
    try {
      const userId = state.currentUser?.id;
      if (!userId) {
        throw new Error('Please log in to create an order.');
      }

      // Build minimal payload - allow empty nail sets for initial draft creation
      // Get fulfillment from orderDraft, or use defaults
      const deliveryDetails = orderDraft.deliveryDetails || createDefaultDeliveryDetails();
      const minimalPayload = {
        id: null, // New order
        userId,
        nailSets: [], // Empty array - will be validated when order is submitted, not when draft is created
        customerSizes: { mode: 'standard', values: {} }, // Default - will be set properly when order is built
        fulfillment: {
          method: deliveryDetails.method || 'pickup',
          speed: deliveryDetails.speed || 'standard',
          address: deliveryDetails.address || null,
          notes: deliveryDetails.notes || null,
        },
        orderNotes: null,
        promoCode: null,
        status: 'Draft',
      };

      const response = await createOrUpdateOrder(minimalPayload);
      const newOrderId = response.order.id;
      setDraftOrderId(newOrderId);
      handleDraftSaved(response.order, {
        currentStepKey: currentStepKey,
        currentSetId: editingSetId,
      });
      return newOrderId;
    } catch (error) {
      console.error('[NewOrderStepper] Failed to create draft order:', error);
      throw new Error('Failed to create order. Please try again.');
    }
  };

  const handleAddDesignUpload = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false, // Don't need base64, use URI for upload
        quality: 0.85,
        maxWidth: 1500,
        selectionLimit: 0, // Allow multiple
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

      // Ensure we have a user ID and order ID before uploading
      const userId = state.currentUser?.id || state.currentUser?.userId;
      if (!userId) {
        Alert.alert('Error', 'Please log in to upload images.');
        return;
      }

      // Ensure order exists (create draft if needed) to get an order ID
      const orderId = await ensureOrderExists();
      const setId = currentSetDraft.id || `set_${Date.now()}`;

      // Upload each image to Supabase Storage immediately
      const uploadPromises = assets.map(async (asset, index) => {
        if (!asset.uri) {
          return null;
        }

        // Create temporary upload object with preview
        const tempUploadId = `upload_${Date.now()}_${index}`;
        const previewUri = asset.uri;
        const tempUpload = {
          id: tempUploadId,
          uri: previewUri,
          fileName: asset.fileName || `design-reference-${index + 1}.jpg`,
          preview: previewUri,
          uploading: true, // Track upload status
          error: null,
        };

        // Add to draft immediately for preview
        setCurrentSetDraft((prev) => ({
          ...prev,
          designUploads: [...(prev.designUploads || []), tempUpload],
        }));

        try {
          // Upload to Storage - use {userId}/{orderId}/... path structure
          const uploadResult = await uploadImageToStorage(
            {
              uri: asset.uri,
              type: asset.type || 'image/jpeg',
              fileName: asset.fileName || `design-reference-${index + 1}.jpg`,
            },
            userId,
            orderId,
            setId,
            'design',
          );

          // Update with Storage URL
          setCurrentSetDraft((prev) => ({
            ...prev,
            designUploads: (prev.designUploads || []).map((upload) =>
              upload.id === tempUploadId
                ? {
                    ...upload,
                    id: tempUploadId,
                    url: uploadResult.url,
                    uri: uploadResult.url, // Use Storage URL for display
                    preview: uploadResult.url,
                    uploading: false,
                    fileName: uploadResult.fileName,
                  }
                : upload,
            ),
          }));

          return {
            id: tempUploadId,
            url: uploadResult.url,
            uri: uploadResult.url,
            fileName: uploadResult.fileName,
            preview: uploadResult.url,
          };
        } catch (error) {
          console.error('[NewOrderStepper] Error uploading design image:', error);
          
          // Mark upload as failed
          setCurrentSetDraft((prev) => ({
            ...prev,
            designUploads: (prev.designUploads || []).map((upload) =>
              upload.id === tempUploadId
                ? {
                    ...upload,
                    uploading: false,
                    error: error.message || 'Upload failed',
                  }
                : upload,
            ),
          }));

          Alert.alert('Upload Error', `Failed to upload image: ${error.message || 'Please try again.'}`);
          return null;
        }
      });

      await Promise.all(uploadPromises);
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

  const handleAddSizingUpload = async () => {
    try {
      const response = await launchImageLibrary({
        mediaType: 'photo',
        includeBase64: false, // Don't need base64, use URI for upload
        quality: 0.85,
        maxWidth: 1500,
        selectionLimit: 0, // Allow multiple
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

      // Ensure we have a user ID and order ID before uploading
      const userId = state.currentUser?.id || state.currentUser?.userId;
      if (!userId) {
        Alert.alert('Error', 'Please log in to upload images.');
        return;
      }

      // Ensure order exists (create draft if needed) to get an order ID
      const orderId = await ensureOrderExists();
      const setId = currentSetDraft.id || `set_${Date.now()}`;

      // Upload each image to Supabase Storage immediately
      const uploadPromises = assets.map(async (asset, index) => {
        if (!asset.uri) {
          return null;
        }

        // Create temporary upload object with preview
        const tempUploadId = `sizing_${Date.now()}_${index}`;
        const previewUri = asset.uri;
        const tempUpload = {
          id: tempUploadId,
          uri: previewUri,
          fileName: asset.fileName || `sizing-reference-${index + 1}.jpg`,
          preview: previewUri,
          uploading: true, // Track upload status
          error: null,
        };

        // Add to draft immediately for preview
        setCurrentSetDraft((prev) => ({
          ...prev,
          sizingUploads: [...(prev.sizingUploads || []), tempUpload],
        }));

        try {
          // Upload to Storage - use {userId}/{orderId}/... path structure
          const uploadResult = await uploadImageToStorage(
            {
              uri: asset.uri,
              type: asset.type || 'image/jpeg',
              fileName: asset.fileName || `sizing-reference-${index + 1}.jpg`,
            },
            userId,
            orderId,
            setId,
            'sizing',
          );

          // Update with Storage URL
          setCurrentSetDraft((prev) => ({
            ...prev,
            sizingUploads: (prev.sizingUploads || []).map((upload) =>
              upload.id === tempUploadId
                ? {
                    ...upload,
                    id: tempUploadId,
                    url: uploadResult.url,
                    uri: uploadResult.url, // Use Storage URL for display
                    preview: uploadResult.url,
                    uploading: false,
                    fileName: uploadResult.fileName,
                  }
                : upload,
            ),
          }));

          return {
            id: tempUploadId,
            url: uploadResult.url,
            uri: uploadResult.url,
            fileName: uploadResult.fileName,
            preview: uploadResult.url,
          };
        } catch (error) {
          console.error('[NewOrderStepper] Error uploading sizing image:', error);
          
          // Mark upload as failed
          setCurrentSetDraft((prev) => ({
            ...prev,
            sizingUploads: (prev.sizingUploads || []).map((upload) =>
              upload.id === tempUploadId
                ? {
                    ...upload,
                    uploading: false,
                    error: error.message || 'Upload failed',
                  }
                : upload,
            ),
          }));

          Alert.alert('Upload Error', `Failed to upload image: ${error.message || 'Please try again.'}`);
          return null;
        }
      });

      await Promise.all(uploadPromises);
    } catch (err) {
      Alert.alert('Upload error', err.message || 'Something went wrong. Please try again.');
    }
  };

  const handleRemoveSizingUpload = (uploadId) => {
    setCurrentSetDraft((prev) => ({
      ...prev,
      sizingUploads: (prev.sizingUploads || []).filter((item) => item.id !== uploadId),
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

  const handleApplyPromoCode = useCallback(async () => {
    const trimmed = promoInputValue.trim().toUpperCase();
    if (!trimmed) {
      return;
    }

    try {
      // Validate the promo code with current order data
      const validationResult = await validatePromoCode(trimmed, {
        nailSets: orderDraft.sets,
        fulfillment: orderDraft.deliveryDetails,
      }, state.currentUser?.id);

      if (!validationResult.valid) {
        // Show error message as toast
        showToast(validationResult.error || 'Promo code not found or expired', 'error');
        return;
      }

      // Promo code is valid - store it with discount info
      setOrderDraft((prev) => ({
        ...prev,
        promoCode: trimmed,
        promoCodeData: validationResult, // Store full validation result
      }));
      setPromoInputVisible(false);
      setPromoInputValue('');

      // Show success message
      setState((prev) => ({
        ...prev,
        statusMessage: `Promo applied — ${validationResult.discountDescription} (${trimmed})`,
      }));
    } catch (error) {
      console.error('[NewOrderStepper] Error validating promo code:', error);
      showToast('Unable to validate promo code. Please try again.', 'error');
    }
  }, [promoInputValue, orderDraft.sets, orderDraft.deliveryDetails, state.currentUser?.id, showToast]);

  const handleClearPromoCode = useCallback(() => {
    setOrderDraft((prev) => ({
      ...prev,
      promoCode: '',
      promoCodeData: null, // Clear promo code data
    }));
    setPromoInputVisible(false);
    setPromoInputValue('');
  }, []);

  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('default'); // 'default', 'error', 'success'
  const toastTimerRef = useRef(null);

  const computeSetPricing = useCallback(
    (setDraft) => {
      const pricing = calculatePriceBreakdownSync({
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

    // Validate sizing step: require saved profile OR all finger sizes OR sizing help
    if (currentSetDraft.sizeMode === 'perSet') {
      const hasSavedProfile = currentSetDraft.selectedSizingOption === 'saved' && currentSetDraft.selectedProfileId;
      
      // Check if using manual entry (not camera anymore)
      const isManualEntry = currentSetDraft.selectedSizingOption === 'manual' || 
                           (currentSetDraft.selectedSizingOption === 'camera' && !currentSetDraft.sizingUploads?.length);
      
      if (isManualEntry && !currentSetDraft.requiresSizingHelp) {
        // Check if all finger sizes are entered
        const sizes = currentSetDraft.sizes?.values || currentSetDraft.sizes || {};
        const hasAllSizes = FINGER_KEYS.every((finger) => {
          const value = sizes[finger];
          return value !== undefined && value !== null && String(value).trim().length > 0;
        });
        
        if (!hasAllSizes && !hasSavedProfile) {
          setError('Please select a saved nail size, enter sizes for all fingers, or toggle "Need sizing help?" before saving.');
          return false;
        }
      }
      
      // Legacy camera validation (for backward compatibility with old data)
      if (currentSetDraft.selectedSizingOption === 'camera') {
        const hasSizingPhotos =
          Array.isArray(currentSetDraft.sizingUploads) && currentSetDraft.sizingUploads.length > 0;
        // Check for sizing help specifically (not design help)
        if (!hasSizingPhotos && !currentSetDraft.requiresSizingHelp) {
          setError('Add at least one sizing photo or toggle "Need sizing help?" to continue.');
          return false;
        }
      }
    }

    setError(null);
    return true;
  }, [currentSetDraft]);

  const handleSaveCurrentSet = useCallback(() => {
    if (!validateCurrentSet()) {
      setStepErrors((prev) => ({ ...prev, size: true }));
      return;
    }
    
    // If user selected manual entry with save-as-default checkbox checked, save as default
    const shouldSaveAsDefault = saveAsDefault || currentSetDraft.saveAsDefault;
    if (shouldSaveAsDefault && currentSetDraft.selectedSizingOption === 'manual') {
      const sizes = currentSetDraft.sizes?.values || currentSetDraft.sizes || {};
      const hasAllSizes = FINGER_KEYS.every((finger) => {
        const value = sizes[finger];
        return value !== undefined && value !== null && String(value).trim().length > 0;
      });
      
      if (hasAllSizes) {
        // Save as default when user clicks Save
        handleSaveDefaultSizes(sizes, true).catch((error) => {
          console.error('[NewOrderStepper] Failed to save default sizes:', error);
          // Don't block the save if default saving fails
        });
        // Reset checkbox after saving (so it doesn't persist to next set)
        setSaveAsDefault(false);
      }
    }
    
    setStepErrors((prev) => ({ ...prev, size: false }));
    const pricing = computeSetPricing(currentSetDraft);
    const setId = editingSetId || currentSetDraft.id || `set_${Date.now()}`;
    const preparedUploads = (currentSetDraft.designUploads || []).map((upload, index) => ({
      ...upload,
      id: upload.id || `upload_${setId}_${index}`,
    }));
    const preparedSizingUploads = (currentSetDraft.sizingUploads || []).map((upload, index) => ({
      ...upload,
      id: upload.id || `sizing_${setId}_${index}`,
      preview: upload.preview || resolveUploadPreview(upload),
    }));

    const setToSave = {
      ...currentSetDraft,
      id: setId,
      designUploads: preparedUploads,
      sizingUploads: preparedSizingUploads,
      selectedSizingOption: currentSetDraft.selectedSizingOption || null,
      selectedProfileId: currentSetDraft.selectedProfileId || null,
      saveAsDefault: currentSetDraft.saveAsDefault || false, // Persist checkbox state
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
    setStepErrors((prev) => ({ ...prev, summary: false }));
    setCurrentStep(3);
  }, [computeSetPricing, currentSetDraft, editingSetId, validateCurrentSet]);

  const handleEditSet = useCallback(
    (setId) => {
      const target = orderDraft.sets.find((set) => set.id === setId);
      if (!target) {
        return;
      }
      
      // If the set uses saved sizing but doesn't have selectedProfileId, try to get it from order-level customerSizes
      // This handles the case where the profile ID is stored at the order level in customerSizes
      // Note: saved sizing can be used with either 'standard' or 'perSet' sizeMode
      let profileId = target.selectedProfileId;
      if (!profileId && target.selectedSizingOption === 'saved') {
        // Try to get from order-level customerSizes (stored in orderDraft or resumeDraft)
        if (__DEV__) {
          console.log('[NewOrderStepper] handleEditSet - set uses saved sizing but no profileId in set, checking customerSizes:', {
            setId,
            selectedSizingOption: target.selectedSizingOption,
            sizeMode: target.sizeMode,
            orderDraftCustomerSizes: orderDraft.customerSizes,
            hasResumeDraft: !!resumeDraft,
            resumeDraftCustomerSizes: resumeDraft?.customerSizes,
          });
        }
        // Try to get from orderDraft.customerSizes first (if we stored it there)
        if (orderDraft.customerSizes?.profileId) {
          profileId = orderDraft.customerSizes.profileId;
          if (__DEV__) {
            console.log('[NewOrderStepper] handleEditSet - found profileId in orderDraft.customerSizes:', profileId);
          }
        } else if (resumeDraft?.customerSizes?.profileId) {
          // Fall back to resumeDraft if available
          profileId = resumeDraft.customerSizes.profileId;
          if (__DEV__) {
            console.log('[NewOrderStepper] handleEditSet - found profileId in resumeDraft.customerSizes:', profileId);
          }
        }
      }
      
      if (__DEV__) {
        console.log('[NewOrderStepper] handleEditSet - restoring set:', {
          setId,
          targetSelectedProfileId: target.selectedProfileId,
          finalSelectedProfileId: profileId || target.selectedProfileId,
          selectedSizingOption: target.selectedSizingOption,
          sizeMode: target.sizeMode,
        });
      }
      
      setEditingSetId(setId);
      setCurrentSetDraft({
        ...target,
        // Ensure uploads have proper format for display (with uri/preview)
        designUploads: (target.designUploads || []).map((upload) => {
          const base64Data = upload.data || upload.base64 || upload.content || null;
          const preview = resolveUploadPreview(upload);
          return {
            ...upload,
            // Ensure base64 data is preserved
            base64: base64Data,
            data: base64Data,
            // Ensure uri is set for display (React Native Image component needs uri)
            uri: upload.uri || preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
            preview: preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
          };
        }),
        sizingUploads: (target.sizingUploads || []).map((upload) => {
          const base64Data = upload.data || upload.base64 || upload.content || null;
          const preview = resolveUploadPreview(upload);
          return {
            ...upload,
            // Ensure base64 data is preserved
            base64: base64Data,
            data: base64Data,
            // Ensure uri is set for display (React Native Image component needs uri)
            uri: upload.uri || preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
            preview: preview || (base64Data ? `data:image/jpeg;base64,${base64Data}` : null),
          };
        }),
        // Preserve help flags correctly
        requiresDesignHelp: target.requiresDesignHelp !== null && target.requiresDesignHelp !== undefined
          ? Boolean(target.requiresDesignHelp)
          : Boolean(target.requiresFollowUp),
        requiresSizingHelp: target.requiresSizingHelp !== null && target.requiresSizingHelp !== undefined
          ? Boolean(target.requiresSizingHelp)
          : false,
        // Update requiresFollowUp for backward compatibility
        requiresFollowUp: Boolean(target.requiresDesignHelp || target.requiresSizingHelp || target.requiresFollowUp),
        selectedSizingOption: target.selectedSizingOption || null,
        selectedProfileId: profileId || target.selectedProfileId || null,
        saveAsDefault: Boolean(target.saveAsDefault), // Restore checkbox state
      });
      // Restore saveAsDefault state when editing
      setSaveAsDefault(Boolean(target.saveAsDefault));
      setCurrentStep(0);
    },
    [orderDraft.sets, orderDraft.customerSizes, resumeDraft],
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

  const showToast = useCallback((message, type = 'default') => {
    setToastMessage(message);
    setToastType(type);
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
                requiresDesignHelp={currentSetDraft.requiresDesignHelp}
                onAddUpload={handleAddDesignUpload}
                onChangeDescription={(designDescription) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  designDescription,
                }))
                }
                onRemoveUpload={handleRemoveDesignUpload}
                onToggleDesignHelp={(requiresDesignHelp) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  requiresDesignHelp,
                  // Update requiresFollowUp for backward compatibility (derived from both help flags)
                  requiresFollowUp: requiresDesignHelp || prev.requiresSizingHelp,
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
                sizes={currentSetDraft.sizes?.values || currentSetDraft.sizes || {}}
                savedSizeProfiles={savedSizeProfiles}
                sizingUploads={currentSetDraft.sizingUploads}
                onAddSizingUpload={handleAddSizingUpload}
                onRemoveSizingUpload={handleRemoveSizingUpload}
                requiresSizingHelp={currentSetDraft.requiresSizingHelp}
                selectedSizingOption={currentSetDraft.selectedSizingOption}
                selectedProfileId={currentSetDraft.selectedProfileId}
                hasDefaultSizes={hasDefaultSizes}
                onSaveDefaultSizes={handleSaveDefaultSizes}
                saveAsDefault={currentSetDraft.saveAsDefault || saveAsDefault}
                onSaveAsDefaultChange={(value) => {
                  setSaveAsDefault(value);
                  // Also persist in currentSetDraft
                  setCurrentSetDraft((prev) => ({ ...prev, saveAsDefault: value }));
                }}
                // Add debug logging
                key={`sizing-${currentSetDraft.id || 'new'}-${currentSetDraft.selectedProfileId || 'none'}`}
                // Log when SizingStep receives props
                {...(__DEV__ && {
                  _debugProps: () => {
                    console.log('[NewOrderStepper] SizingStep props:', {
                      selectedProfileId: currentSetDraft.selectedProfileId,
                      selectedSizingOption: currentSetDraft.selectedSizingOption,
                      sizeMode: currentSetDraft.sizeMode,
                      editingSetId,
                    });
                  },
                })}
                onSelectSizeMode={(sizeMode) =>
                setCurrentSetDraft((prev) => ({
                  ...prev,
                  sizeMode,
                }))
                }
                onChangeSizes={(sizes) =>
                setCurrentSetDraft((prev) => {
                  const currentSizes = prev.sizes?.values || prev.sizes || {};
                  return {
                    ...prev,
                    sizes: { ...prev.sizes, ...currentSizes, ...sizes },
                    // Ensure sizes structure has values property for perSet mode
                    ...(prev.sizeMode === 'perSet' && {
                      sizes: {
                        mode: 'perSet',
                        values: { ...currentSizes, ...sizes },
                      },
                    }),
                  };
                })
                }
                onMarkSizingHelp={(value) =>
                    setCurrentSetDraft((prev) => ({
                      ...prev,
                      requiresSizingHelp: Boolean(value),
                      // Update requiresFollowUp for backward compatibility (derived from both help flags)
                      requiresFollowUp: prev.requiresDesignHelp || Boolean(value),
                    }))
                  }
                onChangeSizingOption={(option) =>
                  setCurrentSetDraft((prev) => ({
                    ...prev,
                    selectedSizingOption: option,
                  }))
                }
                onSelectProfile={(profileId) => {
                  if (__DEV__) {
                    console.log('[NewOrderStepper] Profile selected, updating currentSetDraft:', profileId);
                  }
                  setCurrentSetDraft((prev) => {
                    const updated = {
                      ...prev,
                      selectedProfileId: profileId,
                    };
                    if (__DEV__) {
                      console.log('[NewOrderStepper] Updated currentSetDraft.selectedProfileId:', updated.selectedProfileId);
                    }
                    return updated;
                  });
                }}
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
              deliveryMethods={deliveryMethods || getDeliveryMethodsSync()}
              onChangeMethod={(method) =>
                setOrderDraft((prev) => {
                  const methods = deliveryMethods || getDeliveryMethodsSync();
                  return {
                    ...prev,
                    deliveryDetails: {
                      ...prev.deliveryDetails,
                      method,
                      speed: methods[method]?.defaultSpeed || 'standard',
                    },
                  };
                })
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
              saveAddress={orderDraft.saveAddress}
              onSaveAddressChange={(value) =>
                setOrderDraft((prev) => ({
                  ...prev,
                  saveAddress: value,
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
            deliveryMethods={deliveryMethods || getDeliveryMethodsSync()}
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
            capacityInfo={capacityInfo}
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

      {/* Toast notification */}
      {toastMessage ? (
        <View
          style={[
            styles.toastContainer,
            {
              backgroundColor: toastType === 'error' 
                ? withOpacity(warningColor || '#C27A3B', 0.95)
                : withOpacity(accent || '#6F171F', 0.95),
              shadowColor: shadow || '#000000',
              bottom: 80 + Math.max(insets.bottom, 0),
            },
          ]}
        >
          <Text style={[styles.toastText, { color: accentContrast || '#FFFFFF', flex: 1 }]}>
            {toastMessage}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setToastMessage(null);
              setToastType('default');
            }}
            style={styles.toastCloseButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.toastCloseText, { color: accentContrast || '#FFFFFF' }]}>
              ×
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function ShapeStep({ colors, shapes, selectedShapeId, onSelect, loading }) {
  const {
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    primaryFont = '#220707',
    onSurface = primaryFont, // Use onSurface for text on surface backgrounds
    secondaryFont = '#5C5F5D',
  } = colors || {};

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={accent} />
      </View>
    );
  }

  if (!shapes || shapes.length === 0) {
    return (
      <View style={styles.loader}>
        <Text style={[{ color: onSurface, textAlign: 'center' }]}>
          No shapes available. Please check your connection and try again.
        </Text>
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
            {shape.image_url || shape.imageUrl ? (
              <Image
                source={{ uri: shape.image_url || shape.imageUrl }}
                style={styles.shapeImage}
                resizeMode="cover"
              />
            ) : null}
            <Text
              style={[
                styles.shapeName,
                { color: onSurface },
              ]}
            >
              {shape.name || 'Unnamed Shape'}
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
  requiresDesignHelp,
  onAddUpload,
  onChangeDescription,
  onRemoveUpload,
  onToggleDesignHelp,
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
  const [previewUpload, setPreviewUpload] = useState(null);

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
              const openPreview = () => {
                if (!previewUri) {
                  return;
                }
                setPreviewUpload({
                  uri: previewUri,
                  name: upload.fileName || 'Inspiration image',
                });
              };
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
                  <TouchableOpacity
                    style={styles.designUploadThumbnailFrame}
                    onPress={openPreview}
                    disabled={!imageSource || upload.uploading}
                    activeOpacity={0.85}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={
                      imageSource ? `Preview ${upload.fileName || 'inspiration image'}` : 'Preview unavailable'
                    }
                  >
                    {imageSource ? (
                      <>
                        <Image source={imageSource} style={styles.designUploadImage} resizeMode="cover" />
                        {upload.uploading && (
                          <View style={styles.uploadOverlay}>
                            <ActivityIndicator color={accent} size="small" />
                            <Text style={[styles.uploadOverlayText, { color: surface }]}>Uploading...</Text>
                          </View>
                        )}
                        {upload.error && !upload.uploading && (
                          <View style={[styles.uploadOverlay, { backgroundColor: 'rgba(255, 0, 0, 0.8)' }]}>
                            <Icon name="close" color={surface} size={16} />
                            <Text style={[styles.uploadOverlayText, { color: surface }]}>Failed</Text>
                          </View>
                        )}
                      </>
                    ) : (
                      <View
                        style={[
                          styles.designUploadEmpty,
                          { backgroundColor: withOpacity(secondaryBackground, 0.35) },
                        ]}
                      >
                        {upload.uploading ? (
                          <ActivityIndicator color={accent} size="small" />
                        ) : (
                          <>
                            <Icon name="image" color={withOpacity(primaryFont, 0.4)} size={18} />
                            <Text
                              style={[
                                styles.designUploadEmptyText,
                                { color: primaryFont },
                              ]}
                            >
                              No preview
                            </Text>
                          </>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
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
                backgroundColor: withOpacity(surface, 0.6),//withOpacity(surfaceMuted, 0.75),
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
              backgroundColor: withOpacity(surface, 0.6),//withOpacity(surfaceMuted, 0.45),
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
          value={requiresDesignHelp}
          onValueChange={onToggleDesignHelp}
          trackColor={{
            false: withOpacity(border, 0.6),
            true: withOpacity(accent, 0.4),
          }}
          thumbColor={requiresDesignHelp ? accent : surface}
          ios_backgroundColor={withOpacity(border, 0.6)}
        />
      </View>
      <ImagePreviewModal
        preview={previewUpload}
        onClose={() => setPreviewUpload(null)}
        colors={{ surface, border, primaryFont, secondaryFont }}
      />
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
            const sizeDetails = getSetSizeDetails(set);
            const sizeText = sizeDetails.entries?.length
              ? sizeDetails.entries
                  .map((entry) => `${entry.label}: ${entry.value}`)
                  .join(' · ')
              : sizeDetails.fallback || null;
            const isPhotoSizing = resolveSizingOptionFromSet(set) === 'camera';

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
                      <View style={styles.summaryDetailRow}>
                        <Text
                          style={[
                            styles.summaryDetailLabel,
                            { color: withOpacity(primaryFont, 0.7) },
                          ]}
                        >
                          Description
                        </Text>
                        <Text
                          style={[
                            styles.summaryDetailValue,
                            { color: secondaryFont },
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {set.designDescription}
                        </Text>
                      </View>
                    ) : null}
                    {isPhotoSizing || sizeText ? (
                      <View style={styles.summaryDetailRow}>
                        <Text
                          style={[
                            styles.summaryDetailLabel,
                            {
                              color: withOpacity(primaryFont, 0.7),
                              fontWeight: sizeDetails?.requiresSizingHelp ? '700' : '600',
                            },
                          ]}
                        >
                          Nail sizes
                        </Text>
                        <Text
                          style={[
                            styles.summaryDetailValue,
                            { color: sizeDetails?.requiresSizingHelp ? accent : secondaryFont },
                          ]}
                        >
                          {sizeDetails?.requiresSizingHelp
                            ? 'Need sizing assistance'
                            : isPhotoSizing
                            ? 'Photos provided'
                            : sizeText}
                        </Text>
                      </View>
                    ) : null}
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

function SizingStep({
  colors,
  sizeMode,
  sizes,
  onSelectSizeMode,
  onChangeSizes,
  savedSizeProfiles,
  sizingUploads,
  onAddSizingUpload,
  onRemoveSizingUpload,
  requiresSizingHelp,
  onMarkSizingHelp,
  selectedSizingOption,
  onChangeSizingOption,
  selectedProfileId,
  onSelectProfile,
  hasDefaultSizes = false,
  onSaveDefaultSizes,
  saveAsDefault = false,
  onSaveAsDefaultChange,
  _debugProps,
}) {
  // Log props when component receives them
  useEffect(() => {
    if (__DEV__) {
      console.log('[SizingStep] Component received props:', {
        selectedProfileId,
        selectedSizingOption,
        sizeMode,
      });
      if (_debugProps) {
        _debugProps();
      }
    }
  }, [selectedProfileId, selectedSizingOption, sizeMode, _debugProps]);

  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    surfaceMuted = '#F6EFE8',
    secondaryBackground = '#BF9B7A',
    shadow = '#000000',
  } = colors || {};

  const savedProfileOptions = useMemo(() => {
    if (!Array.isArray(savedSizeProfiles) || !savedSizeProfiles.length) {
      return [];
    }

    return savedSizeProfiles
      .map((profile, index) => {
        const normalizedSizes = { ...DEFAULT_SIZES, ...(profile?.sizes || {}) };
        const hasValues = FINGER_KEYS.some((finger) => {
          const value = normalizedSizes[finger];
          return value !== undefined && value !== null && String(value).trim().length > 0;
        });

        if (!hasValues) {
          return null;
        }

        return {
          id: profile?.id || (profile?.isDefault ? 'default' : `profile_${index}`),
          label:
            typeof profile?.label === 'string' && profile.label.trim().length
              ? profile.label.trim()
              : profile?.isDefault
              ? 'Default nail size'
              : `Size profile ${index + 1}`,
          sizes: normalizedSizes,
          isDefault: Boolean(profile?.isDefault),
        };
      })
      .filter(Boolean);
  }, [savedSizeProfiles]);

  const hasSavedProfiles = savedProfileOptions.length > 0;

  // Check if user has default sizes - only check the prop, not savedProfileOptions
  // The prop already checks if defaultProfile exists with valid sizes
  const userHasDefaultSizes = hasDefaultSizes;

  const computedSelectedOption = useMemo(() => {
    if (selectedSizingOption) {
      // If 'camera' was selected, map to 'manual' instead (camera option is hidden)
      if (selectedSizingOption === 'camera') {
        return 'manual';
      }
      if (selectedSizingOption === 'saved' && !hasSavedProfiles) {
        return 'manual';
      }
      return selectedSizingOption;
    }

    return hasSavedProfiles ? 'saved' : 'manual';
  }, [selectedSizingOption, hasSavedProfiles]);

  useEffect(() => {
    if (!selectedSizingOption) {
      const defaultOption = hasSavedProfiles ? 'saved' : 'manual';
      onChangeSizingOption?.(defaultOption);
      return;
    }

    if (selectedSizingOption === 'saved' && !hasSavedProfiles) {
      onChangeSizingOption?.('manual');
    }
    
    // Map old 'camera' to 'manual'
    if (selectedSizingOption === 'camera') {
      onChangeSizingOption?.('manual');
    }
  }, [selectedSizingOption, hasSavedProfiles, onChangeSizingOption]);

  useEffect(() => {
    // Ensure perSet mode for manual entry and saved profiles
    if (['saved', 'manual'].includes(computedSelectedOption) && sizeMode !== 'perSet') {
      onSelectSizeMode('perSet');
    }
  }, [computedSelectedOption, sizeMode, onSelectSizeMode]);

  // saveAsDefault is now managed by parent component - no need for useEffect here

  // Initialize activeProfileId from selectedProfileId prop if available, otherwise use first profile
  const [activeProfileId, setActiveProfileId] = useState(() => {
    // At initialization, savedProfileOptions might be empty, so we'll set it in useEffect
    return null;
  });

  useEffect(() => {
    if (__DEV__) {
      console.log('[SizingStep] Profile selection effect:', {
        hasSavedProfiles,
        selectedProfileId,
        savedProfileOptionsCount: savedProfileOptions.length,
        savedProfileIds: savedProfileOptions.map((p) => p.id),
        currentActiveProfileId: activeProfileId,
      });
    }

    if (!hasSavedProfiles) {
      setActiveProfileId(null);
      return;
    }

    // If selectedProfileId prop is provided and valid, use it (this is the saved profile from the draft)
    // This takes priority over the current activeProfileId
    if (selectedProfileId) {
      const profileExists = savedProfileOptions.some((profile) => profile.id === selectedProfileId);
      if (profileExists) {
        // Only update if it's different from current activeProfileId
        if (activeProfileId !== selectedProfileId) {
          if (__DEV__) {
            console.log('[SizingStep] ✅ Restoring saved profile:', selectedProfileId);
          }
          setActiveProfileId(selectedProfileId);
        }
        return; // Don't fall through to default logic
      } else {
        if (__DEV__) {
          console.warn('[SizingStep] ⚠️  Saved profile ID not found in options:', selectedProfileId);
        }
        // If selectedProfileId is provided but not found, don't reset - keep current selection
        return;
      }
    }

    // If no selectedProfileId prop, only set default if we don't have a valid activeProfileId
    // This prevents the effect from overriding a user's manual selection
    setActiveProfileId((prev) => {
      // If we already have a valid selection, keep it
      if (prev && savedProfileOptions.some((profile) => profile.id === prev)) {
        return prev;
      }
      // No valid selection, use first profile as default
      const firstProfileId = savedProfileOptions[0]?.id || null;
      if (__DEV__) {
        console.log('[SizingStep] Using first profile as default:', firstProfileId);
      }
      return firstProfileId;
    });
  }, [hasSavedProfiles, savedProfileOptions, selectedProfileId]); // Removed activeProfileId from deps to prevent reset loop

  const activeProfile = useMemo(
    () =>
      activeProfileId
        ? savedProfileOptions.find((profile) => profile.id === activeProfileId) || null
        : null,
    [activeProfileId, savedProfileOptions],
  );

  useEffect(() => {
    if (computedSelectedOption !== 'saved') {
      return;
    }

    // If we have a selectedProfileId prop, use that profile (from draft/order)
    // Otherwise, use the activeProfile (from UI selection)
    const profileToApply = selectedProfileId
      ? savedProfileOptions.find((p) => p.id === selectedProfileId) || activeProfile
      : activeProfile;
    
    if (!profileToApply) {
      return;
    }

    const sanitized = FINGER_KEYS.reduce((acc, finger) => {
      const value = profileToApply.sizes?.[finger];
      acc[finger] = value === undefined || value === null ? '' : String(value);
      return acc;
    }, {});

    const matchesCurrent = FINGER_KEYS.every((finger) => {
      const currentRaw = sizes?.[finger];
      const currentValue =
        currentRaw === undefined || currentRaw === null ? '' : String(currentRaw);
      return currentValue === sanitized[finger];
    });

    // Only update sizes if they don't match
    // If we have a selectedProfileId, the sizes should match that profile
    // If we don't have a selectedProfileId, apply the active profile's sizes
    if (!matchesCurrent) {
      if (__DEV__) {
        console.log('[SizingStep] Applying profile sizes:', profileToApply.id, {
          hasSelectedProfileId: !!selectedProfileId,
          activeProfileId,
        });
      }
      onChangeSizes(sanitized);
    } else {
      if (__DEV__) {
        console.log('[SizingStep] Sizes already match profile, skipping update:', profileToApply.id);
      }
    }
  }, [computedSelectedOption, activeProfile, savedProfileOptions, onChangeSizes, sizes, selectedProfileId, activeProfileId]);

  const handleSelectSaved = useCallback(() => {
    if (!hasSavedProfiles) {
      return;
    }

    // Use the currently active profile if available, otherwise use the first one
    // But if selectedProfileId is provided (from draft), use that profile instead
    const profileToUse = selectedProfileId
      ? savedProfileOptions.find((p) => p.id === selectedProfileId) || activeProfile || savedProfileOptions[0]
      : activeProfile || savedProfileOptions[0];
    
    if (profileToUse) {
      if (__DEV__) {
        console.log('[SizingStep] handleSelectSaved - using profile:', profileToUse.id, profileToUse.label);
      }
      setActiveProfileId(profileToUse.id);
      onSelectProfile?.(profileToUse.id); // Save the selected profile ID
    }
    onChangeSizingOption?.('saved');
  }, [hasSavedProfiles, activeProfile, savedProfileOptions, onChangeSizingOption, onSelectProfile, selectedProfileId]);

  // Camera option is hidden but function kept for backward compatibility
  // const handleCameraSelect = useCallback(() => {
  //   onChangeSizingOption?.('camera');
  //   onSelectSizeMode('perSet');
  // }, [onSelectSizeMode, onChangeSizingOption]);

  const handleManualSelect = useCallback(() => {
    onChangeSizingOption?.('manual');
    onSelectSizeMode('perSet');
    // Only clear sizes if we're switching FROM a saved profile (or starting fresh)
    // If we're editing a draft that already has manual sizes, preserve them
    // Check if current option is 'saved' or null/undefined (new order)
    if (selectedSizingOption !== 'manual') {
      // Clear sizes when switching to manual entry so inputs start blank
      onChangeSizes({ ...DEFAULT_SIZES });
    }
    // If selectedSizingOption is already 'manual', sizes should already be preserved from the draft
  }, [onSelectSizeMode, onChangeSizingOption, onChangeSizes, selectedSizingOption]);

  const handleSizeChange = useCallback((finger, value) => {
    // Only allow numeric input
    const numericValue = value.replace(/[^0-9.]/g, '');
    onChangeSizes({
      ...sizes,
      [finger]: numericValue,
    });
  }, [sizes, onChangeSizes]);

  const activeProfileEntries = useMemo(() => {
    if (!activeProfile) {
      return [];
    }

    return FINGER_KEYS.map((finger) => {
      const raw = activeProfile.sizes?.[finger];
      const value = raw === undefined || raw === null ? '' : String(raw).trim();
      return {
        finger,
        label: FINGER_LABELS[finger] || finger,
        value: value.length ? value : '—',
      };
    });
  }, [activeProfile]);

  const sizingUploadList = Array.isArray(sizingUploads) ? sizingUploads : [];
  const hasSizingUploads = sizingUploadList.length > 0;
  const [previewUpload, setPreviewUpload] = useState(null);

  // Always show manual entry option, and saved size option if available
  const optionDefinitions = useMemo(
    () => [
      ...(hasSavedProfiles
        ? [
            {
              key: 'saved',
              label: 'Use your saved size',
              onPress: handleSelectSaved,
            },
          ]
        : []),
      {
        key: 'manual',
        label: 'Enter your nail sizes',
        onPress: handleManualSelect,
      },
      // Camera option hidden per requirements - code preserved for future use
      // {
      //   key: 'camera',
      //   label: 'Take a photo to measure',
      //   onPress: handleCameraSelect,
      // },
    ],
    [hasSavedProfiles, handleSelectSaved, handleManualSelect],
  );

  return (
    <View style={styles.sizingContainer}>
      <View style={styles.sizingOptionRow}>
        {optionDefinitions.map((option) => (
          <TouchableOpacity
            key={option.key}
            onPress={option.onPress}
            style={[
              styles.sizingOptionButton,
              {
                borderColor: computedSelectedOption === option.key ? accent : withOpacity(border, 0.6),
                backgroundColor: computedSelectedOption === option.key ? withOpacity(accent, 0.08) : surface,
                shadowColor: shadow,
              },
            ]}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.sizingOptionLabel,
                { color: computedSelectedOption === option.key ? accent : primaryFont },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Camera option UI hidden per requirements - code preserved for future re-enablement */}
      {/* {computedSelectedOption === 'camera' ? (
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
                Let&apos;s get the right fit!
              </Text>
              <Text
                style={[
                  styles.designUploadHint,
                  { color: secondaryFont },
                ]}
              >
                Take clear photos so we can size your nails accurately.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onAddSizingUpload}
              accessibilityRole="button"
              disabled={!onAddSizingUpload}
              style={[
                styles.designUploadAction,
                {
                  borderColor: withOpacity(accent, 0.35),
                  backgroundColor: withOpacity(accent, 0.08),
                  opacity: onAddSizingUpload ? 1 : 0.5,
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

          <View style={styles.sizingInstructionList}>
            <Text style={[styles.sizingInstructionItem, { color: secondaryFont }]}>• Place your hand on a flat surface with a quarter above</Text>
            <Text style={[styles.sizingInstructionItem, { color: secondaryFont }]}>• Make sure the quarter is visible in every photo — one of your full hand, then one per finger</Text>
          </View>
          <Text style={[styles.sizingActionHint, { color: withOpacity(primaryFont, 0.7) }]}>Please keep personal info out of the photo frame</Text>

          {hasSizingUploads ? (
            <View style={styles.designUploadGrid}>
              {sizingUploadList.map((upload) => {
                const previewUri = resolveUploadPreview(upload);
                const imageSource = previewUri ? { uri: previewUri } : null;
                const openPreview = () => {
                  if (!previewUri) {
                    return;
                  }
                  setPreviewUpload({
                    uri: previewUri,
                    name: upload.fileName || 'Sizing photo',
                  });
                };
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
                    <TouchableOpacity
                      style={styles.designUploadThumbnailFrame}
                      onPress={openPreview}
                      disabled={!imageSource}
                      activeOpacity={0.85}
                      accessibilityRole="imagebutton"
                      accessibilityLabel={
                        imageSource ? `Preview ${upload.fileName || 'sizing photo'}` : 'Preview unavailable'
                      }
                    >
                      {imageSource ? (
                        <Image source={imageSource} style={styles.designUploadImage} resizeMode="cover" />
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
                    </TouchableOpacity>
                    <View style={styles.designUploadMeta}>
                      <Text
                        style={[
                          styles.designUploadName,
                          { color: primaryFont },
                        ]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {upload.fileName || 'Sizing photo'}
                      </Text>
                      <TouchableOpacity onPress={() => onRemoveSizingUpload?.(upload.id)}>
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
      ) : null} */}

      {/* Per-finger manual entry */}
      {computedSelectedOption === 'manual' ? (
        <View
          style={[
            styles.sizingInlineCard,
            {
              borderColor: withOpacity(border, 0.5),
              backgroundColor: surface,
              shadowColor: shadow,
            },
          ]}
        >
          <Text style={[styles.sizingInlineTitle, { color: primaryFont }]}>Enter your nail sizes</Text>
          <Text style={[styles.sizingInlineCopy, { color: secondaryFont }]}>Enter a size for each finger (numeric values only)</Text>
          
          <View style={styles.manualSizeInputRow}>
            {FINGER_KEYS.map((finger) => (
              <View key={finger} style={styles.manualSizeInputColumn}>
                <Text
                  style={[styles.manualSizeInputLabel, { color: secondaryFont }]}
                  accessibilityLabel={`${FINGER_LABELS[finger]} finger size`}
                >
                  {FINGER_LABELS[finger]}
                </Text>
                <TextInput
                  style={[
                    styles.manualSizeInput,
                    {
                      borderColor: withOpacity(border, 0.6),
                      backgroundColor: withOpacity(surface, 0.6),//surfaceMuted,
                      color: primaryFont,
                    },
                  ]}
                  value={String(sizes?.[finger] || '')}
                  onChangeText={(value) => handleSizeChange(finger, value)}
                  placeholder="7"
                  placeholderTextColor={withOpacity(secondaryFont, 0.5)}
                  keyboardType="numeric"
                  accessibilityLabel={`${FINGER_LABELS[finger]} finger size input`}
                  accessibilityHint={`Enter the nail size for your ${FINGER_LABELS[finger].toLowerCase()} finger`}
                />
              </View>
            ))}
          </View>

          {/* Save as default checkbox - only show if user doesn't have defaults */}
          {!userHasDefaultSizes && onSaveDefaultSizes ? (
            <View style={styles.saveAsDefaultRow}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => {
                  // Notify parent of checkbox state change (but don't save yet - parent will save on Save button)
                  onSaveAsDefaultChange?.(!saveAsDefault);
                }}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: saveAsDefault }}
                accessibilityLabel="Save these nail sizes as my default"
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: saveAsDefault ? accent : withOpacity(border, 0.6),
                      backgroundColor: saveAsDefault ? accent : surface,
                    },
                  ]}
                >
                  {saveAsDefault ? (
                    <Icon name="check" color={surface} size={14} />
                  ) : null}
                </View>
                <Text style={[styles.checkboxLabel, { color: primaryFont }]}>
                  Save these nail sizes as my default
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      ) : null}

      {computedSelectedOption === 'saved' && hasSavedProfiles ? (
        <View
          style={[
            styles.sizingInlineCard,
            {
              borderColor: withOpacity(border, 0.5),
              backgroundColor: surface,
              shadowColor: shadow,
            },
          ]}
        >
          <View style={styles.savedProfileHeader}>
            <Text style={[styles.sizingInlineTitle, { color: primaryFont }]}>Saved Nail Sizes</Text>
            {activeProfile?.label && activeProfile.label !== 'Default nail size' && activeProfile.label !== 'Saved Nail Sizes' ? (
              <Text style={[styles.savedProfileSubtitle, { color: secondaryFont }]}>{activeProfile.label}</Text>
            ) : null}
          </View>
          
          {/* Helper text about updating saved sizes */}
          <Text style={[styles.sizingHelperText, { color: secondaryFont }]}>
            To update your saved sizes, go to Profiles → Nail Sizes
          </Text>

          {savedProfileOptions.length > 1 ? (
            <View style={styles.savedProfileSwitcher}>
              {savedProfileOptions.map((profile) => {
                const isActive = profile.id === activeProfileId;
                return (
                  <TouchableOpacity
                    key={profile.id}
                    onPress={() => {
                      if (__DEV__) {
                        console.log('[SizingStep] Profile chip clicked:', profile.id, profile.label);
                      }
                      setActiveProfileId(profile.id);
                      onSelectProfile?.(profile.id); // Save the selected profile ID
                      // Also update sizes to match the selected profile
                      const sanitized = FINGER_KEYS.reduce((acc, finger) => {
                        const value = profile.sizes?.[finger];
                        acc[finger] = value === undefined || value === null ? '' : String(value);
                        return acc;
                      }, {});
                      onChangeSizes?.(sanitized);
                      onChangeSizingOption?.('saved');
                    }}
                    accessibilityRole="button"
                    style={[
                      styles.savedProfileChip,
                      {
                        borderColor: isActive ? accent : withOpacity(border, 0.6),
                        backgroundColor: isActive ? withOpacity(accent, 0.1) : surface,
                        shadowColor: shadow,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.savedProfileChipLabel,
                        { color: isActive ? accent : primaryFont },
                      ]}
                    >
                      {profile.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          <View style={styles.savedProfileRowCompact}>
            {activeProfileEntries.map((entry) => (
              <View key={entry.finger} style={styles.savedProfileColumn}>
                <Text style={[styles.savedProfileColumnLabel, { color: secondaryFont }]}>{entry.label}</Text>
                <Text style={[styles.savedProfileColumnValue, { color: primaryFont }]}>{entry.value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.sizingHelpCard,
          {
            // borderColor: withOpacity(border, 0.4),
            // backgroundColor: withOpacity(surfaceMuted, 0.75),
            // shadowColor: shadow,
            borderColor: withOpacity(border, 0.5),
            backgroundColor: withOpacity(surfaceMuted, 0.4),
          },
        ]}
      >
        <View style={styles.sizingHelpCopy}>
          <Text style={[styles.sizingHelpTitle, { color: primaryFont }]}>Need sizing help?</Text>
          <Text style={[styles.sizingHelpSubtitle, { color: secondaryFont }]}>Toggle on for Abri to assist and make sure your set fits just right.</Text>
        </View>
        <Switch
          value={Boolean(requiresSizingHelp)}
          onValueChange={(value) => {
            onMarkSizingHelp?.(value);
            // If enabling sizing help, also set selected option to manual if not saved
            if (value && computedSelectedOption !== 'saved') {
              onChangeSizingOption?.('manual');
            }
          }}
          trackColor={{
            true: withOpacity(accent, 0.4),
            false: withOpacity(border, 0.6),
          }}
          thumbColor={requiresSizingHelp ? accent : surface}
          ios_backgroundColor={withOpacity(border, 0.6)}
          accessibilityLabel="Need sizing help toggle"
          accessibilityHint="Toggle on if you need help determining your nail sizes"
        />
      </View>

      {/* Note: saveAsDefault state is exposed via ref callback pattern - parent handles saving */}
      {previewUpload ? (
        <Modal
          transparent
          animationType="fade"
          visible
          onRequestClose={() => setPreviewUpload(null)}
        >
          <View style={styles.previewModalContainer}>
            <View
              style={[
                styles.previewModalCard,
                {
                  backgroundColor: surface,
                  borderColor: withOpacity(border, 0.6),
                  maxWidth: 480,
                },
              ]}
            >
              <Image
                source={{ uri: previewUpload.uri }}
                style={styles.previewModalImageLarge}
                resizeMode="contain"
              />
              {previewUpload.name ? (
                <Text
                  style={[styles.previewModalSubtitle, { color: secondaryFont }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {previewUpload.name}
                </Text>
              ) : null}
              <TouchableOpacity
                onPress={() => setPreviewUpload(null)}
                accessibilityRole="button"
                style={[
                  styles.previewCloseButton,
                  {
                    borderColor: withOpacity(border, 0.5),
                    backgroundColor: withOpacity(surface, 0.95),
                  },
                ]}
              >
                <Text
                  style={[
                    styles.previewCloseLabel,
                    { color: primaryFont },
                  ]}
                >
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function FulfillmentStep({ colors, fulfillment, deliveryMethods = {}, onChangeMethod, onChangeSpeed, onChangeAddress, saveAddress, onSaveAddressChange }) {
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null); // null = not initialized, 'add_new' or address ID
  const [showDropdown, setShowDropdown] = useState(false);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const hasInitializedRef = useRef(false);

  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    surfaceMuted = '#F6EFE8',
    onSurface = primaryFont,
  } = colors || {};

  // Load saved addresses when component mounts or when address is required
  useEffect(() => {
    if (fulfillment.method === 'delivery' || fulfillment.method === 'shipping') {
      // Reset initialization flag and selection when method changes so we can re-initialize
      console.log('[FulfillmentStep] Method changed, resetting initialization');
      hasInitializedRef.current = false;
      setSelectedAddressId(null);
      loadSavedAddresses();
    } else {
      // If method doesn't require address, reset
      hasInitializedRef.current = false;
      setSelectedAddressId(null);
      setSavedAddresses([]);
    }
  }, [fulfillment.method]);

  // Initialize selection when addresses are loaded
  useEffect(() => {
    // Only initialize if we haven't initialized yet and addresses are loaded
    if (!hasInitializedRef.current && selectedAddressId === null) {
      if (savedAddresses.length > 0) {
        hasInitializedRef.current = true;
        // Check for default address - try multiple ways to check
        const defaultAddress = savedAddresses.find(addr => {
          // Check various possible values for isDefault
          const isDefault = addr.isDefault === true || 
                           addr.isDefault === 'true' || 
                           addr.isDefault === 1 ||
                           (typeof addr.isDefault !== 'undefined' && Boolean(addr.isDefault));
          return isDefault;
        });
        
        if (defaultAddress) {
          // Select the default address and pre-fill the form
          setSelectedAddressId(defaultAddress.id);
          onChangeAddress({
            label: defaultAddress.label || 'Home',
            name: defaultAddress.name || '',
            line1: defaultAddress.line1 || '',
            line2: defaultAddress.line2 || '',
            city: defaultAddress.city || '',
            state: defaultAddress.state || '',
            postalCode: defaultAddress.postalCode || '',
          });
        } else {
          // No default address, default to "Add New"
          setSelectedAddressId('add_new');
        }
      } else if (savedAddresses.length === 0 && !loadingAddresses) {
        // No saved addresses and not loading, default to "Add New"
        hasInitializedRef.current = true;
        setSelectedAddressId('add_new');
      }
    }
  }, [savedAddresses.length, selectedAddressId, loadingAddresses]);

  // When address is manually changed, check if it matches a saved address
  useEffect(() => {
    if (fulfillment.address?.name && fulfillment.address?.line1 && savedAddresses.length > 0) {
      const matchingAddress = savedAddresses.find(addr => 
        addr.name === fulfillment.address.name &&
        addr.line1 === fulfillment.address.line1 &&
        addr.city === fulfillment.address.city &&
        addr.state === fulfillment.address.state &&
        addr.postalCode === fulfillment.address.postalCode
      );
      // Only update if we find a match and it's different from current selection
      if (matchingAddress && selectedAddressId !== matchingAddress.id) {
        setSelectedAddressId(matchingAddress.id);
      }
    }
  }, [fulfillment.address?.name, fulfillment.address?.line1, fulfillment.address?.city, fulfillment.address?.state, fulfillment.address?.postalCode, savedAddresses]);

  const loadSavedAddresses = async () => {
    try {
      setLoadingAddresses(true);
      const { getSavedAddresses } = await import('../services/addressService');
      const addresses = await getSavedAddresses();
      setSavedAddresses(addresses || []);
      // Let the useEffect handle initialization when addresses are set
    } catch (error) {
      console.error('[FulfillmentStep] Error loading saved addresses:', error);
      setSavedAddresses([]);
      // Don't show error - just continue without saved addresses
      if (!hasInitializedRef.current) {
        hasInitializedRef.current = true;
        setSelectedAddressId('add_new');
      }
    } finally {
      setLoadingAddresses(false);
    }
  };

  const handleSelectAddress = (address, shouldUpdateForm = true) => {
      if (!address || address === 'add_new') {
        setSelectedAddressId('add_new');
        setShowDropdown(false);
        if (shouldUpdateForm) {
          // Start with empty label - user will see placeholder hint
          onChangeAddress({
            label: '',
            name: '',
            line1: '',
            line2: '',
            city: '',
            state: '',
            postalCode: '',
          });
        }
        return;
      }

    setSelectedAddressId(address.id);
    setShowDropdown(false);
    if (shouldUpdateForm) {
      onChangeAddress({
        label: address.label || 'Home',
        name: address.name || '',
        line1: address.line1 || '',
        line2: address.line2 || '',
        city: address.city || '',
        state: address.state || '',
        postalCode: address.postalCode || '',
      });
    }
  };

  const selectedAddress = selectedAddressId === null || selectedAddressId === 'add_new'
    ? null 
    : savedAddresses.find(addr => addr.id === selectedAddressId);
  
  const isAddNewSelected = selectedAddressId === null || selectedAddressId === 'add_new' || !selectedAddress;
  // Show save option when "Add New" is selected and user is entering a new address
  const showSaveOption = isAddNewSelected && (
    !fulfillment.address?.name || 
    !fulfillment.address?.line1 ||
    // Check if current address doesn't match any saved address
    !savedAddresses.some(addr => 
      addr.name === fulfillment.address?.name &&
      addr.line1 === fulfillment.address?.line1 &&
      addr.city === fulfillment.address?.city &&
      addr.state === fulfillment.address?.state &&
      addr.postalCode === fulfillment.address?.postalCode
    )
  );

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
        {Object.values(deliveryMethods || {}).map((method) => {
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
          deliveryMethods?.[fulfillment.method]?.speedOptions || {},
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

          {/* Address Dropdown */}
          {selectedAddressId !== null && (
          <View style={styles.addressDropdownContainer}>
            <TouchableOpacity
              onPress={() => setShowDropdown(!showDropdown)}
              style={[
                styles.addressDropdown,
                {
                  borderColor: accent,
                  backgroundColor: withOpacity(accent, 0.07),
                },
              ]}
            >
              <View style={styles.addressDropdownContent}>
                {selectedAddress ? (
                  <>
                    <View style={styles.addressDropdownHeader}>
                      <Text style={[styles.addressDropdownLabel, { color: accent }]}>
                        {selectedAddress.label || 'Home'}
                      </Text>
                      {selectedAddress.isDefault && (
                        <View style={[styles.defaultBadgeSmall, { backgroundColor: accent }]}>
                          <Text style={[styles.defaultBadgeTextSmall, { color: surface }]}>Default</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.addressDropdownPreview, { color: secondaryFont }]} numberOfLines={1}>
                      {selectedAddress.name}, {selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.state}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.addressDropdownLabel, { color: primaryFont }]}>
                    Add New
                  </Text>
                )}
              </View>
              <Icon 
                name="chevronRight" 
                color={primaryFont} 
                size={20} 
                style={[styles.addressDropdownIcon, { transform: [{ rotate: showDropdown ? '90deg' : '0deg' }] }]}
              />
            </TouchableOpacity>

            {/* Dropdown Options */}
            {showDropdown && (
              <View style={[
                styles.addressDropdownOptions,
                {
                  borderColor: border,
                  backgroundColor: surface,
                },
              ]}>
                <ScrollView style={styles.addressDropdownScroll} nestedScrollEnabled>
                  <TouchableOpacity
                    onPress={() => handleSelectAddress('add_new')}
                    style={[
                      styles.addressDropdownOption,
                      {
                        backgroundColor: isAddNewSelected ? withOpacity(accent, 0.08) : 'transparent',
                      },
                    ]}
                  >
                    <Text style={[styles.addressDropdownOptionText, { color: isAddNewSelected ? accent : primaryFont }]}>
                      Add New
                    </Text>
                    {isAddNewSelected && <Icon name="check" color={accent} size={18} />}
                  </TouchableOpacity>
                  {savedAddresses.map((address) => {
                    const isSelected = selectedAddressId === address.id;
                    return (
                      <TouchableOpacity
                        key={address.id}
                        onPress={() => handleSelectAddress(address)}
                        style={[
                          styles.addressDropdownOption,
                          {
                            backgroundColor: isSelected ? withOpacity(accent, 0.08) : 'transparent',
                          },
                        ]}
                      >
                        <View style={styles.addressDropdownOptionContent}>
                          <View style={styles.addressDropdownOptionHeader}>
                            <Text style={[styles.addressDropdownOptionLabel, { color: accent }]}>
                              {address.label || 'Home'}
                            </Text>
                            {address.isDefault && (
                              <View style={[styles.defaultBadgeSmall, { backgroundColor: accent }]}>
                                <Text style={[styles.defaultBadgeTextSmall, { color: surface }]}>Default</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.addressDropdownOptionPreview, { color: secondaryFont }]} numberOfLines={2}>
                            {address.name}, {address.line1}
                          </Text>
                        </View>
                        {isSelected && <Icon name="check" color={accent} size={18} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>
          )}

          {/* Show address details - either pre-filled from selected address or empty form */}
          {selectedAddress ? (
            /* Show pre-filled address details (read-only style but still editable) */
            <View style={styles.addressDetailsContainer}>
              <TextInput
                value={fulfillment.address.name}
                onChangeText={(value) => onChangeAddress({ name: value })}
                placeholder="Full name"
                placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                style={[
                  styles.addressInput,
                  {
                    borderColor: border,
                    color: onSurface,
                    backgroundColor: surface,
                  },
                ]}
              />
              <TextInput
                value={fulfillment.address.line1}
                onChangeText={(value) => onChangeAddress({ line1: value })}
                placeholder="Address line 1"
                placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                style={[
                  styles.addressInput,
                  {
                    borderColor: border,
                    color: onSurface,
                    backgroundColor: surface,
                  },
                ]}
              />
              {fulfillment.address.line2 ? (
                <TextInput
                  value={fulfillment.address.line2}
                  onChangeText={(value) => onChangeAddress({ line2: value })}
                  placeholder="Address line 2 (optional)"
                  placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                  style={[
                    styles.addressInput,
                    {
                      borderColor: border,
                      color: onSurface,
                      backgroundColor: surface,
                    },
                  ]}
                />
              ) : null}
              <View style={styles.addressRow}>
                <TextInput
                  value={fulfillment.address.city}
                  onChangeText={(value) => onChangeAddress({ city: value })}
                  placeholder="City"
                  placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                  style={[
                    styles.addressInputHalf,
                    {
                      borderColor: border,
                      color: onSurface,
                      backgroundColor: surface,
                    },
                  ]}
                />
                <TextInput
                  value={fulfillment.address.state}
                  onChangeText={(value) => onChangeAddress({ state: value })}
                  placeholder="State"
                  placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                  autoCapitalize="characters"
                  maxLength={2}
                  style={[
                    styles.addressInputQuarter,
                    {
                      borderColor: border,
                      color: onSurface,
                      backgroundColor: surface,
                    },
                  ]}
                />
                <TextInput
                  value={fulfillment.address.postalCode}
                  onChangeText={(value) => onChangeAddress({ postalCode: value })}
                  placeholder="Postcode"
                  placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                  style={[
                    styles.addressInputQuarter,
                    {
                      borderColor: border,
                      color: onSurface,
                      backgroundColor: surface,
                    },
                  ]}
                />
              </View>
            </View>
          ) : (
            /* Show empty address form for "Add New" */
            <View style={styles.addressDetailsContainer}>
              <TextInput
                value={fulfillment.address.label || ''}
                onChangeText={(value) => onChangeAddress({ label: value })}
                placeholder="Label (e.g., Home, Work)"
                placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                style={[
                  styles.addressInput,
                  {
                    borderColor: border,
                    color: onSurface,
                    backgroundColor: surface,
                  },
                ]}
              />
              <TextInput
                value={fulfillment.address.name}
                onChangeText={(value) => onChangeAddress({ name: value })}
                placeholder="Full name"
                placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                style={[
                  styles.addressInput,
                  {
                    borderColor: border,
                    color: onSurface,
                    backgroundColor: surface,
                  },
                ]}
              />
              <TextInput
                value={fulfillment.address.line1}
                onChangeText={(value) => onChangeAddress({ line1: value })}
                placeholder="Address line 1"
                placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                style={[
                  styles.addressInput,
                  {
                    borderColor: border,
                    color: onSurface,
                    backgroundColor: surface,
                  },
                ]}
              />
              <TextInput
                value={fulfillment.address.line2}
                onChangeText={(value) => onChangeAddress({ line2: value })}
                placeholder="Address line 2 (optional)"
                placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                style={[
                  styles.addressInput,
                  {
                    borderColor: border,
                    color: onSurface,
                    backgroundColor: surface,
                  },
                ]}
              />
              <View style={styles.addressRow}>
                <View style={styles.addressInputThird}>
                  <TextInput
                    value={fulfillment.address.city}
                    onChangeText={(value) => onChangeAddress({ city: value })}
                    placeholder="City"
                    placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                    style={[
                      styles.addressInput,
                      {
                        borderColor: border,
                        color: onSurface,
                        backgroundColor: surface,
                      },
                    ]}
                  />
                </View>
                <View style={styles.addressInputThird}>
                  <TextInput
                    value={fulfillment.address.state}
                    onChangeText={(value) => onChangeAddress({ state: value })}
                    placeholder="State"
                    placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                    autoCapitalize="characters"
                    maxLength={2}
                    style={[
                      styles.addressInput,
                      {
                        borderColor: border,
                        color: onSurface,
                        backgroundColor: surface,
                      },
                    ]}
                  />
                </View>
                <View style={styles.addressInputThird}>
                  <TextInput
                    value={fulfillment.address.postalCode}
                    onChangeText={(value) => onChangeAddress({ postalCode: value })}
                    placeholder="Postcode"
                    placeholderTextColor={withOpacity(secondaryFont, 0.6)}
                    style={[
                      styles.addressInput,
                      {
                        borderColor: border,
                        color: onSurface,
                        backgroundColor: surface,
                      },
                    ]}
                  />
                </View>
              </View>

              {/* Show "Save this address" option when adding new address */}
              {showSaveOption && (
                <View style={styles.saveAddressRow}>
                  <View style={styles.saveAddressCheckbox}>
                    <TouchableOpacity
                      onPress={() => onSaveAddressChange?.(!saveAddress)}
                      style={[
                        styles.checkbox,
                        {
                          borderColor: saveAddress ? accent : border,
                          backgroundColor: saveAddress ? accent : 'transparent',
                        },
                      ]}
                    >
                      {saveAddress && <Icon name="check" color={surface} size={14} />}
                    </TouchableOpacity>
                    <Text style={[styles.saveAddressLabel, { color: primaryFont }]}>
                      Save this address for future orders
                    </Text>
                  </View>
                </View>
              )}
            </View>
          )}
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
  deliveryMethods = {},
  onEditDelivery,
  promoCode = '',
  isPromoInputVisible = false,
  promoInputValue = '',
  onTogglePromoInput = () => {},
  onChangePromoInput = () => {},
  onApplyPromoCode = () => {},
  onClearPromoCode = () => {},
  capacityInfo = null,
}) {
  const {
    primaryFont = '#220707',
    secondaryFont = '#5C5F5D',
    accent = '#6F171F',
    border = '#D9C8A9',
    surface = '#FFFFFF',
    surfaceMuted = '#F4EBE3',
    warning: warningColor = '#FF9800',
  } = colors || {};

  const methods = deliveryMethods || getDeliveryMethodsSync();
  const methodConfig = methods[deliveryDetails?.method] || null;
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

  // Import formatNextAvailability for capacity messaging
  const formatNextAvailability = (nextWeekStartDate) => {
    if (!nextWeekStartDate) return 'soon';
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(nextWeekStartDate);
    nextWeek.setHours(0, 0, 0, 0);
    
    const daysDiff = Math.ceil((nextWeek - today) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) return 'today';
    if (daysDiff === 1) return 'tomorrow';
    if (daysDiff <= 7) return `in ${daysDiff} days`;
    
    return nextWeek.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: nextWeek.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

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
          <TouchableOpacity
            onPress={onAddAnotherSet}
            accessibilityRole="button"
          >
            <Text
              style={[
                styles.reviewLink,
                { color: accent },
              ]}
            >
              Add another set
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.reviewSetList}>
          {sets.map((set, index) => {
            const previewSource = resolveUploadPreview(set.designUploads?.[0]);
            const quantity = set.quantity || 1;
            const subtotal =
              set.price ??
              (typeof set.unitPrice === 'number' ? set.unitPrice * quantity : 0);
            const requiresFollowUp = !!set.requiresFollowUp;
            const sizeDetails = getSetSizeDetails(set);
            const sizeText = sizeDetails.entries?.length
              ? sizeDetails.entries
                  .map((entry) => `${entry.label}: ${entry.value}`)
                  .join(' · ')
              : sizeDetails.fallback || null;
            const isPhotoSizing = resolveSizingOptionFromSet(set) === 'camera';

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
                      <View style={styles.summaryDetailRow}>
                        <Text
                          style={[
                            styles.summaryDetailLabel,
                            { color: withOpacity(primaryFont, 0.7) },
                          ]}
                        >
                          Description
                        </Text>
                        <Text
                          style={[
                            styles.summaryDetailValue,
                            { color: secondaryFont },
                          ]}
                          numberOfLines={2}
                          ellipsizeMode="tail"
                        >
                          {set.designDescription}
                        </Text>
                      </View>
                    ) : null}
                    {isPhotoSizing || sizeText ? (
                      <View style={styles.reviewMetaRow}>
                        <Text
                          style={[
                            styles.reviewMetaLabel,
                            {
                              color: withOpacity(primaryFont, 0.7),
                              fontWeight: sizeDetails?.requiresSizingHelp ? '700' : '600',
                            },
                          ]}
                        >
                          Nail sizes
                        </Text>
                        <Text
                          style={[
                            styles.reviewMetaValue,
                            { color: sizeDetails?.requiresSizingHelp ? accent : secondaryFont },
                          ]}
                        >
                          {sizeDetails?.requiresSizingHelp
                            ? 'Need sizing assistance'
                            : isPhotoSizing
                            ? 'Photos provided'
                            : sizeText}
                        </Text>
                      </View>
                    ) : null}
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

      {/* Capacity messaging - shown on review screen */}
      {capacityInfo && (capacityInfo.isAlmostFull || capacityInfo.isFull) && (
        <View
          style={[
            styles.capacityMessage,
            {
              borderColor: capacityInfo.isFull
                ? withOpacity(warningColor, 0.4)
                : withOpacity(warningColor, 0.3),
              backgroundColor: capacityInfo.isFull
                ? withOpacity(warningColor, 0.08)
                : withOpacity(warningColor, 0.06),
            },
          ]}
        >
          {capacityInfo.isFull ? (
            <>
              <Text
                style={[
                  styles.capacityMessageTitle,
                  { color: warningColor },
                ]}
              >
                This Week Is Full!
              </Text>
              <Text
                style={[
                  styles.capacityMessageText,
                  { color: secondaryFont },
                ]}
              >
                Go ahead and submit! You'll need to submit again when the next window opens in{' '}
                <Text style={{ fontWeight: '600' }}>
                  {(() => {
                    if (!capacityInfo.nextWeekStartDate) return 'soon';
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const nextWeek = new Date(capacityInfo.nextWeekStartDate);
                    nextWeek.setHours(0, 0, 0, 0);
                    const daysDiff = Math.ceil((nextWeek - today) / (1000 * 60 * 60 * 24));
                    return `${daysDiff} day${daysDiff !== 1 ? 's' : ''}`;
                  })()}
                </Text>
              </Text>
            </>
          ) : capacityInfo.isAlmostFull ? (
            <>
              <Text
                style={[
                  styles.capacityMessageTitle,
                  { color: warningColor },
                ]}
              >
                Limited Availability
              </Text>
              <Text
                style={[
                  styles.capacityMessageText,
                  { color: secondaryFont },
                ]}
              >
                Only {capacityInfo.remaining} order{capacityInfo.remaining !== 1 ? 's' : ''} remaining this week. Submit your order soon to secure yours.
              </Text>
            </>
          ) : null}
        </View>
      )}

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
    alignItems: 'center',
  },
  shapeImage: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    marginBottom: 8,
  },
  shapeName: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  shapeDescription: {
    fontSize: 12,
    textAlign: 'center',
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
    gap: 10,
  },
  designUploadItem: {
    width: '30%',
    minWidth: 118,
    maxWidth: 160,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 10,
    gap: 8,
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  designUploadThumbnailFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    height: 96,
    backgroundColor: 'rgba(0,0,0,0.05)',
    position: 'relative',
  },
  designUploadImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
  },
  uploadOverlayText: {
    fontSize: 11,
    fontWeight: '600',
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
  sizeList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  sizeListInline: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sizeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
  },
  sizeChipFinger: {
    fontSize: 11,
    fontWeight: '600',
  },
  sizeChipValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  sizeFallbackText: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
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
  sizingOptionRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  sizingOptionButton: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
  },
  sizingOptionLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sizingInlineCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  sizingInlineTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  sizingInlineCopy: {
    fontSize: 12,
    lineHeight: 18,
  },
  sizingHelperText: {
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
    marginTop: 8,
  },
  sizingInstructionList: {
    gap: 6,
  },
  sizingInstructionItem: {
    fontSize: 12,
    lineHeight: 18,
  },
  sizingActionHint: {
    fontSize: 11,
    lineHeight: 16,
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
  savedProfileHeader: {
    gap: 4,
  },
  savedProfileSubtitle: {
    fontSize: 12,
  },
  savedProfileSwitcher: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  savedProfileChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 1,
  },
  savedProfileChipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  savedProfileRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  savedProfileColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  savedProfileColumnLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedProfileColumnValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  manualSizeInputRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
  },
  manualSizeInputColumn: {
    flex: 1,
    minWidth: '30%',
    gap: 8,
    alignItems: 'center',
  },
  manualSizeInputLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  manualSizeInput: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    minHeight: 44,
  },
  saveAsDefaultRow: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
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
  addressInputThird: {
    flex: 1,
  },
  addressFormHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  addAddressButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addressSelector: {
    gap: 12,
    marginBottom: 12,
  },
  addressOption: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  addressOptionContent: {
    flex: 1,
    gap: 4,
  },
  addressOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  addressOptionLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  backToSavedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    marginBottom: 8,
  },
  backToSavedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressDropdownContainer: {
    marginBottom: 12,
    position: 'relative',
    zIndex: 1,
  },
  addressDropdown: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addressDropdownContent: {
    flex: 1,
    marginRight: 8,
  },
  addressDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressDropdownLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  addressDropdownPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
  addressDropdownIcon: {
    marginLeft: 8,
  },
  addressDropdownOptions: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    maxHeight: 300,
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  addressDropdownScroll: {
    maxHeight: 300,
  },
  addressDropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  addressDropdownOptionContent: {
    flex: 1,
    marginRight: 8,
  },
  addressDropdownOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  addressDropdownOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  addressDropdownOptionPreview: {
    fontSize: 12,
    lineHeight: 16,
  },
  addressDropdownOptionText: {
    fontSize: 14,
    fontWeight: '600',
  },
  defaultBadgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeTextSmall: {
    fontSize: 10,
    fontWeight: '600',
  },
  addressDetailsContainer: {
    gap: 12,
  },
  saveAddressRow: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  saveAddressCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveAddressLabel: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  reviewContainer: {
    gap: 18,
  },
  reviewSection: {
    gap: 12,
  },
  reviewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  reviewHeading: {
    fontSize: 18,
    fontWeight: '800',
  },
  reviewSetList: {
    gap: 12,
  },
  reviewSetHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 4,
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
    textAlign: 'right',
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
  capacityMessage: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  capacityMessageTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  capacityMessageText: {
    fontSize: 13,
    lineHeight: 18,
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
  toastContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 24,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    flex: 1,
  },
  toastCloseButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastCloseText: {
    fontSize: 24,
    fontWeight: '300',
  },
  summaryDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  summaryDetailLabel: {
    fontSize: 12,
    fontWeight: '700',
    flexBasis: 90,
  },
  summaryDetailValue: {
    fontSize: 12,
    flex: 1,
    textAlign: 'right',
  },
  sizingHelpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  sizingHelpCopy: {
    flex: 1,
    gap: 4,
  },
  sizingHelpTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  sizingHelpSubtitle: {
    fontSize: 12,
    lineHeight: 18,
  },
  previewModalImageLarge: {
    width: '100%',
    height: 260,
    borderRadius: 18,
  },
  previewCloseButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewCloseLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  savedProfileRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 16,
  },
  savedProfileColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  savedProfileColumnLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedProfileColumnValue: {
    fontSize: 16,
    fontWeight: '700',
  },
});

export default NewOrderStepperScreen;


