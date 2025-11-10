from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List


class ClassSchema(BaseModel):
    """Pydantic model for a class schema."""
    id: str
    version_id: str
    name: str
    description: Optional[str] = None
    schema: Optional[Dict[str, Any]] = None
    enabled: bool = True

    class Config:
        from_attributes = True


class PropertySchema(BaseModel):
    """Pydantic model for a class property."""
    id: str
    class_id: str
    property_id: Optional[str] = None
    name: str
    description: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    property_source_id: Optional[str] = None
    property_source_name: Optional[str] = None

    class Config:
        from_attributes = True


class VersionInfo(BaseModel):
    """Pydantic model for version information."""
    id: str
    version_id: str
    visibility: str
    published: bool

    class Config:
        from_attributes = True


class OpenAPIResponse(BaseModel):
    """Pydantic model for OpenAPI specification response."""
    openapi: str = "3.1.0"
    info: Dict[str, Any]
    paths: Dict[str, Any] = Field(default_factory=dict)
    components: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        from_attributes = True

