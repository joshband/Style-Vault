import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../../../server/logger';

describe('Logger', () => {
  let consoleSpy: {
    debug: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    consoleSpy = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
      info: vi.spyOn(console, 'info').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('log levels', () => {
    it('should log info messages', () => {
      logger.info('Test message');
      expect(consoleSpy.info).toHaveBeenCalled();
      expect(consoleSpy.info.mock.calls[0][0]).toContain('INFO');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('Test message');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');
      expect(consoleSpy.warn).toHaveBeenCalled();
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('WARN');
      expect(consoleSpy.warn.mock.calls[0][0]).toContain('Warning message');
    });

    it('should log error messages', () => {
      logger.error('Error message');
      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.error.mock.calls[0][0]).toContain('ERROR');
      expect(consoleSpy.error.mock.calls[0][0]).toContain('Error message');
    });

    it('should log error with error object', () => {
      const error = new Error('Test error');
      logger.error('Failed operation', error);
      expect(consoleSpy.error).toHaveBeenCalled();
      expect(consoleSpy.error.mock.calls[0][0]).toContain('Failed operation: Test error');
    });
  });

  describe('context formatting', () => {
    it('should include module in output', () => {
      logger.info('Test message', { module: 'TestModule' });
      expect(consoleSpy.info.mock.calls[0][0]).toContain('[TestModule]');
    });

    it('should include operation in output', () => {
      logger.info('Test message', { operation: 'testOp' });
      expect(consoleSpy.info.mock.calls[0][0]).toContain('op=testOp');
    });

    it('should include styleId (truncated) in output', () => {
      logger.info('Test message', { styleId: '12345678-abcd-efgh-ijkl-mnopqrstuvwx' });
      expect(consoleSpy.info.mock.calls[0][0]).toContain('style=12345678');
    });

    it('should include duration in output', () => {
      logger.info('Test message', { duration: 150 });
      expect(consoleSpy.info.mock.calls[0][0]).toContain('duration=150ms');
    });
  });

  describe('child logger', () => {
    it('should create child logger with default context', () => {
      const childLogger = logger.child({ module: 'ChildModule' });
      childLogger.info('Child message');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('[ChildModule]');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('Child message');
    });

    it('should merge context from child and call', () => {
      const childLogger = logger.child({ module: 'ChildModule' });
      childLogger.info('Child message', { operation: 'childOp' });
      expect(consoleSpy.info.mock.calls[0][0]).toContain('[ChildModule]');
      expect(consoleSpy.info.mock.calls[0][0]).toContain('op=childOp');
    });
  });

  describe('timestamp formatting', () => {
    it('should include ISO timestamp in output', () => {
      logger.info('Test message');
      const output = consoleSpy.info.mock.calls[0][0];
      expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
