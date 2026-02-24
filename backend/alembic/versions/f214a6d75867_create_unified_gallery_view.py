"""create unified gallery view

Revision ID: f214a6d75867
Revises: 0bd50a4bf20c
Create Date: 2025-02-23 17:01:04.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f214a6d75867'
down_revision: Union[str, None] = '0bd50a4bf20c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
    CREATE OR REPLACE VIEW unified_gallery_view AS
    SELECT
        id,
        workspace_id,
        user_id,
        created_at,
        'media_item'::text as item_type,
        status,
        gcs_uris,
        thumbnail_uris,
        jsonb_build_object(
            'model', model,
            'prompt', prompt,
            'negative_prompt', negative_prompt,
            'aspect_ratio', aspect_ratio,
            'mime_type', mime_type,
            'style', style,
            'lighting', lighting,
            'num_media', num_media,
            'duration_seconds', duration_seconds,
            'is_video', (mime_type like 'video%'),
            'is_audio', (mime_type like 'audio%')
        ) as metadata
    FROM media_items
    UNION ALL
    SELECT
        id,
        workspace_id,
        user_id,
        created_at,
        'source_asset'::text as item_type,
        'completed'::text as status,
        ARRAY[gcs_uri] as gcs_uris,
        CASE WHEN thumbnail_gcs_uri IS NOT NULL THEN ARRAY[thumbnail_gcs_uri] ELSE '{}'::text[] END as thumbnail_uris,
        jsonb_build_object(
            'original_filename', original_filename,
            'mime_type', mime_type,
            'aspect_ratio', aspect_ratio,
            'asset_type', asset_type,
            'is_video', (mime_type like 'video%'),
            'is_audio', (mime_type like 'audio%')
        ) as metadata
    FROM source_assets;
    """)


def downgrade() -> None:
    op.execute("DROP VIEW IF EXISTS unified_gallery_view;")
