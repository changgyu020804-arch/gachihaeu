import { Pressable, StyleSheet, Text, View } from "react-native";

type OfflineViewProps = {
  onRetry: () => void;
};

export function OfflineView({ onRetry }: OfflineViewProps) {
  return (
    <View style={styles.container}>
      <View style={styles.symbol}>
        <Text style={styles.symbolText}>U</Text>
      </View>
      <Text style={styles.title}>인터넷 연결을 확인해 주세요</Text>
      <Text style={styles.description}>
        연결이 불안정해 같이해U를 불러오지 못했어요.{"\n"}
        네트워크를 확인한 뒤 다시 시도해 주세요.
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="같이해U 다시 불러오기"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonText}>다시 불러오기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    backgroundColor: "#f2f5fa",
  },
  symbol: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 22,
    borderRadius: 24,
    backgroundColor: "#4771f5",
    shadowColor: "#4771f5",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  symbolText: {
    color: "#ffffff",
    fontSize: 31,
    fontWeight: "900",
  },
  title: {
    color: "#111827",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
    textAlign: "center",
  },
  description: {
    marginTop: 10,
    color: "#778196",
    fontSize: 13,
    lineHeight: 21,
    textAlign: "center",
  },
  button: {
    minWidth: 154,
    alignItems: "center",
    marginTop: 26,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#4771f5",
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
});
