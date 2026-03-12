
/**
 * Testes Unitários para ragEngine.ts
 * Executável via jest
 */
import { searchKB, buildRAGContext } from '../../services/ragEngine';
import { Document } from '../../types';

// Fix: Declare test runner globals to resolve 'Cannot find name' errors for describe, test, and expect
declare const describe: any;
declare const test: any;
declare const expect: any;

const mockDocs: Document[] = [
  { 
    id: '1', 
    tenantId: 'T1', 
    fileName: 'Manual de Protesto.pdf', 
    rawText: 'Requisitos para o protesto de títulos...', 
    category: 'Manual', 
    uploadedAt: '', 
    fileSize: 100,
    uploadedBy: 'U1',
    storagePath: 'path/1'
  },
  { 
    id: '2', 
    tenantId: 'T1', 
    fileName: 'Provimento 100.pdf', 
    rawText: 'Dispõe sobre o divórcio extrajudicial...', 
    category: 'Provimento', 
    uploadedAt: '', 
    fileSize: 100,
    uploadedBy: 'U1',
    storagePath: 'path/2'
  }
];

describe('RAG Engine Logic', () => {
  test('should find documents by keyword', () => {
    const results = searchKB('protesto', mockDocs);
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('1');
  });

  test('should be case insensitive', () => {
    const results = searchKB('PROTESTO', mockDocs);
    expect(results.length).toBe(1);
  });

  test('should return empty array for non-matching query', () => {
    const results = searchKB('casamento', mockDocs);
    expect(results.length).toBe(0);
  });

  test('buildRAGContext should format correctly', () => {
    const context = buildRAGContext([mockDocs[0]]);
    expect(context).toContain('[FONTE: Manual de Protesto.pdf]');
  });
});
