"""
File and Input Validators

Security-focused validation for uploaded files and inputs.
"""

from typing import Dict, Any, Optional, List, Tuple
from dataclasses import dataclass
import os
import re
import hashlib


ALLOWED_IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}
ALLOWED_MIME_TYPES = {
    'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/bmp'
}

MAX_FILE_SIZE_MB = 50
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024

PNG_MAGIC = b'\x89PNG\r\n\x1a\n'
JPEG_MAGIC = b'\xff\xd8\xff'
GIF_MAGIC = b'GIF8'
WEBP_MAGIC = b'RIFF'
BMP_MAGIC = b'BM'


@dataclass
class FileValidationResult:
    """Result of file validation."""
    valid: bool
    file_type: Optional[str] = None
    file_size: int = 0
    errors: List[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        self.errors = self.errors or []
        self.warnings = self.warnings or []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "fileType": self.file_type,
            "fileSize": self.file_size,
            "errors": self.errors,
            "warnings": self.warnings,
        }


def detect_file_type(data: bytes) -> Optional[str]:
    """Detect file type from magic bytes."""
    if len(data) < 8:
        return None
    
    if data[:8] == PNG_MAGIC:
        return "image/png"
    elif data[:3] == JPEG_MAGIC:
        return "image/jpeg"
    elif data[:4] == GIF_MAGIC:
        return "image/gif"
    elif data[:4] == WEBP_MAGIC and b'WEBP' in data[:16]:
        return "image/webp"
    elif data[:2] == BMP_MAGIC:
        return "image/bmp"
    
    return None


def validate_file_size(
    size_bytes: int,
    max_size_mb: float = MAX_FILE_SIZE_MB
) -> Tuple[bool, Optional[str]]:
    """Validate file size."""
    max_bytes = int(max_size_mb * 1024 * 1024)
    
    if size_bytes <= 0:
        return False, "File is empty"
    
    if size_bytes > max_bytes:
        return False, f"File size ({size_bytes / 1024 / 1024:.1f}MB) exceeds limit ({max_size_mb}MB)"
    
    return True, None


def validate_content_type(
    content_type: str,
    allowed_types: set = ALLOWED_MIME_TYPES
) -> Tuple[bool, Optional[str]]:
    """Validate content type."""
    if content_type not in allowed_types:
        return False, f"Content type '{content_type}' not allowed. Allowed: {allowed_types}"
    return True, None


def sanitize_filename(filename: str) -> str:
    """Sanitize a filename for safe storage."""
    filename = os.path.basename(filename)
    
    filename = re.sub(r'[^\w\-_\.]', '_', filename)
    
    filename = filename[:255]
    
    if filename.startswith('.'):
        filename = '_' + filename
    
    return filename


def validate_image_file(
    data: bytes,
    filename: Optional[str] = None,
    max_size_mb: float = MAX_FILE_SIZE_MB
) -> FileValidationResult:
    """
    Comprehensive image file validation.
    
    Validates:
    - File size
    - Magic bytes (actual file type)
    - Extension (if filename provided)
    """
    errors = []
    warnings = []
    
    size_valid, size_error = validate_file_size(len(data), max_size_mb)
    if not size_valid:
        errors.append(size_error)
        return FileValidationResult(
            valid=False,
            file_size=len(data),
            errors=errors
        )
    
    detected_type = detect_file_type(data)
    if not detected_type:
        errors.append("Could not detect file type from content")
        return FileValidationResult(
            valid=False,
            file_size=len(data),
            errors=errors
        )
    
    if detected_type not in ALLOWED_MIME_TYPES:
        errors.append(f"File type '{detected_type}' not allowed")
        return FileValidationResult(
            valid=False,
            file_type=detected_type,
            file_size=len(data),
            errors=errors
        )
    
    if filename:
        ext = os.path.splitext(filename)[1].lower()
        if ext and ext not in ALLOWED_IMAGE_EXTENSIONS:
            warnings.append(f"File extension '{ext}' doesn't match detected type '{detected_type}'")
    
    return FileValidationResult(
        valid=True,
        file_type=detected_type,
        file_size=len(data),
        errors=errors,
        warnings=warnings
    )


def compute_file_hash(data: bytes, algorithm: str = "sha256") -> str:
    """Compute hash of file data."""
    if algorithm == "sha256":
        return hashlib.sha256(data).hexdigest()
    elif algorithm == "md5":
        return hashlib.md5(data).hexdigest()
    else:
        return hashlib.sha256(data).hexdigest()


def validate_style_id(style_id: str) -> Tuple[bool, Optional[str]]:
    """Validate a style ID."""
    if not style_id:
        return False, "Style ID is required"
    
    if len(style_id) > 64:
        return False, "Style ID too long (max 64 characters)"
    
    if not re.match(r'^[a-zA-Z0-9_-]+$', style_id):
        return False, "Style ID contains invalid characters"
    
    return True, None


def validate_json_tokens(tokens: Dict[str, Any]) -> Tuple[bool, List[str]]:
    """Basic validation that tokens are valid JSON structure."""
    errors = []
    
    if not isinstance(tokens, dict):
        errors.append("Tokens must be a JSON object")
        return False, errors
    
    def check_depth(obj, depth=0, max_depth=20):
        if depth > max_depth:
            return False
        if isinstance(obj, dict):
            for v in obj.values():
                if not check_depth(v, depth + 1, max_depth):
                    return False
        elif isinstance(obj, list):
            for item in obj:
                if not check_depth(item, depth + 1, max_depth):
                    return False
        return True
    
    if not check_depth(tokens):
        errors.append("Token structure exceeds maximum nesting depth")
        return False, errors
    
    return True, errors
