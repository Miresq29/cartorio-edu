// backend/server.ts - VERSÃO OTIMIZADA (tokens reduzidos)
// CORREÇÕES APLICADAS:
//   1. Modelo corrigido: gemini-3-flash-preview → gemini-2.0-flash (modelo inexistente eliminado)
//   2. sanitizedContext: substring(0,50000) → substring(0,5000) (-90% input tokens)
//   3. Adicionado maxOutputTokens: 1000 na chamada generateContent
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

import serviceAccount from "./cartorio-homolog-service-account.json" with { type: "json" };

const app = express();

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
  windowMs: 60 * 1000,
  max: 10,
  validate: { xForwardedForHeader: false },
  keyGenerator: (req: any) => req.user?.tenantId || req.ip || 'anonymous',
  message: { error: 'Limite de consultas de IA excedido. Aguarde 1 minuto.' }
});

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as any),
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

const db = admin.firestore();

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

const authenticate = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }
  
  try {
    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token, true);
    
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

// ─────────────────────────────────────────────────────────────────────────────
// ENDPOINT DE CHAT RAG
// CORREÇÃO 1: modelo "gemini-3-flash-preview" → "gemini-2.0-flash" (modelo real)
// CORREÇÃO 2: contexto 50.000 → 5.000 chars (~90% menos tokens de input)
// CORREÇÃO 3: adicionado maxOutputTokens: 1000
// ─────────────────────────────────────────────────────────────────────────────
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

      // ✅ CORRIGIDO: era substring(0, 50000) — 12.500 tokens desnecessários
      // Contexto jurídico de 5.000 chars é suficiente para consultas notariais
      const sanitizedContext = (context || '').substring(0, 5000);
      
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
      
      // ✅ CORRIGIDO: "gemini-3-flash-preview" não existe — causa erro 404 em 100% das chamadas
      // Modelo correto: gemini-2.0-flash (estável, custo-benefício alto)
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        generationConfig: {
          maxOutputTokens: 1000, // ✅ ADICIONADO: era ilimitado (usava o default 8192)
          temperature: 0.2,
        }
      });
          
      const systemPrompt = `Você é o Assessor Jurídico Notarial do Cartório ID ${req.user.tenantId}.
      Responda APENAS com base no CONTEXTO fornecido abaixo. Se não souber, diga que não encontrou a base legal no contexto.
      CONTEXTO: ${sanitizedContext}`;
      
      const result = await model.generateContent(`${systemPrompt}\n\nPERGUNTA DO ESCREVENTE: ${sanitizedMessage}`);
      const response = await result.response;
      
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

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});