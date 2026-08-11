import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '../lib/auth';
import { normalizeServerUrl } from '../lib/storage';

export default function ServerLinkScreen() {
  const router = useRouter();
  const { configureServer } = useAuth();
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleContinue = async () => {
    if (!url.trim()) {
      setError('Enter your server address');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const normalized = normalizeServerUrl(url);
      // Verify reachability before saving.
      const res = await fetch(`${normalized}/api/trpc`, { method: 'GET' });
      if (!res.ok && res.status !== 404 && res.status !== 405) {
        setError(`Server responded with ${res.status}`);
        setBusy(false);
        return;
      }
      await configureServer(normalized);
      router.replace('/login');
    } catch {
      setError('Could not reach your server. Check the address and network.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Connect to your server</Text>
        <Text style={styles.subtitle}>
          myFlightTracker runs on your own self-hosted backend. Enter the
          address of your server to get started.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="https://flights.example.com"
          placeholderTextColor="#8a8a8e"
          value={url}
          onChangeText={setUrl}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={handleContinue}
          editable={!busy}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.button, busy && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={busy}
        >
          <Text style={styles.buttonText}>
            {busy ? 'Connecting…' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fafafa',
  },
  error: {
    color: '#d43b3b',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#1a73e8',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
