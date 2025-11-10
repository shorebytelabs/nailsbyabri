import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import OrderConfirmationScreen from '../src/screens/OrderConfirmationScreen';
import ThemeProvider from '../src/theme/ThemeProvider';

describe('OrderConfirmationScreen', () => {
  const baseOrder = {
    id: '1882f6c52bd4a1ef',
    nailSets: [
      {
        id: 'set_1',
        name: 'Aurora Ombre',
        quantity: 2,
        shapeId: 'almond',
        sizes: { mode: 'perSet' },
      },
    ],
    fulfillment: {
      method: 'pickup',
      speed: 'standard',
    },
    pricing: {
      total: 120,
    },
    estimatedFulfillmentDate: new Date().toISOString(),
    contactEmail: 'guest@example.com',
  };

  const renderScreen = (props = {}) =>
    ReactTestRenderer.create(
      <ThemeProvider>
        <OrderConfirmationScreen order={baseOrder} onDone={jest.fn()} {...props} />
      </ThemeProvider>,
    );

  beforeEach(() => {
    Object.assign(global, {
      navigator: {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // @ts-expect-error allow cleanup in test environment
    delete global.navigator;
  });

  it('copies the full order id when copy action is pressed', async () => {
    const tree = renderScreen();
    const copyButton = tree.root.findByProps({ testID: 'order-copy-action' });

    await ReactTestRenderer.act(async () => {
      await copyButton.props.onPress();
    });

    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(baseOrder.id);
  });

  it('invokes onViewOrder when primary CTA is pressed', () => {
    const onViewOrder = jest.fn();
    const tree = renderScreen({ onViewOrder });
    const primaryCta = tree.root.findByProps({ testID: 'view-order-cta' });

    ReactTestRenderer.act(() => {
      primaryCta.props.onPress();
    });

    expect(onViewOrder).toHaveBeenCalledWith(baseOrder);
  });
});
