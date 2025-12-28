"""
Storage Abstraction Layer

Provides pluggable storage backends for:
- Blob storage (images, masks, depth maps)
- Structured data (style artifacts, metadata)
- Vector storage (embeddings for semantic search)
"""

from typing import Dict, Any, Optional, List, BinaryIO, Protocol, runtime_checkable
from dataclasses import dataclass
from abc import ABC, abstractmethod
import json


@dataclass
class StorageConfig:
    """Configuration for storage backends."""
    blob_bucket: str = "visual-dna-blobs"
    structured_database: str = "visual_dna"
    vector_index: str = "style_embeddings"
    region: str = "us-central1"


@runtime_checkable
class BlobStorage(Protocol):
    """Protocol for blob storage operations."""
    
    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        """Upload blob and return URL."""
        ...
    
    async def download(self, key: str) -> Optional[bytes]:
        """Download blob by key."""
        ...
    
    async def delete(self, key: str) -> bool:
        """Delete blob by key."""
        ...
    
    async def exists(self, key: str) -> bool:
        """Check if blob exists."""
        ...
    
    async def get_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        """Get signed URL for blob."""
        ...


@runtime_checkable
class StructuredStorage(Protocol):
    """Protocol for structured data storage."""
    
    async def save_style(self, style_id: str, artifact: Dict[str, Any]) -> bool:
        """Save a style artifact."""
        ...
    
    async def get_style(self, style_id: str) -> Optional[Dict[str, Any]]:
        """Get a style artifact by ID."""
        ...
    
    async def delete_style(self, style_id: str) -> bool:
        """Delete a style artifact."""
        ...
    
    async def list_styles(
        self,
        limit: int = 100,
        offset: int = 0,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """List style artifacts with pagination."""
        ...
    
    async def update_style(
        self,
        style_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        """Update specific fields of a style."""
        ...


@runtime_checkable
class VectorStorage(Protocol):
    """Protocol for vector storage (embeddings)."""
    
    async def upsert(
        self,
        id: str,
        vector: List[float],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Upsert a vector with metadata."""
        ...
    
    async def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        """Search for similar vectors."""
        ...
    
    async def delete(self, id: str) -> bool:
        """Delete a vector by ID."""
        ...
    
    async def get(self, id: str) -> Optional[Dict[str, Any]]:
        """Get vector and metadata by ID."""
        ...


class InMemoryBlobStorage:
    """In-memory blob storage for development/testing."""
    
    def __init__(self):
        self._blobs: Dict[str, bytes] = {}
        self._metadata: Dict[str, Dict[str, str]] = {}
    
    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
        metadata: Optional[Dict[str, str]] = None
    ) -> str:
        self._blobs[key] = data
        self._metadata[key] = {
            "contentType": content_type,
            **(metadata or {})
        }
        return f"memory://{key}"
    
    async def download(self, key: str) -> Optional[bytes]:
        return self._blobs.get(key)
    
    async def delete(self, key: str) -> bool:
        if key in self._blobs:
            del self._blobs[key]
            self._metadata.pop(key, None)
            return True
        return False
    
    async def exists(self, key: str) -> bool:
        return key in self._blobs
    
    async def get_url(self, key: str, expires_in: int = 3600) -> Optional[str]:
        if key in self._blobs:
            return f"memory://{key}"
        return None


class InMemoryStructuredStorage:
    """In-memory structured storage for development/testing."""
    
    def __init__(self):
        self._styles: Dict[str, Dict[str, Any]] = {}
    
    async def save_style(self, style_id: str, artifact: Dict[str, Any]) -> bool:
        self._styles[style_id] = artifact
        return True
    
    async def get_style(self, style_id: str) -> Optional[Dict[str, Any]]:
        return self._styles.get(style_id)
    
    async def delete_style(self, style_id: str) -> bool:
        if style_id in self._styles:
            del self._styles[style_id]
            return True
        return False
    
    async def list_styles(
        self,
        limit: int = 100,
        offset: int = 0,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        styles = list(self._styles.values())
        
        if filters:
            for key, value in filters.items():
                styles = [s for s in styles if s.get(key) == value]
        
        return styles[offset:offset + limit]
    
    async def update_style(
        self,
        style_id: str,
        updates: Dict[str, Any]
    ) -> bool:
        if style_id in self._styles:
            self._styles[style_id].update(updates)
            return True
        return False
    
    async def get_style_depth(self, style_id: str) -> Optional[Dict[str, Any]]:
        """Get depth data for a style."""
        style = self._styles.get(style_id)
        if style:
            return style.get("depth")
        return None


class InMemoryVectorStorage:
    """In-memory vector storage for development/testing."""
    
    def __init__(self):
        self._vectors: Dict[str, Dict[str, Any]] = {}
    
    async def upsert(
        self,
        id: str,
        vector: List[float],
        metadata: Optional[Dict[str, Any]] = None
    ) -> bool:
        self._vectors[id] = {
            "id": id,
            "vector": vector,
            "metadata": metadata or {}
        }
        return True
    
    async def search(
        self,
        query_vector: List[float],
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[Dict[str, Any]]:
        import math
        
        def cosine_similarity(a: List[float], b: List[float]) -> float:
            dot = sum(x * y for x, y in zip(a, b))
            mag_a = math.sqrt(sum(x * x for x in a))
            mag_b = math.sqrt(sum(x * x for x in b))
            if mag_a == 0 or mag_b == 0:
                return 0.0
            return dot / (mag_a * mag_b)
        
        results = []
        for item in self._vectors.values():
            if filters:
                match = all(
                    item["metadata"].get(k) == v
                    for k, v in filters.items()
                )
                if not match:
                    continue
            
            score = cosine_similarity(query_vector, item["vector"])
            results.append({
                "id": item["id"],
                "score": score,
                "metadata": item["metadata"]
            })
        
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
    
    async def delete(self, id: str) -> bool:
        if id in self._vectors:
            del self._vectors[id]
            return True
        return False
    
    async def get(self, id: str) -> Optional[Dict[str, Any]]:
        return self._vectors.get(id)


class UnifiedStorage:
    """Unified storage interface combining all storage types."""
    
    def __init__(
        self,
        blob: Optional[BlobStorage] = None,
        structured: Optional[StructuredStorage] = None,
        vector: Optional[VectorStorage] = None
    ):
        self.blob = blob or InMemoryBlobStorage()
        self.structured = structured or InMemoryStructuredStorage()
        self.vector = vector or InMemoryVectorStorage()
    
    async def save_style_artifact(
        self,
        style_id: str,
        artifact: Dict[str, Any],
        embedding: Optional[List[float]] = None,
        blobs: Optional[Dict[str, bytes]] = None
    ) -> bool:
        """Save a complete style artifact with all associated data."""
        if blobs:
            blob_urls = {}
            for name, data in blobs.items():
                url = await self.blob.upload(
                    f"{style_id}/{name}",
                    data,
                    content_type="image/png"
                )
                blob_urls[name] = url
            artifact["blobUrls"] = blob_urls
        
        await self.structured.save_style(style_id, artifact)
        
        if embedding:
            await self.vector.upsert(
                style_id,
                embedding,
                metadata={
                    "styleId": style_id,
                    "tags": artifact.get("styleSemantics", {}).get("styleTags", [])
                }
            )
        
        return True
    
    async def get_style(self, style_id: str) -> Optional[Dict[str, Any]]:
        """Get a style artifact by ID."""
        return await self.structured.get_style(style_id)
    
    async def search_similar_styles(
        self,
        embedding: List[float],
        top_k: int = 10
    ) -> List[Dict[str, Any]]:
        """Search for similar styles by embedding."""
        return await self.vector.search(embedding, top_k)
    
    async def get_style_depth(self, style_id: str) -> Optional[Dict[str, Any]]:
        """Get depth data for a style."""
        return await self.structured.get_style_depth(style_id)
