
/**
 * Abstração para telemetria (Sentry/LogRocket/Google Analytics)
 * Substitui o uso direto de console.error em produção.
 */
export const Telemetry = {
  log: (message: string, data?: any) => {
    // Em produção, enviaria para um serviço de agregação de logs
    console.log(`[LOG] ${message}`, data || '');
  },

  error: (error: Error | string, context?: any) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error;
    
    // Simulação de envio para o Sentry
    console.error(`[TELEMETRIA-ERRO] ${errorObj.message}`, {
      stack: errorObj.stack,
      context,
      timestamp: new Date().toISOString()
    });

    // Aqui poderíamos chamar Sentry.captureException(errorObj);
  },

  trackAction: (actionName: string, properties?: any) => {
    // Simulação de rastreamento de evento (Mixpanel/Amplitude)
    console.debug(`[EVENTO] ${actionName}`, properties);
  }
};
