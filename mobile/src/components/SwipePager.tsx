import { useMemo, useState } from 'react';
import { Animated, PanResponder, StyleSheet, type ViewStyle } from 'react-native';

interface SwipePagerProps {
  onNext: () => void;
  onPrev: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const THRESHOLD = 64;

export function SwipePager({ onNext, onPrev, children, style }: SwipePagerProps) {
  const [translateX] = useState(() => new Animated.Value(0));
  const [locked, setLocked] = useState(false);

  const panResponder = useMemo(() => {
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
      onPanResponderMove: (_, gesture) => {
        translateX.setValue(gesture.dx * 0.6);
      },
      onPanResponderRelease: (_, gesture) => {
        const dx = gesture.dx;
        if (Math.abs(dx) > THRESHOLD && !locked) {
          setLocked(true);
          Animated.timing(translateX, {
            toValue: Math.sign(dx) * 400,
            duration: 140,
            useNativeDriver: true,
          }).start(() => {
            if (dx < 0) onNext();
            else onPrev();
            translateX.setValue(0);
            setTimeout(() => setLocked(false), 180);
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();
      },
    });
  }, [onNext, onPrev, translateX, locked]);

  return (
    <Animated.View style={[styles.pager, style, { transform: [{ translateX }] }]} {...panResponder.panHandlers}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pager: { flex: 1, overflow: 'hidden' },
});
