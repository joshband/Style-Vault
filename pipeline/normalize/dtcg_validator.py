"""
DTCG Token Validator

Validates tokens against W3C DTCG 2025.10 specification.
Enforces $type, $value, $description presence and correctness.
Resolves token aliases.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re


class DTCGTokenType(str, Enum):
    """Valid DTCG token types per W3C spec."""
    COLOR = "color"
    DIMENSION = "dimension"
    FONT_FAMILY = "fontFamily"
    FONT_WEIGHT = "fontWeight"
    DURATION = "duration"
    CUBIC_BEZIER = "cubicBezier"
    NUMBER = "number"
    STROKE_STYLE = "strokeStyle"
    BORDER = "border"
    TRANSITION = "transition"
    SHADOW = "shadow"
    GRADIENT = "gradient"
    TYPOGRAPHY = "typography"


VALID_TYPES = {t.value for t in DTCGTokenType}


@dataclass
class ValidationError:
    """Represents a token validation error."""
    path: str
    error_type: str
    message: str
    severity: str = "error"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "path": self.path,
            "errorType": self.error_type,
            "message": self.message,
            "severity": self.severity,
        }


@dataclass
class ValidationResult:
    """Result of token validation."""
    valid: bool
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)
    token_count: int = 0
    resolved_aliases: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "errors": [e.to_dict() for e in self.errors],
            "warnings": [w.to_dict() for w in self.warnings],
            "tokenCount": self.token_count,
            "resolvedAliases": self.resolved_aliases,
        }


ALIAS_PATTERN = re.compile(r'^\{([^}]+)\}$')


def is_alias(value: Any) -> bool:
    """Check if value is an alias reference."""
    if not isinstance(value, str):
        return False
    return ALIAS_PATTERN.match(value) is not None


def extract_alias_path(value: str) -> Optional[str]:
    """Extract the path from an alias reference."""
    match = ALIAS_PATTERN.match(value)
    return match.group(1) if match else None


def resolve_token_path(tokens: Dict[str, Any], path: str) -> Optional[Any]:
    """Resolve a dot-notation path to a token value."""
    parts = path.split(".")
    current = tokens
    
    for part in parts:
        if isinstance(current, dict) and part in current:
            current = current[part]
        else:
            return None
    
    return current


def is_token_object(obj: Any) -> bool:
    """Check if object is a token (has $type or $value)."""
    if not isinstance(obj, dict):
        return False
    return "$value" in obj or "$type" in obj


def validate_color_value(value: Any, path: str) -> List[ValidationError]:
    """Validate a color token value."""
    errors = []
    
    if isinstance(value, str):
        valid_prefixes = ['#', 'rgb', 'rgba', 'hsl', 'hsla', 'oklch', 'oklab', 'lab', 'lch']
        if not any(value.lower().startswith(p) for p in valid_prefixes):
            if not is_alias(value):
                errors.append(ValidationError(
                    path=path,
                    error_type="invalid_color",
                    message=f"Invalid color format: {value}",
                    severity="error"
                ))
    else:
        errors.append(ValidationError(
            path=path,
            error_type="invalid_type",
            message=f"Color value must be a string, got {type(value).__name__}",
            severity="error"
        ))
    
    return errors


def validate_dimension_value(value: Any, path: str) -> List[ValidationError]:
    """Validate a dimension token value."""
    errors = []
    
    if isinstance(value, str):
        dimension_pattern = re.compile(r'^-?[\d.]+\s*(px|rem|em|%|vw|vh|pt|cm|mm|in|ch|ex|lh|vmin|vmax)$')
        if not dimension_pattern.match(value) and not is_alias(value):
            errors.append(ValidationError(
                path=path,
                error_type="invalid_dimension",
                message=f"Invalid dimension format: {value}",
                severity="warning"
            ))
    elif not isinstance(value, (int, float)):
        errors.append(ValidationError(
            path=path,
            error_type="invalid_type",
            message=f"Dimension value must be string or number, got {type(value).__name__}",
            severity="error"
        ))
    
    return errors


def validate_shadow_value(value: Any, path: str) -> List[ValidationError]:
    """Validate a shadow token value."""
    errors = []
    
    if isinstance(value, dict):
        required_fields = ["color", "offsetX", "offsetY", "blur"]
        for field in required_fields:
            if field not in value:
                errors.append(ValidationError(
                    path=f"{path}.{field}",
                    error_type="missing_field",
                    message=f"Shadow missing required field: {field}",
                    severity="error"
                ))
    elif isinstance(value, list):
        for i, shadow in enumerate(value):
            errors.extend(validate_shadow_value(shadow, f"{path}[{i}]"))
    else:
        errors.append(ValidationError(
            path=path,
            error_type="invalid_type",
            message=f"Shadow value must be object or array, got {type(value).__name__}",
            severity="error"
        ))
    
    return errors


def validate_token(
    token: Dict[str, Any],
    path: str,
    all_tokens: Dict[str, Any]
) -> Tuple[List[ValidationError], bool]:
    """
    Validate a single token object.
    Returns (errors, has_alias).
    """
    errors = []
    has_alias = False
    
    if "$type" not in token:
        errors.append(ValidationError(
            path=path,
            error_type="missing_type",
            message="Token missing required $type field",
            severity="error"
        ))
    else:
        token_type = token["$type"]
        if token_type not in VALID_TYPES:
            errors.append(ValidationError(
                path=path,
                error_type="invalid_type",
                message=f"Invalid token type: {token_type}. Valid types: {VALID_TYPES}",
                severity="error"
            ))
    
    if "$value" not in token:
        errors.append(ValidationError(
            path=path,
            error_type="missing_value",
            message="Token missing required $value field",
            severity="error"
        ))
    else:
        value = token["$value"]
        token_type = token.get("$type", "")
        
        if is_alias(value):
            has_alias = True
            alias_path = extract_alias_path(value)
            if alias_path:
                resolved = resolve_token_path(all_tokens, alias_path)
                if resolved is None:
                    errors.append(ValidationError(
                        path=path,
                        error_type="unresolved_alias",
                        message=f"Cannot resolve alias: {value}",
                        severity="error"
                    ))
        else:
            if token_type == "color":
                errors.extend(validate_color_value(value, path))
            elif token_type == "dimension":
                errors.extend(validate_dimension_value(value, path))
            elif token_type == "shadow":
                errors.extend(validate_shadow_value(value, path))
    
    if "$description" not in token:
        errors.append(ValidationError(
            path=path,
            error_type="missing_description",
            message="Token missing recommended $description field",
            severity="warning"
        ))
    
    return errors, has_alias


def validate_tokens_recursive(
    obj: Dict[str, Any],
    all_tokens: Dict[str, Any],
    path: str = "",
    errors: List[ValidationError] = None,
    warnings: List[ValidationError] = None,
    stats: Dict[str, int] = None
) -> None:
    """Recursively validate all tokens in a token tree."""
    if errors is None:
        errors = []
    if warnings is None:
        warnings = []
    if stats is None:
        stats = {"tokens": 0, "aliases": 0}
    
    for key, value in obj.items():
        if key.startswith("$"):
            continue
        
        current_path = f"{path}.{key}" if path else key
        
        if isinstance(value, dict):
            if is_token_object(value):
                stats["tokens"] += 1
                token_errors, has_alias = validate_token(value, current_path, all_tokens)
                
                for err in token_errors:
                    if err.severity == "error":
                        errors.append(err)
                    else:
                        warnings.append(err)
                
                if has_alias:
                    stats["aliases"] += 1
            else:
                validate_tokens_recursive(
                    value, all_tokens, current_path, errors, warnings, stats
                )


def validate_dtcg_tokens(tokens: Dict[str, Any]) -> ValidationResult:
    """
    Validate a complete DTCG token file.
    
    Args:
        tokens: Token dictionary to validate
    
    Returns:
        ValidationResult with errors, warnings, and stats
    """
    errors: List[ValidationError] = []
    warnings: List[ValidationError] = []
    stats = {"tokens": 0, "aliases": 0}
    
    if "$schema" not in tokens:
        warnings.append(ValidationError(
            path="",
            error_type="missing_schema",
            message="Token file should include $schema reference",
            severity="warning"
        ))
    
    validate_tokens_recursive(tokens, tokens, "", errors, warnings, stats)
    
    return ValidationResult(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        token_count=stats["tokens"],
        resolved_aliases=stats["aliases"]
    )


def resolve_all_aliases(tokens: Dict[str, Any], max_depth: int = 10) -> Dict[str, Any]:
    """
    Resolve all alias references in a token file.
    
    Args:
        tokens: Token dictionary with potential aliases
        max_depth: Maximum alias resolution depth to prevent cycles
    
    Returns:
        Token dictionary with all aliases resolved
    """
    import copy
    resolved = copy.deepcopy(tokens)
    
    def resolve_value(value: Any, depth: int = 0) -> Any:
        if depth > max_depth:
            return value
        
        if isinstance(value, str) and is_alias(value):
            alias_path = extract_alias_path(value)
            if alias_path:
                target = resolve_token_path(resolved, alias_path)
                if target and is_token_object(target):
                    return resolve_value(target.get("$value"), depth + 1)
        
        if isinstance(value, dict):
            return {k: resolve_value(v, depth) for k, v in value.items()}
        
        if isinstance(value, list):
            return [resolve_value(item, depth) for item in value]
        
        return value
    
    def resolve_recursive(obj: Dict[str, Any]) -> None:
        for key, value in obj.items():
            if key.startswith("$"):
                continue
            
            if isinstance(value, dict):
                if is_token_object(value) and "$value" in value:
                    value["$value"] = resolve_value(value["$value"])
                else:
                    resolve_recursive(value)
    
    resolve_recursive(resolved)
    return resolved
