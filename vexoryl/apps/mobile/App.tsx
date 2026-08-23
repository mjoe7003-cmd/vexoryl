import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>VEXORYL / MOBILE</Text>
        <Text style={styles.title}>Live, wherever your people are.</Text>
        <Text style={styles.body}>The native player, realtime chat, reactions, and creator controls connect to the same API contracts as the web experience.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#101615' },
  container: { flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#c6f04a', letterSpacing: 2, fontSize: 12, fontWeight: '700' },
  title: { color: '#f5f3eb', fontSize: 38, fontWeight: '800', marginTop: 18 },
  body: { color: '#aeb8ae', fontSize: 17, lineHeight: 26, marginTop: 18 }
});
