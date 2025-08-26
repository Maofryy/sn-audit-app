import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isServiceNowEnvironment, getServiceNowGlobals } from '../environment';

describe('Environment Utils', () => {
  beforeEach(() => {
    
    // Reset global objects
    delete (global as any).window;
    delete (global as any).g_ck;
    delete (global as any).NOW;
  });

  describe('isServiceNowEnvironment', () => {
    it('returns false when no ServiceNow globals are present', () => {
      expect(isServiceNowEnvironment()).toBe(false);
    });

    it('returns true when g_ck global is present', () => {
      (global as any).g_ck = 'test-session-token';
      expect(isServiceNowEnvironment()).toBe(true);
    });

    it('returns true when NOW global is present', () => {
      (global as any).NOW = { user: { userID: 'test' } };
      expect(isServiceNowEnvironment()).toBe(true);
    });

    it('returns true when window.g_ck is present', () => {
      (global as any).window = { g_ck: 'test-session-token' };
      expect(isServiceNowEnvironment()).toBe(true);
    });

    it('caches the result', () => {
      const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // First call
      expect(isServiceNowEnvironment()).toBe(false);
      
      // Add ServiceNow global
      (global as any).g_ck = 'test-token';
      
      // Second call should still return false due to caching
      expect(isServiceNowEnvironment()).toBe(false);
      
      spy.mockRestore();
    });
  });

  describe('getServiceNowGlobals', () => {
    it('returns empty object when no globals are present', () => {
      const globals = getServiceNowGlobals();
      expect(globals).toEqual({});
    });

    it('returns g_ck when present', () => {
      (global as any).g_ck = 'test-session-token';
      const globals = getServiceNowGlobals();
      expect(globals.g_ck).toBe('test-session-token');
    });

    it('returns NOW object when present', () => {
      const nowObject = { user: { userID: 'test-user' } };
      (global as any).NOW = nowObject;
      const globals = getServiceNowGlobals();
      expect(globals.NOW).toEqual(nowObject);
    });

    it('prefers window globals over direct globals', () => {
      (global as any).g_ck = 'direct-token';
      (global as any).window = { g_ck: 'window-token' };
      
      const globals = getServiceNowGlobals();
      expect(globals.g_ck).toBe('window-token');
    });
  });
});