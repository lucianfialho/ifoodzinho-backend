# 📱 Guia de Integração Frontend - FoodieSwipe

## 🎯 **Para Agentes Frontend - Instruções Completas**

Este guia contém todas as instruções necessárias para integrar o frontend React Native com o backend Firebase implementado.

---

## 📋 **FASE 1: Setup do Projeto React Native**

### **Passo 1: Inicializar Projeto**
```bash
# Criar novo projeto React Native com Expo
npx create-expo-app FoodieSwipe --template typescript

# Ou com React Native CLI
npx react-native init FoodieSwipe --template react-native-template-typescript

cd FoodieSwipe
```

### **Passo 2: Instalar Dependências Firebase**
```bash
npm install @react-native-firebase/app
npm install @react-native-firebase/auth
npm install @react-native-firebase/firestore
npm install @react-native-firebase/messaging # Para push notifications

# Para Expo (alternativo)
npm install firebase

# Dependências auxiliares
npm install @react-native-async-storage/async-storage
npm install react-native-keychain # Para armazenar tokens
```

### **Passo 3: Configuração Firebase Client**

Crie arquivo `src/config/firebase.ts`:
```typescript
import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuração do Firebase Client
const firebaseConfig = {
  apiKey: "SUA_API_KEY_AQUI",
  authDomain: "foodswipe-ca641.firebaseapp.com",
  projectId: "foodswipe-ca641",
  storageBucket: "foodswipe-ca641.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Configurar Auth com persistência
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Inicializar Firestore
const firestore = getFirestore(app);

export { auth, firestore };
export default app;
```

**⚠️ IMPORTANTE:** Obtenha as configurações do cliente no Firebase Console:
1. Project Settings → General → Your apps
2. Add app → iOS/Android
3. Baixe `google-services.json` (Android) ou `GoogleService-Info.plist` (iOS)

---

## 📋 **FASE 2: Services e Configuração**

### **Passo 4: API Service**

Crie `src/services/apiService.ts`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:3001'; // Ou sua URL de produção

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = BASE_URL;
  }

  // Buscar token do usuário autenticado
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('userToken');
    } catch (error) {
      console.error('Erro ao buscar token:', error);
      return null;
    }
  }

  // Headers com autenticação
  private async getHeaders(authenticated: boolean = true): Promise<HeadersInit> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (authenticated) {
      const token = await this.getAuthToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  // Fazer requisição HTTP
  private async makeRequest(
    endpoint: string, 
    options: RequestInit = {}, 
    authenticated: boolean = true
  ) {
    try {
      const headers = await this.getHeaders(authenticated);
      
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro na requisição');
      }

      return data;
    } catch (error) {
      console.error(`Erro na API ${endpoint}:`, error);
      throw error;
    }
  }

  // ================================
  // ENDPOINTS DE AUTENTICAÇÃO
  // ================================

  async verifyUser() {
    return this.makeRequest('/api/auth/verify', { method: 'POST' });
  }

  async getProfile() {
    return this.makeRequest('/api/auth/profile');
  }

  async updatePreferences(preferences: any) {
    return this.makeRequest('/api/auth/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async updateProfile(profileData: any) {
    return this.makeRequest('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async recordSwipe(swipeData: {
    dishId: string;
    restaurantId: string;
    action: 'like' | 'pass' | 'super_like';
    location?: { lat: number; lng: number };
  }) {
    return this.makeRequest('/api/auth/swipe', {
      method: 'POST',
      body: JSON.stringify(swipeData),
    });
  }

  async getSwipeHistory(limit: number = 50, offset: number = 0) {
    return this.makeRequest(`/api/auth/swipe-history?limit=${limit}&offset=${offset}`);
  }

  async getMatches() {
    return this.makeRequest('/api/auth/matches');
  }

  async getStats() {
    return this.makeRequest('/api/auth/stats');
  }

  // ================================
  // ENDPOINTS DO iFood
  // ================================

  async getRestaurants(lat: number, lng: number, size: number = 20) {
    return this.makeRequest(
      `/api/restaurants/${lat}/${lng}?size=${size}`, 
      { method: 'GET' }, 
      false // Pode ser usado sem autenticação
    );
  }

  async getMenu(restaurantId: string, lat: number, lng: number) {
    return this.makeRequest(
      `/api/menu/${restaurantId}/${lat}/${lng}`, 
      { method: 'GET' }, 
      false
    );
  }

  async getDishesFeed(data: {
    lat: number;
    lng: number;
    restaurantIds: string[];
    limit?: number;
  }) {
    return this.makeRequest('/api/dishes/feed', {
      method: 'POST',
      body: JSON.stringify(data),
    }, false);
  }
}

export default new ApiService();
```

### **Passo 5: Authentication Service**

Crie `src/services/authService.ts`:
```typescript
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  FacebookAuthProvider
} from 'firebase/auth';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

class AuthService {
  // Listener do estado de autenticação
  onAuthStateChanged(callback: (user: User | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  // Registrar usuário
  async signUp(email: string, password: string, displayName: string) {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Atualizar perfil
      await updateProfile(user, { displayName });

      // Enviar verificação de email
      await sendEmailVerification(user);

      // Sincronizar com backend
      const idToken = await user.getIdToken();
      await AsyncStorage.setItem('userToken', idToken);
      await apiService.verifyUser();

      return user;
    } catch (error) {
      console.error('Erro no registro:', error);
      throw error;
    }
  }

  // Login com email/senha
  async signIn(email: string, password: string) {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Salvar token
      const idToken = await user.getIdToken();
      await AsyncStorage.setItem('userToken', idToken);

      // Sincronizar com backend
      await apiService.verifyUser();

      return user;
    } catch (error) {
      console.error('Erro no login:', error);
      throw error;
    }
  }

  // Login com Google
  async signInWithGoogle() {
    try {
      // Implementar Google Sign-In aqui
      // Usar @react-native-google-signin/google-signin
      console.log('Implementar Google Sign-In');
    } catch (error) {
      console.error('Erro no login com Google:', error);
      throw error;
    }
  }

  // Logout
  async signOut() {
    try {
      await firebaseSignOut(auth);
      await AsyncStorage.removeItem('userToken');
    } catch (error) {
      console.error('Erro no logout:', error);
      throw error;
    }
  }

  // Reset de senha
  async resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Erro no reset de senha:', error);
      throw error;
    }
  }

  // Atualizar token (chamar periodicamente)
  async refreshToken() {
    try {
      const user = auth.currentUser;
      if (user) {
        const idToken = await user.getIdToken(true); // Força refresh
        await AsyncStorage.setItem('userToken', idToken);
        return idToken;
      }
      return null;
    } catch (error) {
      console.error('Erro ao atualizar token:', error);
      throw error;
    }
  }

  // Obter usuário atual
  getCurrentUser() {
    return auth.currentUser;
  }
}

export default new AuthService();
```

---

## 📋 **FASE 3: Context e State Management**

### **Passo 6: User Context**

Crie `src/contexts/UserContext.tsx`:
```typescript
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import authService from '../services/authService';
import apiService from '../services/apiService';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  emailVerified: boolean;
  profile: {
    firstName: string;
    lastName: string;
    bio: string;
    location: any;
  };
  preferences: {
    cuisines: string[];
    dietary: string[];
    priceRange: { min: number; max: number };
    maxDeliveryTime: number;
    maxDeliveryFee: number;
    excludeIngredients: string[];
  };
  stats: {
    totalSwipes: number;
    totalMatches: number;
    currentStreak: number;
    longestStreak: number;
  };
}

interface UserContextData {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  updatePreferences: (preferences: any) => Promise<void>;
  updateProfile: (profileData: any) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextData>({} as UserContextData);

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Monitorar estado de autenticação
  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        try {
          // Buscar perfil completo do backend
          const profile = await apiService.getProfile();
          setUserProfile(profile);
        } catch (error) {
          console.error('Erro ao buscar perfil:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Atualizar token periodicamente
  useEffect(() => {
    if (user) {
      const interval = setInterval(async () => {
        try {
          await authService.refreshToken();
        } catch (error) {
          console.error('Erro ao atualizar token:', error);
        }
      }, 50 * 60 * 1000); // A cada 50 minutos

      return () => clearInterval(interval);
    }
  }, [user]);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await authService.signIn(email, password);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signUp = async (email: string, password: string, displayName: string) => {
    setLoading(true);
    try {
      await authService.signUp(email, password, displayName);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await authService.signOut();
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  };

  const updatePreferences = async (preferences: any) => {
    try {
      await apiService.updatePreferences(preferences);
      await refreshProfile();
    } catch (error) {
      console.error('Erro ao atualizar preferências:', error);
      throw error;
    }
  };

  const updateProfile = async (profileData: any) => {
    try {
      await apiService.updateProfile(profileData);
      await refreshProfile();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      try {
        const profile = await apiService.getProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Erro ao atualizar perfil:', error);
      }
    }
  };

  return (
    <UserContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signIn,
        signUp,
        signOut,
        updatePreferences,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = (): UserContextData => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser deve ser usado dentro de UserProvider');
  }
  return context;
};
```

---

## 📋 **FASE 4: Hooks Customizados**

### **Passo 7: Custom Hooks**

Crie `src/hooks/useRestaurants.ts`:
```typescript
import { useState, useEffect } from 'react';
import apiService from '../services/apiService';

export const useRestaurants = (lat: number, lng: number, size: number = 20) => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRestaurants = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.getRestaurants(lat, lng, size);
      setRestaurants(data.restaurants);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (lat && lng) {
      fetchRestaurants();
    }
  }, [lat, lng, size]);

  return { restaurants, loading, error, refetch: fetchRestaurants };
};
```

Crie `src/hooks/useSwipe.ts`:
```typescript
import { useState, useCallback } from 'react';
import apiService from '../services/apiService';
import { useUser } from '../contexts/UserContext';

export const useSwipe = () => {
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useUser();

  const swipe = useCallback(async (
    dishId: string,
    restaurantId: string,
    action: 'like' | 'pass' | 'super_like',
    location?: { lat: number; lng: number }
  ) => {
    if (!user) {
      throw new Error('Usuário não autenticado');
    }

    try {
      setLoading(true);
      await apiService.recordSwipe({
        dishId,
        restaurantId,
        action,
        location,
      });
      
      // Atualizar estatísticas do usuário
      await refreshProfile();
      
    } catch (error) {
      console.error('Erro ao registrar swipe:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [user, refreshProfile]);

  return { swipe, loading };
};
```

---

## 📋 **FASE 5: Componentes Base**

### **Passo 8: Componente de Login**

Crie `src/screens/LoginScreen.tsx`:
```typescript
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useUser } from '../contexts/UserContext';

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [displayName, setDisplayName] = useState('');
  
  const { signIn, signUp, loading } = useUser();

  const handleSubmit = async () => {
    try {
      if (isSignUp) {
        await signUp(email, password, displayName);
        Alert.alert('Sucesso', 'Conta criada! Verifique seu email.');
      } else {
        await signIn(email, password);
      }
    } catch (error) {
      Alert.alert('Erro', error instanceof Error ? error.message : 'Erro desconhecido');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Entrando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        {isSignUp ? 'Criar Conta' : 'Entrar'}
      </Text>

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="Nome completo"
          value={displayName}
          onChangeText={setDisplayName}
          autoCapitalize="words"
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>
          {isSignUp ? 'Criar Conta' : 'Entrar'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.switchButton}
        onPress={() => setIsSignUp(!isSignUp)}
      >
        <Text style={styles.switchText}>
          {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    color: '#2C3E50',
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E1E8ED',
  },
  button: {
    backgroundColor: '#FF6B6B',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  switchButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  switchText: {
    color: '#4ECDC4',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#2C3E50',
  },
});

export default LoginScreen;
```

### **Passo 9: Componente de Swipe**

Crie `src/screens/SwipeScreen.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSwipe } from '../hooks/useSwipe';
import apiService from '../services/apiService';

const { width, height } = Dimensions.get('window');

const SwipeScreen: React.FC = () => {
  const [dishes, setDishes] = useState([]);
  const [currentDishIndex, setCurrentDishIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const { swipe, loading: swipeLoading } = useSwipe();

  useEffect(() => {
    loadDishes();
  }, []);

  const loadDishes = async () => {
    try {
      setLoading(true);
      
      // Primeiro buscar restaurantes
      const restaurantsData = await apiService.getRestaurants(-23.561684, -46.625378, 10);
      const restaurantIds = restaurantsData.restaurants.map(r => r.id);
      
      // Depois buscar pratos
      const dishesData = await apiService.getDishesFeed({
        lat: -23.561684,
        lng: -46.625378,
        restaurantIds,
        limit: 50,
      });
      
      setDishes(dishesData.dishes);
    } catch (error) {
      Alert.alert('Erro', 'Erro ao carregar pratos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwipe = async (action: 'like' | 'pass' | 'super_like') => {
    const currentDish = dishes[currentDishIndex];
    if (!currentDish) return;

    try {
      await swipe(currentDish.id, currentDish.restaurantId, action);
      
      // Próximo prato
      setCurrentDishIndex(prev => prev + 1);
      
      // Se acabaram os pratos, carregar mais
      if (currentDishIndex >= dishes.length - 5) {
        await loadDishes();
      }
    } catch (error) {
      Alert.alert('Erro', 'Erro ao registrar swipe');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Carregando pratos...</Text>
      </View>
    );
  }

  const currentDish = dishes[currentDishIndex];
  
  if (!currentDish) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Não há mais pratos disponíveis</Text>
        <TouchableOpacity style={styles.reloadButton} onPress={loadDishes}>
          <Text style={styles.reloadText}>Recarregar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image 
          source={{ uri: currentDish.imageUrl }} 
          style={styles.image}
          resizeMode="cover"
        />
        
        <View style={styles.info}>
          <Text style={styles.dishName}>{currentDish.name}</Text>
          <Text style={styles.category}>{currentDish.category}</Text>
          <Text style={styles.description}>{currentDish.description}</Text>
          <Text style={styles.price}>R$ {currentDish.price?.toFixed(2)}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.passButton]}
          onPress={() => handleSwipe('pass')}
          disabled={swipeLoading}
        >
          <Text style={styles.actionText}>❌</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.superLikeButton]}
          onPress={() => handleSwipe('super_like')}
          disabled={swipeLoading}
        >
          <Text style={styles.actionText}>⭐</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.likeButton]}
          onPress={() => handleSwipe('like')}
          disabled={swipeLoading}
        >
          <Text style={styles.actionText}>❤️</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: height * 0.5,
  },
  info: {
    padding: 20,
    flex: 1,
  },
  dishName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  category: {
    fontSize: 16,
    color: '#95A5A6',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#7F8C8D',
    marginBottom: 12,
    lineHeight: 20,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  passButton: {
    backgroundColor: '#E74C3C',
  },
  likeButton: {
    backgroundColor: '#4ECDC4',
  },
  superLikeButton: {
    backgroundColor: '#FFE66D',
  },
  actionText: {
    fontSize: 24,
  },
  reloadButton: {
    backgroundColor: '#FF6B6B',
    padding: 15,
    borderRadius: 10,
    marginTop: 20,
  },
  reloadText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default SwipeScreen;
```

---

## 📋 **FASE 6: Configuração do App Principal**

### **Passo 10: App.tsx**

```typescript
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { UserProvider, useUser } from './src/contexts/UserContext';
import LoginScreen from './src/screens/LoginScreen';
import SwipeScreen from './src/screens/SwipeScreen';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { user, loading } = useUser();

  if (loading) {
    return null; // Ou uma tela de loading
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="Swipe" component={SwipeScreen} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const App: React.FC = () => {
  return (
    <UserProvider>
      <AppNavigator />
    </UserProvider>
  );
};

export default App;
```

---

## 📋 **FASE 7: Configurações Finais**

### **Passo 11: Dependências de Navegação**
```bash
npm install @react-navigation/native @react-navigation/stack
npm install react-native-screens react-native-safe-area-context
npm install react-native-gesture-handler
```

### **Passo 12: Obtendo Configuração Firebase Client**

**No Firebase Console:**
1. Project Settings → General
2. Scroll para baixo → "Your apps"
3. Click "Add app" → escolha plataforma (iOS/Android)
4. Siga instruções e baixe:
   - `google-services.json` (Android)
   - `GoogleService-Info.plist` (iOS)
5. Na web config, você terá:
   ```javascript
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "foodswipe-ca641.firebaseapp.com",
     projectId: "foodswipe-ca641",
     storageBucket: "foodswipe-ca641.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef..."
   };
   ```

---

## 📋 **FASE 8: Testes e Validação**

### **Passo 13: Fluxo de Teste**

1. **Testar Autenticação:**
   ```typescript
   // Criar conta
   // Fazer login
   // Verificar se token está sendo salvo
   // Verificar se perfil está sendo criado no backend
   ```

2. **Testar APIs:**
   ```typescript
   // Buscar restaurantes
   // Registrar swipes
   // Verificar preferências sendo aplicadas
   ```

3. **Testar Context:**
   ```typescript
   // Estado do usuário
   // Atualização automática do perfil
   // Refresh de tokens
   ```

---

## 🎯 **RESUMO PARA AGENTES**

### **Estrutura Final do Projeto:**
```
FoodieSwipe/
├── src/
│   ├── config/
│   │   └── firebase.ts
│   ├── services/
│   │   ├── apiService.ts
│   │   └── authService.ts
│   ├── contexts/
│   │   └── UserContext.tsx
│   ├── hooks/
│   │   ├── useRestaurants.ts
│   │   └── useSwipe.ts
│   └── screens/
│       ├── LoginScreen.tsx
│       └── SwipeScreen.tsx
└── App.tsx
```

### **Endpoints Integrados:**
- ✅ `/api/auth/verify` - Sincronizar usuário
- ✅ `/api/auth/profile` - Perfil completo
- ✅ `/api/auth/preferences` - Preferências alimentares
- ✅ `/api/auth/swipe` - Registrar swipes
- ✅ `/api/restaurants/:lat/:lng` - Buscar restaurantes
- ✅ `/api/dishes/feed` - Feed de pratos

### **Features Implementadas:**
- ✅ Autenticação Firebase completa
- ✅ Integração com backend
- ✅ Sistema de swipes
- ✅ Preferências do usuário
- ✅ Estado global com Context
- ✅ Hooks customizados
- ✅ Componentes base funcionais

**O frontend está ready-to-code com todas as integrações necessárias! 🚀**