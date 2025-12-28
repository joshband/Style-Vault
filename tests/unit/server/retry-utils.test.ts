import { describe, it, expect, vi } from 'vitest';
import { withImageGenRetry } from '../../../server/retry-utils';

describe('Retry Utils', () => {
  describe('withImageGenRetry', () => {
    it('should return result on first successful attempt', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const result = await withImageGenRetry(mockFn, 'test-operation');
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const mockFn = vi.fn()
        .mockRejectedValueOnce(new Error('rate limit exceeded'))
        .mockResolvedValueOnce('success');
      
      const result = await withImageGenRetry(mockFn, 'test-operation');
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-retryable errors', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Invalid API key'));
      
      await expect(withImageGenRetry(mockFn, 'test-operation')).rejects.toThrow('Invalid API key');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
