# 🤖 **INSTRUÇÕES PARA AGENTES FRONTEND**

## 🎯 **MISSÃO PRINCIPAL**
Implementar frontend React Native do FoodieSwipe com integração Firebase completa ao backend existente.

---

## 📋 **CONTEXTO DO PROJETO**

### **Backend Status:** ✅ **COMPLETO E FUNCIONANDO**
- Firebase Auth integrado
- 8 endpoints de autenticação prontos
- APIs do iFood funcionando com filtros de usuário
- Sistema de swipes, matches e preferências
- Database: `foodswipe-ca641` no Firebase

### **URL do Backend:** `http://localhost:3001`

### **Endpoints Disponíveis:**
```
POST /api/auth/verify         - Criar/verificar usuário
GET  /api/auth/profile        - Buscar perfil
PUT  /api/auth/preferences    - Atualizar preferências
PUT  /api/auth/profile        - Atualizar perfil  
POST /api/auth/swipe          - Registrar swipe
GET  /api/auth/swipe-history  - Histórico
GET  /api/auth/matches        - Matches
GET  /api/auth/stats          - Estatísticas
GET  /api/restaurants/:lat/:lng - Restaurantes (com filtros automáticos)
POST /api/dishes/feed         - Feed de pratos para swipe
```

---

## 🎯 **OBJETIVOS ESPECÍFICOS PARA AGENTES**

### **AGENTE 1: Setup & Configuração**
**Responsabilidade:** Inicializar projeto e configurar Firebase

**Tarefas:**
1. ✅ Criar projeto React Native (Expo ou CLI)
2. ✅ Instalar dependências Firebase e navegação
3. ✅ Configurar Firebase client com as credenciais do projeto `foodswipe-ca641`
4. ✅ Setup da estrutura de pastas conforme guia
5. ✅ Verificar conexão com backend local

**Entregáveis:**
- Projeto inicializado
- Firebase conectado
- Estrutura de pastas criada
- Teste de conexão com backend

---

### **AGENTE 2: Services & APIs**
**Responsabilidade:** Implementar serviços de API e autenticação

**Tarefas:**
1. ✅ Implementar `apiService.ts` com todos os endpoints
2. ✅ Implementar `authService.ts` com Firebase Auth
3. ✅ Sistema de tokens e refresh automático
4. ✅ Tratamento de erros e offline
5. ✅ Validação de todas as integrações

**Entregáveis:**
- `src/services/apiService.ts` funcionando
- `src/services/authService.ts` funcionando  
- Integração testada com todos os endpoints
- Sistema de tokens robusto

---

### **AGENTE 3: State Management**
**Responsabilidade:** Context, hooks e gerenciamento de estado

**Tarefas:**
1. ✅ Implementar `UserContext.tsx` completo
2. ✅ Criar hooks customizados (`useRestaurants`, `useSwipe`, etc)
3. ✅ Gerenciamento de estado global
4. ✅ Sincronização automática com backend
5. ✅ Otimizações de performance

**Entregáveis:**
- `src/contexts/UserContext.tsx`
- `src/hooks/` com hooks funcionais
- Estado global funcionando
- Sincronização automática

---

### **AGENTE 4: UI Components**
**Responsabilidade:** Telas e componentes principais

**Tarefas:**
1. ✅ Implementar `LoginScreen.tsx` com registro/login
2. ✅ Implementar `SwipeScreen.tsx` funcional
3. ✅ Componentes base (Card, Button, etc)
4. ✅ Navegação entre telas
5. ✅ Design system básico

**Entregáveis:**
- Tela de login/registro funcional
- Tela de swipe com integração real
- Componentes reutilizáveis
- Navegação configurada

---

### **AGENTE 5: Features Avançadas**
**Responsabilidade:** Funcionalidades específicas e otimizações

**Tarefas:**
1. ✅ Tela de preferências alimentares
2. ✅ Tela de perfil do usuário
3. ✅ Histórico de swipes e matches
4. ✅ Sistema de geolocalização
5. ✅ Push notifications (básico)

**Entregáveis:**
- Telas de preferências e perfil
- Funcionalidades de histórico
- Geolocalização integrada
- Notificações funcionando

---

## 🛠️ **CONFIGURAÇÕES NECESSÁRIAS**

### **Firebase Project ID:** `foodswipe-ca641`

### **Configuração Firebase Client:**
```typescript
const firebaseConfig = {
  apiKey: "OBTER_DO_FIREBASE_CONSOLE",
  authDomain: "foodswipe-ca641.firebaseapp.com", 
  projectId: "foodswipe-ca641",
  storageBucket: "foodswipe-ca641.appspot.com",
  messagingSenderId: "OBTER_DO_CONSOLE",
  appId: "OBTER_DO_CONSOLE"
};
```

**🔑 Para obter as configurações:**
1. Firebase Console → Project Settings → General
2. Your apps → Add app → Web/iOS/Android
3. Copy config object

### **Backend URL:**
```typescript
const BASE_URL = 'http://localhost:3001'; // Dev
const BASE_URL = 'https://your-backend.herokuapp.com'; // Prod
```

---

## 📱 **FLUXO DA APLICAÇÃO**

### **1. Autenticação:**
```
Login/Register → Firebase Auth → Backend Sync → UserContext
```

### **2. Swipe Flow:**
```
Load Restaurants → Get Dishes → Swipe → Record to Backend → Update Stats
```

### **3. User Preferences:**
```
Set Preferences → Save to Backend → Auto-apply Filters → Better Recommendations
```

---

## ✅ **CRITÉRIOS DE SUCESSO**

### **Funcionalidades Obrigatórias:**
- [ ] Login/Register funcionando
- [ ] Autenticação Firebase integrada
- [ ] Sistema de swipe operacional
- [ ] Preferências sendo aplicadas
- [ ] Perfil do usuário completo
- [ ] Integração com todas as APIs do backend
- [ ] Interface responsiva e intuitiva

### **Integrações Obrigatórias:**
- [ ] Todos os 8 endpoints de auth testados
- [ ] API de restaurantes com filtros
- [ ] API de dishes/feed funcionando
- [ ] Sistema de tokens e refresh
- [ ] Sincronização automática de dados
- [ ] Tratamento de erros robusto

### **Performance:**
- [ ] Loading states adequados
- [ ] Cache de dados local
- [ ] Otimização de imagens
- [ ] Navegação fluida
- [ ] Sem memory leaks

---

## 🚨 **PONTOS CRÍTICOS**

### **⚠️ Autenticação:**
- **SEMPRE** usar tokens Firebase válidos
- **SEMPRE** sincronizar com backend após login
- **SEMPRE** tratar expiração de tokens
- **NUNCA** expor credenciais no código

### **⚠️ APIs:**
- **SEMPRE** verificar se backend está rodando
- **SEMPRE** tratar erros de rede
- **SEMPRE** mostrar loading states
- **NUNCA** fazer requisições sem tratamento

### **⚠️ Estado:**
- **SEMPRE** usar Context para estado global
- **SEMPRE** manter dados sincronizados
- **SEMPRE** limpar estado no logout
- **NUNCA** deixar estado inconsistente

---

## 📞 **DEBUGGING & SUPORTE**

### **Testar Backend:**
```bash
curl http://localhost:3001/health
# Deve retornar: {"status":"OK",...}
```

### **Testar Autenticação:**
```bash
# No Firebase Console → Authentication → Users
# Verificar se usuários estão sendo criados
```

### **Testar APIs:**
```bash
# Usar token real do Firebase
curl -H "Authorization: Bearer TOKEN_AQUI" http://localhost:3001/api/auth/profile
```

### **Logs Importantes:**
- Console do React Native para erros de cliente
- Terminal do backend para erros de API
- Firebase Console para erros de autenticação
- Network tab para debugging de requests

---

## 🎯 **RESULTADO ESPERADO**

### **App Final Funcional Com:**
✅ Sistema de login/registro completo
✅ Tela de swipe com pratos reais do iFood
✅ Filtros automáticos baseados em preferências
✅ Perfil de usuário editável
✅ Histórico de swipes e matches
✅ Estatísticas do usuário
✅ Interface polida e responsiva
✅ Integração 100% com backend Firebase

### **Pronto para:**
- Testes com usuários reais
- Features sociais (grupos, amigos)
- Deploy em app stores
- Expansão de funcionalidades

---

## 🚀 **COMEÇAR AGORA!**

**Cada agente deve:**
1. Ler o `FRONTEND_INTEGRATION_GUIDE.md` completo
2. Implementar sua parte específica
3. Testar integração com backend
4. Validar com outros agentes
5. Entregar funcionalidade completa

**O backend está pronto e funcionando. Agora é só implementar o frontend! 🎯**