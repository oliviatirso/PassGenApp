import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  Dimensions,
  Platform,
  Animated,
  TextInput,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState('generate'); // 'generate' or 'test'
  const [password, setPassword] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: '' });
  const [passwordAnalysis, setPasswordAnalysis] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const strengthBarWidth = useRef(new Animated.Value(0)).current;
  const copiedScale = useRef(new Animated.Value(0)).current;
  const loadingOpacity = useRef(new Animated.Value(0)).current;
  const loadingScale = useRef(new Animated.Value(0.3)).current;
  const logoRotation = useRef(new Animated.Value(0)).current;

  // Load dark mode preference
  useEffect(() => {
    loadDarkMode();
  }, []);

  const loadDarkMode = async () => {
    try {
      const value = await AsyncStorage.getItem('darkMode');
      if (value !== null) {
        setDarkMode(value === 'true');
      }
    } catch (e) {
      console.log('Error loading dark mode:', e);
    }
  };

  const toggleDarkMode = async () => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    await AsyncStorage.setItem('darkMode', String(newValue));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  // Generate password
  const generatePassword = useCallback(() => {
    // Enhanced haptic feedback for generation
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), 100);
    
    // Trigger rotation animation
    rotationAnim.setValue(0);
    Animated.timing(rotationAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start(() => rotationAnim.setValue(0));

    let charset = '';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+-=[]{}|;:,.<>?';

    if (charset === '') {
      setPassword('');
      setPasswordStrength({ score: 0, label: 'No Options', color: '#666' });
      return;
    }

    let newPassword = '';
    for (let i = 0; i < length; i++) {
      newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    setPassword(newPassword);
    analyzePassword(newPassword);
    
    // Trigger scale animation
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1.05,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
      }),
    ]).start();
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  // Calculate entropy
  const calculateEntropy = (pwd) => {
    let charsetSize = 0;
    if (/[a-z]/.test(pwd)) charsetSize += 26;
    if (/[A-Z]/.test(pwd)) charsetSize += 26;
    if (/[0-9]/.test(pwd)) charsetSize += 10;
    if (/[^A-Za-z0-9]/.test(pwd)) charsetSize += 32;
    
    return pwd.length * Math.log2(charsetSize);
  };

  // Calculate time to crack
  const calculateCrackTime = (pwd) => {
    const entropy = calculateEntropy(pwd);
    const combinations = Math.pow(2, entropy);
    
    // Assuming 10 billion guesses per second (modern GPU)
    const guessesPerSecond = 10000000000;
    const secondsToCrack = combinations / (2 * guessesPerSecond); // Divide by 2 for average case
    
    if (secondsToCrack < 1) return 'Instantly';
    if (secondsToCrack < 60) return `${Math.round(secondsToCrack)} seconds`;
    if (secondsToCrack < 3600) return `${Math.round(secondsToCrack / 60)} minutes`;
    if (secondsToCrack < 86400) return `${Math.round(secondsToCrack / 3600)} hours`;
    if (secondsToCrack < 2592000) return `${Math.round(secondsToCrack / 86400)} days`;
    if (secondsToCrack < 31536000) return `${Math.round(secondsToCrack / 2592000)} months`;
    if (secondsToCrack < 3153600000) return `${Math.round(secondsToCrack / 31536000)} years`;
    if (secondsToCrack < 31536000000) return `${Math.round(secondsToCrack / 31536000)} years`;
    return `${(secondsToCrack / 31536000).toExponential(2)} years`;
  };

  // Comprehensive password analysis
  const analyzePasswordComprehensive = (pwd) => {
    if (!pwd) {
      setPasswordStrength({ score: 0, label: 'No Password', color: '#666' });
      setPasswordAnalysis(null);
      Animated.spring(strengthBarWidth, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
      return;
    }

    let score = 0;
    const issues = [];
    const strengths = [];
    
    // Common passwords check
    const commonPasswords = ['password', '123456', 'qwerty', 'abc123', 'password123', 'admin', 'letmein', 'welcome', '12345678'];
    if (commonPasswords.some(common => pwd.toLowerCase().includes(common))) {
      issues.push('Contains common password pattern');
      score -= 2;
    }

    // Length scoring
    if (pwd.length < 8) {
      issues.push('Too short (less than 8 characters)');
    } else if (pwd.length >= 8) {
      score += 1;
      if (pwd.length >= 12) score += 1;
      if (pwd.length >= 16) {
        score += 1;
        strengths.push(`Good length (${pwd.length} characters)`);
      }
      if (pwd.length >= 20) score += 1;
    }

    // Complexity scoring
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
    
    if (hasLower) score += 1;
    if (hasUpper) score += 1;
    if (hasNumber) score += 1;
    if (hasSymbol) {
      score += 1;
      strengths.push('Contains special characters');
    }

    const charTypes = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (charTypes < 3) {
      issues.push(`Only uses ${charTypes} character type${charTypes === 1 ? '' : 's'}`);
    } else if (charTypes === 4) {
      strengths.push('Uses all character types');
    }

    // Diversity scoring
    const uniqueChars = new Set(pwd.split('')).size;
    if (uniqueChars > pwd.length * 0.5) score += 1;
    if (uniqueChars > pwd.length * 0.75) score += 1;
    
    if (uniqueChars < pwd.length * 0.3) {
      issues.push('Too many repeated characters');
    }

    // Sequential characters check
    if (/012|123|234|345|456|567|678|789|abc|bcd|cde|def|efg|fgh|ghi|hij/i.test(pwd)) {
      issues.push('Contains sequential characters');
      score -= 1;
    }

    // Repeated patterns
    if (/(.)\1{2,}/.test(pwd)) {
      issues.push('Contains repeated patterns');
      score -= 1;
    }

    // Keyboard patterns
    if (/qwerty|asdfgh|zxcvbn/i.test(pwd)) {
      issues.push('Contains keyboard pattern');
      score -= 1;
    }

    let strength = { score: 0, label: 'Very Weak', color: '#FF4444' };
    
    if (score <= 3) {
      strength = { score: 1, label: 'Weak', color: '#FF6B35' };
    } else if (score <= 5) {
      strength = { score: 2, label: 'Fair', color: '#FFA500' };
    } else if (score <= 7) {
      strength = { score: 3, label: 'Good', color: '#52B788' };
    } else if (score <= 9) {
      strength = { score: 4, label: 'Strong', color: '#2D6A4F' };
    } else {
      strength = { score: 5, label: 'Very Strong', color: '#1B4332' };
    }

    const entropy = calculateEntropy(pwd);
    const crackTime = calculateCrackTime(pwd);

    setPasswordStrength(strength);
    setPasswordAnalysis({
      entropy: entropy.toFixed(1),
      crackTime,
      issues,
      strengths,
      charTypes,
      uniqueChars,
      length: pwd.length,
    });

    Animated.spring(strengthBarWidth, {
      toValue: (strength.score / 5) * 100,
      useNativeDriver: false,
    }).start();
  };

  // Simple analyze for generated passwords
  const analyzePassword = (pwd) => {
    analyzePasswordComprehensive(pwd);
  };

  // Copy to clipboard
  const copyToClipboard = async () => {
    if (!password) return;
    
    await Clipboard.setStringAsync(password);
    
    // Triple haptic feedback for copy action
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 50);
    setTimeout(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), 100);
    
    setCopied(true);
    copiedScale.setValue(1);
    Animated.sequence([
      Animated.spring(copiedScale, {
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(copiedScale, {
        toValue: 0,
        duration: 2000,
        useNativeDriver: true,
      }),
    ]).start();
    
    setTimeout(() => setCopied(false), 2000);
  };

  // Loading screen animation and timer
  useEffect(() => {
    // Fade in and scale up loading screen
    Animated.parallel([
      Animated.timing(loadingOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(loadingScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Rotate logo continuously
    Animated.loop(
      Animated.timing(logoRotation, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    ).start();

    // Hide loading screen after 5 seconds
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(loadingOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(loadingScale, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsLoading(false);
      });
    }, 5000);

    return () => clearTimeout(timer);
  }, []);

  // Generate initial password
  useEffect(() => {
    if (!isLoading) {
      generatePassword();
    }
  }, [isLoading]);

  // Test password when user types
  useEffect(() => {
    if (mode === 'test' && testPassword) {
      // Light haptic feedback when typing (throttled)
      const hasWeakPattern = /password|123456|qwerty/i.test(testPassword);
      if (hasWeakPattern && testPassword.length > 5) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      analyzePasswordComprehensive(testPassword);
    } else if (mode === 'test' && !testPassword) {
      analyzePasswordComprehensive(testPassword);
    }
  }, [testPassword, mode]);

  // Switch mode
  const switchMode = (newMode) => {
    setMode(newMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (newMode === 'generate') {
      setPasswordAnalysis(null);
      analyzePassword(password);
    } else {
      if (testPassword) {
        analyzePasswordComprehensive(testPassword);
      }
    }
  };

  const theme = darkMode ? darkTheme : lightTheme;

  const rotation = rotationAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const logoSpin = logoRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Loading Screen
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: darkMode ? '#0a0a0a' : '#f5f5f7' }]}>
        <StatusBar style={darkMode ? 'light' : 'dark'} />
        <LinearGradient
          colors={['#6366f1', '#8b5cf6', '#ec4899']}
          style={styles.loadingGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View
            style={[
              styles.loadingContent,
              {
                opacity: loadingOpacity,
                transform: [{ scale: loadingScale }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.loadingIconContainer,
                { transform: [{ rotate: logoSpin }] },
              ]}
            >
              <Text style={styles.loadingIcon}>🔐</Text>
            </Animated.View>
            <Text style={styles.loadingTitle}>PassGen Pro</Text>
            <Text style={styles.loadingSubtitle}>Your Password Security Solution</Text>
            <View style={styles.loadingDotsContainer}>
              <Text style={styles.loadingDots}>• • •</Text>
            </View>
          </Animated.View>
          
          {/* Footer */}
          <Animated.View style={[styles.loadingFooter, { opacity: loadingOpacity }]}>
            <Text style={[styles.footerText, { color: '#fff', opacity: 0.9 }]}>
              Powered by Dynamic.IO
            </Text>
          </Animated.View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar style={darkMode ? 'light' : 'dark'} />
      
      {/* Header */}
      <LinearGradient
        colors={darkMode ? ['#1a1a2e', '#16213e'] : ['#6366f1', '#8b5cf6']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>🔐 PassGen Pro</Text>
          <TouchableOpacity onPress={toggleDarkMode} style={styles.darkModeToggle}>
            <Text style={styles.darkModeIcon}>{darkMode ? '☀️' : '🌙'}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Mode Toggle */}
        <View style={[styles.modeToggleContainer, { backgroundColor: theme.cardBg }]}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'generate' && styles.modeButtonActive,
              mode === 'generate' && { backgroundColor: darkMode ? '#6366f1' : '#8b5cf6' },
            ]}
            onPress={() => switchMode('generate')}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: mode === 'generate' ? '#fff' : theme.textSecondary },
              ]}
            >
              ⚡ Generate
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'test' && styles.modeButtonActive,
              mode === 'test' && { backgroundColor: darkMode ? '#6366f1' : '#8b5cf6' },
            ]}
            onPress={() => switchMode('test')}
          >
            <Text
              style={[
                styles.modeButtonText,
                { color: mode === 'test' ? '#fff' : theme.textSecondary },
              ]}
            >
              🔍 Test Password
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'generate' ? (
          <>
            {/* Password Display */}
            <Animated.View 
              style={[
                styles.passwordContainer, 
                { backgroundColor: theme.cardBg },
                { transform: [{ scale: scaleAnim }] }
              ]}
            >
              <View style={styles.passwordHeader}>
                <Text style={[styles.passwordLabel, { color: theme.textSecondary }]}>
                  Your Password
                </Text>
                <TouchableOpacity 
                  onPress={copyToClipboard} 
                  style={[styles.copyButton, { backgroundColor: darkMode ? '#6366f1' : '#8b5cf6' }]}
                  activeOpacity={0.7}
                >
                  <Text style={styles.copyButtonIcon}>📋</Text>
                  <Text style={styles.copyButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={copyToClipboard} activeOpacity={0.7}>
                <Text style={[styles.password, { color: theme.textPrimary }]} numberOfLines={3}>
                  {password || 'Generate a password'}
                </Text>
              </TouchableOpacity>
              
              {/* Copy indicator */}
              {copied && (
                <Animated.View 
                  style={[
                    styles.copiedBadge,
                    {
                      opacity: copiedScale,
                      transform: [{ scale: copiedScale }],
                    }
                  ]}
                >
                  <Text style={styles.copiedText}>✓ Copied!</Text>
                </Animated.View>
              )}
            </Animated.View>
          </>
        ) : (
          <>
            {/* Test Password Input */}
            <View style={[styles.passwordContainer, { backgroundColor: theme.cardBg }]}>
              <Text style={[styles.passwordLabel, { color: theme.textSecondary }]}>
                Enter Your Password to Test
              </Text>
              <View style={styles.passwordInputContainer}>
                <TextInput
                  style={[styles.passwordInput, { color: theme.textPrimary }]}
                  value={testPassword}
                  onChangeText={setTestPassword}
                  placeholder="Type your password here..."
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  onPress={() => {
                    setShowPassword(!showPassword);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={styles.eyeButton}
                  activeOpacity={0.6}
                >
                  <Text style={styles.eyeIcon}>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Password Strength Meter */}
        {((mode === 'generate' && password) || (mode === 'test' && testPassword)) && (
          <View style={[styles.strengthContainer, { backgroundColor: theme.cardBg }]}>
            <View style={styles.strengthHeader}>
              <Text style={[styles.strengthLabel, { color: theme.textSecondary }]}>
                Strength
              </Text>
              <Text style={[styles.strengthValue, { color: passwordStrength.color }]}>
                {passwordStrength.label}
              </Text>
            </View>
            <View style={[styles.strengthBarBg, { backgroundColor: theme.strengthBarBg }]}>
              <Animated.View
                style={[
                  styles.strengthBar,
                  { backgroundColor: passwordStrength.color },
                  {
                    width: strengthBarWidth.interpolate({
                      inputRange: [0, 100],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>
        )}

        {/* Detailed Analysis */}
        {passwordAnalysis && mode === 'test' && testPassword && (
          <View style={[styles.analysisContainer, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.analysisTitle, { color: theme.textPrimary }]}>
              🔒 Security Analysis
            </Text>
            
            {/* Crack Time */}
            <View style={styles.analysisSection}>
              <Text style={[styles.analysisSectionTitle, { color: theme.textPrimary }]}>
                ⏱️ Time to Crack
              </Text>
              <Text style={[styles.crackTime, { color: passwordStrength.color }]}>
                {passwordAnalysis.crackTime}
              </Text>
              <Text style={[styles.crackTimeNote, { color: theme.textSecondary }]}>
                Using modern GPU (10 billion guesses/sec)
              </Text>
            </View>

            {/* Stats */}
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {passwordAnalysis.length}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Characters
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {passwordAnalysis.uniqueChars}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Unique
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {passwordAnalysis.charTypes}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Char Types
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: theme.textPrimary }]}>
                  {passwordAnalysis.entropy}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Entropy
                </Text>
              </View>
            </View>

            {/* Strengths */}
            {passwordAnalysis.strengths.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={[styles.analysisSectionTitle, { color: '#52B788' }]}>
                  ✅ Strengths
                </Text>
                {passwordAnalysis.strengths.map((strength, index) => (
                  <Text key={index} style={[styles.feedbackItem, { color: theme.textPrimary }]}>
                    • {strength}
                  </Text>
                ))}
              </View>
            )}

            {/* Issues */}
            {passwordAnalysis.issues.length > 0 && (
              <View style={styles.analysisSection}>
                <Text style={[styles.analysisSectionTitle, { color: '#FF6B35' }]}>
                  ⚠️ Issues Found
                </Text>
                {passwordAnalysis.issues.map((issue, index) => (
                  <Text key={index} style={[styles.feedbackItem, { color: theme.textPrimary }]}>
                    • {issue}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Length Selector - Only in Generate Mode */}
        {mode === 'generate' && (
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Password Length: {length}
            </Text>
          <View style={styles.lengthButtons}>
            {[8, 12, 16, 20, 24, 32].map((len) => (
              <TouchableOpacity
                key={len}
                style={[
                  styles.lengthButton,
                  { backgroundColor: theme.buttonBg },
                  length === len && styles.lengthButtonActive,
                  length === len && {
                    backgroundColor: darkMode ? '#6366f1' : '#8b5cf6',
                    borderWidth: 3,
                    borderColor: darkMode ? '#8b5cf6' : '#ec4899',
                  },
                ]}
                onPress={() => {
                  setLength(len);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
              >
                <Text
                  style={[
                    styles.lengthButtonText,
                    { 
                      color: length === len ? '#fff' : theme.textPrimary,
                      fontWeight: length === len ? 'bold' : '600',
                    },
                  ]}
                >
                  {len}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          </View>
        )}

        {/* Options - Only in Generate Mode */}
        {mode === 'generate' && (
          <View style={[styles.card, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
              Character Types
            </Text>
          
          <OptionRow
            label="Uppercase (A-Z)"
            value={includeUppercase}
            onValueChange={(val) => {
              setIncludeUppercase(val);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            theme={theme}
          />
          
          <OptionRow
            label="Lowercase (a-z)"
            value={includeLowercase}
            onValueChange={(val) => {
              setIncludeLowercase(val);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            theme={theme}
          />
          
          <OptionRow
            label="Numbers (0-9)"
            value={includeNumbers}
            onValueChange={(val) => {
              setIncludeNumbers(val);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            theme={theme}
          />
          
          <OptionRow
            label="Symbols (!@#$%)"
            value={includeSymbols}
            onValueChange={(val) => {
              setIncludeSymbols(val);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            theme={theme}
          />
          </View>
        )}

        {/* Generate Button - Only in Generate Mode */}
        {mode === 'generate' && (
          <TouchableOpacity
          onPress={generatePassword}
          activeOpacity={0.8}
          style={styles.generateButtonContainer}
        >
          <LinearGradient
            colors={darkMode ? ['#6366f1', '#8b5cf6'] : ['#8b5cf6', '#ec4899']}
            style={styles.generateButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Animated.Text style={[styles.generateButtonIcon, { transform: [{ rotate: rotation }] }]}>
              🔄
            </Animated.Text>
            <Text style={styles.generateButtonText}>Generate New Password</Text>
          </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: theme.infoBg }]}>
          <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>
            💡 Tips for Strong Passwords
          </Text>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            • Use at least 16 characters{'\n'}
            • Include all character types{'\n'}
            • Never reuse passwords{'\n'}
            • Use a password manager{'\n'}
            • Enable two-factor authentication
          </Text>
        </View>

        <View style={{ height: 20 }} />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.textSecondary }]}>
            Powered by Dynamic.IO
          </Text>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const OptionRow = ({ label, value, onValueChange, theme }) => (
  <View style={styles.optionRow}>
    <Text style={[styles.optionLabel, { color: theme.textPrimary }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#767577', true: '#8b5cf6' }}
      thumbColor={value ? '#fff' : '#f4f3f4'}
      ios_backgroundColor="#3e3e3e"
    />
  </View>
);

const lightTheme = {
  background: '#f5f5f7',
  cardBg: '#ffffff',
  buttonBg: '#f0f0f5',
  textPrimary: '#1d1d1f',
  textSecondary: '#6e6e73',
  strengthBarBg: '#e5e5ea',
  infoBg: '#e8f4f8',
};

const darkTheme = {
  background: '#0a0a0a',
  cardBg: '#1c1c1e',
  buttonBg: '#2a2a2c',
  textPrimary: '#ffffff',
  textSecondary: '#a1a1a6',
  strengthBarBg: '#2c2c2e',
  infoBg: '#1a2332',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  darkModeToggle: {
    padding: 8,
  },
  darkModeIcon: {
    fontSize: 24,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  passwordContainer: {
    marginTop: 20,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    minHeight: 120,
    justifyContent: 'center',
  },
  passwordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  passwordLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  copyButtonIcon: {
    fontSize: 14,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  password: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    lineHeight: 28,
  },
  copiedBadge: {
    position: 'absolute',
    top: 24,
    right: 24,
    backgroundColor: '#2D6A4F',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  copiedText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  strengthContainer: {
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  strengthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  strengthLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  strengthValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  strengthBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  strengthBar: {
    height: '100%',
    borderRadius: 4,
  },
  card: {
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  lengthButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  lengthButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  lengthButtonActive: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  lengthButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  generateButtonContainer: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    gap: 12,
  },
  generateButtonIcon: {
    fontSize: 24,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  infoCard: {
    marginTop: 24,
    padding: 20,
    borderRadius: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    lineHeight: 22,
  },
  modeToggleContainer: {
    marginTop: 20,
    flexDirection: 'row',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modeButtonActive: {
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    paddingVertical: 8,
    paddingRight: 40,
  },
  eyeButton: {
    padding: 8,
    position: 'absolute',
    right: 0,
  },
  eyeIcon: {
    fontSize: 24,
  },
  analysisContainer: {
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  analysisTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  analysisSection: {
    marginBottom: 20,
  },
  analysisSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  crackTime: {
    fontSize: 28,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  crackTimeNote: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  feedbackItem: {
    fontSize: 14,
    marginVertical: 4,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
  },
  loadingIconContainer: {
    marginBottom: 30,
  },
  loadingIcon: {
    fontSize: 100,
  },
  loadingTitle: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 30,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  loadingDotsContainer: {
    marginTop: 20,
  },
  loadingDots: {
    fontSize: 24,
    color: '#fff',
    letterSpacing: 8,
  },
  loadingFooter: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
  },
  footerText: {
    fontSize: 12,
    opacity: 0.6,
    letterSpacing: 0.5,
  },
});
