// Test script to verify environment detection logic
// This file can be used to test different environment scenarios

import { detectEnvironment, getEnvironmentConfig, getEnvironmentInfo } from './environment';

export function testEnvironmentDetection() {
  console.group('🧪 Environment Detection Test');
  
  const environment = detectEnvironment();
  const config = getEnvironmentConfig();
  const info = getEnvironmentInfo();
  
  console.log('📊 Detection Results:');
  console.log('Environment:', environment);
  console.log('Is Production:', config.isProduction);
  console.log('Is Development:', config.isDevelopment);
  console.log('Use Session Auth:', config.useSessionAuth);
  console.log('Base URL:', config.baseUrl);
  
  console.log('\n🔍 Environment Indicators:');
  console.log('Vite DEV mode:', import.meta.env.DEV);
  console.log('Vite ENV_MODE:', import.meta.env.VITE_ENV_MODE);
  console.log('Has ServiceNow globals:', info.hasServiceNowGlobals);
  console.log('Hostname:', info.hostname);
  console.log('Has credentials:', info.hasCredentials);
  
  console.log('\n🎯 Expected Behavior:');
  if (import.meta.env.DEV) {
    console.log('✅ Dev mode: Should use basic auth from .env');
  } else if (info.hasServiceNowGlobals) {
    console.log('✅ Production mode: Should use ServiceNow session token (g_ck)');
  } else {
    console.log('✅ Built app outside ServiceNow: Should fallback to basic auth from .env');
  }
  
  console.groupEnd();
  
  return {
    environment,
    config,
    info,
    isCorrect: validateEnvironmentDetection(environment, config, info)
  };
}

function validateEnvironmentDetection(environment: string, config: Record<string, unknown>, info: Record<string, unknown>): boolean {
  // Validate the environment detection logic
  if (import.meta.env.DEV && environment !== 'development') {
    console.error('❌ Error: Dev mode should always be development environment');
    return false;
  }
  
  if (!import.meta.env.DEV && info.hasServiceNowGlobals && environment !== 'production') {
    console.error('❌ Error: ServiceNow environment should be production mode');
    return false;
  }
  
  if (config.useSessionAuth && !config.isProduction) {
    console.error('❌ Error: Session auth should only be used in production mode');
    return false;
  }
  
  console.log('✅ Environment detection is working correctly');
  return true;
}

// Export for use in development console
if (typeof window !== 'undefined') {
  // @ts-expect-error - Adding to window for debugging
  window.testEnvironment = testEnvironmentDetection;
}