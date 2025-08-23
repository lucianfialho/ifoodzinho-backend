const express = require('express');
const app = express();

// Middleware básico
app.use(express.json());

// Endpoint de teste
app.get('/api/restaurants/:lat/:lng', (req, res) => {
  console.log('✅ Endpoint chamado!', req.params);
  res.json({ 
    message: 'Endpoint funcionando!', 
    params: req.params 
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.listen(3001, () => {
  console.log('🔧 Test server rodando na porta 3001');
});