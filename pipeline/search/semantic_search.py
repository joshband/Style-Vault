"""
Semantic Search & Recommendation

Provides semantic search capabilities for styles:
- Text-based search using CLIP embeddings
- Similar style retrieval
- Component-based similarity
- Explainable results
"""

from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass, field
import math


@dataclass
class SearchResult:
    """A single search result."""
    style_id: str
    score: float
    metadata: Dict[str, Any]
    explanation: str
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "styleId": self.style_id,
            "score": self.score,
            "metadata": self.metadata,
            "explanation": self.explanation,
        }


@dataclass
class SearchResponse:
    """Response from a search query."""
    query: str
    results: List[SearchResult]
    total_matches: int
    search_time_ms: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "results": [r.to_dict() for r in self.results],
            "totalMatches": self.total_matches,
            "searchTimeMs": self.search_time_ms,
        }


class StyleIndexer:
    """Indexes styles for semantic search."""
    
    def __init__(self, vector_storage):
        self.vector_storage = vector_storage
        self._tag_index: Dict[str, List[str]] = {}
        self._component_index: Dict[str, List[str]] = {}
        self._material_index: Dict[str, List[str]] = {}
    
    async def index_style(
        self,
        style_id: str,
        embedding: List[float],
        tags: List[str],
        components: List[str],
        materials: List[str],
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Index a style for search."""
        await self.vector_storage.upsert(
            style_id,
            embedding,
            metadata={
                "styleId": style_id,
                "tags": tags,
                "components": components,
                "materials": materials,
                **(metadata or {})
            }
        )
        
        for tag in tags:
            if tag not in self._tag_index:
                self._tag_index[tag] = []
            self._tag_index[tag].append(style_id)
        
        for comp in components:
            if comp not in self._component_index:
                self._component_index[comp] = []
            self._component_index[comp].append(style_id)
        
        for mat in materials:
            if mat not in self._material_index:
                self._material_index[mat] = []
            self._material_index[mat].append(style_id)
    
    def get_styles_by_tag(self, tag: str) -> List[str]:
        """Get all style IDs with a specific tag."""
        return self._tag_index.get(tag, [])
    
    def get_styles_by_component(self, component: str) -> List[str]:
        """Get all style IDs with a specific component type."""
        return self._component_index.get(component, [])
    
    def get_styles_by_material(self, material: str) -> List[str]:
        """Get all style IDs with a specific material."""
        return self._material_index.get(material, [])


class SemanticSearchEngine:
    """
    Semantic search engine for styles.
    
    Capabilities:
    - Text-based search using embeddings
    - Similar style retrieval
    - Component-based similarity
    - Tag-based filtering
    - Explainable results
    """
    
    def __init__(
        self,
        vector_storage,
        structured_storage,
        indexer: Optional[StyleIndexer] = None
    ):
        self.vector_storage = vector_storage
        self.structured_storage = structured_storage
        self.indexer = indexer or StyleIndexer(vector_storage)
        self._embedding_cache: Dict[str, List[float]] = {}
    
    async def text_to_embedding(self, text: str) -> List[float]:
        """
        Convert text query to embedding vector.
        
        In production, this would use CLIP or similar model.
        For now, returns a simple hash-based pseudo-embedding.
        """
        import hashlib
        
        hash_bytes = hashlib.sha256(text.encode()).digest()
        embedding = [float(b) / 255.0 for b in hash_bytes[:512]]
        
        norm = math.sqrt(sum(x * x for x in embedding))
        if norm > 0:
            embedding = [x / norm for x in embedding]
        
        return embedding
    
    async def search(
        self,
        query: str,
        top_k: int = 10,
        filters: Optional[Dict[str, Any]] = None
    ) -> SearchResponse:
        """
        Search for styles matching a text query.
        
        Args:
            query: Natural language search query (e.g., "dark, glossy audio UI")
            top_k: Number of results to return
            filters: Optional filters (tags, components, materials)
        
        Returns:
            SearchResponse with ranked results and explanations
        """
        import time
        start_time = time.time()
        
        query_embedding = await self.text_to_embedding(query)
        
        raw_results = await self.vector_storage.search(
            query_embedding,
            top_k=top_k * 2,
            filters=filters
        )
        
        results = []
        for raw in raw_results[:top_k]:
            explanation = self._generate_explanation(query, raw["metadata"])
            
            results.append(SearchResult(
                style_id=raw["id"],
                score=round(raw["score"], 3),
                metadata=raw["metadata"],
                explanation=explanation
            ))
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        return SearchResponse(
            query=query,
            results=results,
            total_matches=len(raw_results),
            search_time_ms=search_time_ms
        )
    
    async def find_similar(
        self,
        style_id: str,
        top_k: int = 10
    ) -> SearchResponse:
        """
        Find styles similar to a given style.
        
        Args:
            style_id: ID of the reference style
            top_k: Number of similar styles to return
        
        Returns:
            SearchResponse with similar styles
        """
        import time
        start_time = time.time()
        
        reference = await self.vector_storage.get(style_id)
        if not reference:
            return SearchResponse(
                query=f"similar:{style_id}",
                results=[],
                total_matches=0,
                search_time_ms=0
            )
        
        raw_results = await self.vector_storage.search(
            reference["vector"],
            top_k=top_k + 1
        )
        
        raw_results = [r for r in raw_results if r["id"] != style_id][:top_k]
        
        results = []
        for raw in raw_results:
            explanation = self._generate_similarity_explanation(
                reference["metadata"],
                raw["metadata"]
            )
            
            results.append(SearchResult(
                style_id=raw["id"],
                score=round(raw["score"], 3),
                metadata=raw["metadata"],
                explanation=explanation
            ))
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        return SearchResponse(
            query=f"similar:{style_id}",
            results=results,
            total_matches=len(results),
            search_time_ms=search_time_ms
        )
    
    async def search_by_components(
        self,
        components: List[str],
        top_k: int = 10
    ) -> SearchResponse:
        """
        Search for styles containing specific components.
        
        Args:
            components: List of component types (e.g., ["card", "button"])
            top_k: Number of results to return
        
        Returns:
            SearchResponse with matching styles
        """
        import time
        start_time = time.time()
        
        matching_styles: Dict[str, int] = {}
        
        for comp in components:
            style_ids = self.indexer.get_styles_by_component(comp)
            for sid in style_ids:
                matching_styles[sid] = matching_styles.get(sid, 0) + 1
        
        ranked = sorted(
            matching_styles.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_k]
        
        results = []
        for style_id, match_count in ranked:
            score = match_count / len(components)
            
            style_data = await self.vector_storage.get(style_id)
            metadata = style_data["metadata"] if style_data else {}
            
            results.append(SearchResult(
                style_id=style_id,
                score=round(score, 3),
                metadata=metadata,
                explanation=f"Matches {match_count}/{len(components)} requested components"
            ))
        
        search_time_ms = int((time.time() - start_time) * 1000)
        
        return SearchResponse(
            query=f"components:{','.join(components)}",
            results=results,
            total_matches=len(matching_styles),
            search_time_ms=search_time_ms
        )
    
    def _generate_explanation(
        self,
        query: str,
        metadata: Dict[str, Any]
    ) -> str:
        """Generate explanation for why a style matched a query."""
        tags = metadata.get("tags", [])
        components = metadata.get("components", [])
        
        query_words = set(query.lower().split())
        
        matching_tags = [t for t in tags if any(w in t.lower() for w in query_words)]
        matching_comps = [c for c in components if any(w in c.lower() for w in query_words)]
        
        reasons = []
        if matching_tags:
            reasons.append(f"tags: {', '.join(matching_tags[:3])}")
        if matching_comps:
            reasons.append(f"components: {', '.join(matching_comps[:3])}")
        
        if reasons:
            return "Matched " + "; ".join(reasons)
        return "Semantic similarity match"
    
    def _generate_similarity_explanation(
        self,
        ref_metadata: Dict[str, Any],
        match_metadata: Dict[str, Any]
    ) -> str:
        """Generate explanation for why two styles are similar."""
        ref_tags = set(ref_metadata.get("tags", []))
        match_tags = set(match_metadata.get("tags", []))
        shared_tags = ref_tags & match_tags
        
        ref_comps = set(ref_metadata.get("components", []))
        match_comps = set(match_metadata.get("components", []))
        shared_comps = ref_comps & match_comps
        
        reasons = []
        if shared_tags:
            reasons.append(f"shared tags: {', '.join(list(shared_tags)[:3])}")
        if shared_comps:
            reasons.append(f"shared components: {', '.join(list(shared_comps)[:3])}")
        
        if reasons:
            return "Similar " + "; ".join(reasons)
        return "Visual similarity in embedding space"


async def create_search_engine(storage) -> SemanticSearchEngine:
    """Factory function to create a search engine."""
    indexer = StyleIndexer(storage.vector)
    return SemanticSearchEngine(
        vector_storage=storage.vector,
        structured_storage=storage.structured,
        indexer=indexer
    )
