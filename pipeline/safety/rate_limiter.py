"""
Rate Limiting

Protects the API from abuse with configurable rate limits.
"""

from typing import Dict, Any, Optional
from dataclasses import dataclass
import time
from collections import defaultdict


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    requests_per_minute: int = 60
    requests_per_hour: int = 1000
    burst_limit: int = 10
    window_seconds: int = 60


@dataclass
class RateLimitResult:
    """Result of a rate limit check."""
    allowed: bool
    remaining: int
    reset_at: float
    retry_after: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "allowed": self.allowed,
            "remaining": self.remaining,
            "resetAt": self.reset_at,
        }
        if self.retry_after:
            result["retryAfter"] = self.retry_after
        return result


class RateLimiter:
    """Base class for rate limiters."""
    
    def check(self, key: str) -> RateLimitResult:
        raise NotImplementedError
    
    def consume(self, key: str, tokens: int = 1) -> RateLimitResult:
        raise NotImplementedError
    
    def reset(self, key: str) -> None:
        raise NotImplementedError


class InMemoryRateLimiter(RateLimiter):
    """In-memory sliding window rate limiter."""
    
    def __init__(self, config: Optional[RateLimitConfig] = None):
        self.config = config or RateLimitConfig()
        self._buckets: Dict[str, list] = defaultdict(list)
    
    def _clean_bucket(self, key: str, now: float) -> None:
        """Remove expired entries from bucket."""
        window_start = now - self.config.window_seconds
        self._buckets[key] = [
            ts for ts in self._buckets[key]
            if ts > window_start
        ]
    
    def check(self, key: str) -> RateLimitResult:
        """Check if a request is allowed without consuming a token."""
        now = time.time()
        self._clean_bucket(key, now)
        
        current_count = len(self._buckets[key])
        remaining = max(0, self.config.requests_per_minute - current_count)
        reset_at = now + self.config.window_seconds
        
        if current_count >= self.config.requests_per_minute:
            oldest = min(self._buckets[key]) if self._buckets[key] else now
            retry_after = oldest + self.config.window_seconds - now
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_at=reset_at,
                retry_after=max(0, retry_after)
            )
        
        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_at=reset_at
        )
    
    def consume(self, key: str, tokens: int = 1) -> RateLimitResult:
        """Consume tokens and check if request is allowed."""
        result = self.check(key)
        
        if result.allowed:
            now = time.time()
            for _ in range(tokens):
                self._buckets[key].append(now)
            result.remaining = max(0, result.remaining - tokens)
        
        return result
    
    def reset(self, key: str) -> None:
        """Reset the rate limit for a key."""
        if key in self._buckets:
            del self._buckets[key]


class EndpointRateLimiter:
    """Rate limiter with per-endpoint configuration."""
    
    def __init__(self, default_config: Optional[RateLimitConfig] = None):
        self.default_config = default_config or RateLimitConfig()
        self._limiters: Dict[str, InMemoryRateLimiter] = {}
        self._configs: Dict[str, RateLimitConfig] = {}
    
    def configure_endpoint(self, endpoint: str, config: RateLimitConfig):
        """Configure rate limit for a specific endpoint."""
        self._configs[endpoint] = config
        self._limiters[endpoint] = InMemoryRateLimiter(config)
    
    def check(self, key: str, endpoint: str) -> RateLimitResult:
        """Check rate limit for a key+endpoint combination."""
        limiter = self._get_limiter(endpoint)
        return limiter.check(f"{key}:{endpoint}")
    
    def consume(self, key: str, endpoint: str, tokens: int = 1) -> RateLimitResult:
        """Consume tokens for a key+endpoint combination."""
        limiter = self._get_limiter(endpoint)
        return limiter.consume(f"{key}:{endpoint}", tokens)
    
    def _get_limiter(self, endpoint: str) -> InMemoryRateLimiter:
        """Get or create limiter for endpoint."""
        if endpoint not in self._limiters:
            config = self._configs.get(endpoint, self.default_config)
            self._limiters[endpoint] = InMemoryRateLimiter(config)
        return self._limiters[endpoint]


def rate_limit_middleware(limiter: RateLimiter, key_fn):
    """
    Create rate limiting middleware.
    
    Args:
        limiter: Rate limiter instance
        key_fn: Function to extract rate limit key from request
    
    Returns:
        Middleware function
    """
    def middleware(handler):
        async def wrapped(request, *args, **kwargs):
            key = key_fn(request)
            result = limiter.consume(key)
            
            if not result.allowed:
                return {
                    "error": "Rate limit exceeded",
                    "retryAfter": result.retry_after,
                    "status": 429
                }
            
            response = await handler(request, *args, **kwargs)
            
            return response
        
        return wrapped
    return middleware
