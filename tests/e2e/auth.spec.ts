
/**
 * Teste E2E - Playwright
 * Simula o fluxo crítico do usuário: Login -> Dashboard
 */
import { test, expect } from '@playwright/test';

test.describe('Autenticação de Usuário', () => {
  test('deve realizar login com credenciais master e redirecionar para o dashboard', async ({ page }) => {
    await page.goto('/');
    
    // Preenche credenciais permanentes
    await page.fill('input[placeholder*="ADMCat"]', 'ADMCat');
    await page.fill('input[type="password"]', 'AgCat171++**');
    
    // Clica em entrar
    await page.click('button[type="submit"]');
    
    // Verifica se a sessão foi iniciada (o nome do mockUser master é "Administrador Master")
    await expect(page.locator('text=Administrador Master')).toBeVisible();
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('deve exibir mensagem de erro para credenciais inválidas', async ({ page }) => {
    await page.goto('/');
    await page.fill('input[placeholder*="ADMCat"]', 'USUARIO_INVALIDO');
    await page.fill('input[type="password"]', 'SENHA_ERRADA');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Credenciais inválidas')).toBeVisible();
  });
});
