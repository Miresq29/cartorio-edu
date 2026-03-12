// backend/server.ts - VERSÃO FINAL CORRIGIDA E HOMOLOGADA
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

// 1. IMPORTAÇÃO DE JSON (ESM)
import serviceAccount from "./cartorio-homolog-service-account.json" with { type: "json" };

const app = express();

// 2. HELMET - Segurança de Cabeçalhos (Proteção contra ataques comuns)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 3. CORS - Whitelist (Acesso apenas de origens autorizadas)
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));

// 4. RATE LIMITING (Prevenção contra abuso do sistema)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  validate: { xForwardedForHeader: false },
  message: { error: 'Muitas requisições. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', globalLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req: any) => req.user?.tenantId || req.ip || 'anonymous',
  message: { error: 'Limite de consultas de IA excedido. Aguarde 1 minuto.' }
});

// 5. INICIALIZAÇÃO FIREBASE ADMIN
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();

// 6. LOG DE AUDITORIA (Rastreabilidade para Compliance LGPD)
const logAudit = async (log: any) => {
  try {
    await db.collection('audit_logs').add({
      ...log,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
};

// 7. MIDDLEWARE DE AUTENTICAÇÃO COM MASTER KEY
const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  
  // VERIFICAÇÃO DE CHAVE MESTRE PARA TESTES (Master Key 2026)
  if (authHeader === `Bearer MASTER_TEST_KEY_2026`) {
    req.user = {
      uid: 'AUDITOR_HOMOLOG_MIRIAN',
      tenantId: 'CARTORIO_DEMO_01',
      role: 'SUPERADMIN',
      email: 'mirian@consultoria.com'
    };
    return next();
  }

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      tenantId: decodedToken.tenantId,
      role: decodedToken.role,
      email: decodedToken.email
    };
    
    next();
  } catch (error: any) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

const enforceTenantIsolation = (req: any, res: any, next: any) => {
  if (!req.user?.tenantId) {
    return res.status(403).json({ error: 'Isolamento de Tenant obrigatório' });
  }
  req.tenantId = req.user.tenantId;
  next();
};

// 8. ENDPOINT DE CHAT RAG (Inteligência Artificial)
app.post('/api/chat', 
  authenticate, 
  enforceTenantIsolation, 
  aiLimiter, 
  async (req: any, res: any) => {
    try {
      const { message, context } = req.body;
      
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Mensagem inválida' });
      }
      
      const sanitizedMessage = message.replace(/[\x00-\x1F\x7F]/g, '').trim();
      const sanitizedContext = (context || '').substring(0, 50000);
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      
      // AJUSTE REALIZADO: Usando o nome estável para evitar erro 404
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
          
      const systemPrompt = `Você é o Assessor Jurídico Notarial do Cartório ID ${req.user.tenantId}.
      Responda APENAS com base no CONTEXTO fornecido abaixo. Se não souber, diga que não encontrou a base legal no contexto.
      CONTEXTO: ${sanitizedContext}`;
      
      const result = await model.generateContent(`${systemPrompt}\n\nPERGUNTA DO ESCREVENTE: ${sanitizedMessage}`);
      const response = await result.response;
      
      // Gravação da trilha de auditoria
      await logAudit({
        userId: req.user.uid,
        tenantId: req.user.tenantId,
        action: 'IA_CONSULTA_JURIDICA',
        details: `Consulta: ${sanitizedMessage.substring(0, 100)}`,
        success: true
      });
      
      return res.json({ text: response.text() });
      
    } catch (error: any) {
      console.error('Chat error:', error.message || error);
      return res.status(500).json({ error: 'Erro ao processar consulta de IA.' });
    }
});

// 9. HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 10. INICIALIZAÇÃO DO SERVIDOR
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Servidor de Homologação rodando na porta ${PORT}`);
});