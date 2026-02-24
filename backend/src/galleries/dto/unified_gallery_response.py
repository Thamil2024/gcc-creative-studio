# Copyright 2025 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from datetime import datetime
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class UnifiedGalleryItemResponse(BaseModel):
    """
    Response model for a unified gallery item (MediaItem or SourceAsset).
    """
    id: int
    workspace_id: int
    created_at: datetime
    item_type: str  # 'media_item' or 'source_asset'
    status: Optional[str] = None
    gcs_uris: List[str] = []
    thumbnail_uris: List[str] = []
    # Map from 'metadata_' in SQLAlchemy model to 'metadata' in Pydantic
    metadata: Dict[str, Any] = Field(default_factory=dict, validation_alias="metadata_")
    
    # Presigned URLs will be injected by the service
    presigned_urls: List[str] = []
    presigned_thumbnail_urls: List[str] = []
    
    # For compatibility with frontend expecting specific fields at top level,
    # we might want to flatten metadata or keep it nested.
    # The plan implied "UnifiedGalleryItem" response.
    # Frontend likely needs to know which fields to access.
    # For simplicity, we can pass metadata as is, and let frontend map it.

    model_config = ConfigDict(
        populate_by_name=True,
        alias_generator=to_camel,
        from_attributes=True,
    )
