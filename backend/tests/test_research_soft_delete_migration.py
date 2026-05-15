from pathlib import Path


MIGRATION = (
    Path(__file__).resolve().parents[1]
    / "src/services/db/migrations/023_add_research_entries_deleted_at.sql"
)


def test_research_soft_delete_unique_index_only_applies_to_active_rows():
    sql = MIGRATION.read_text()

    assert "DROP INDEX IF EXISTS research_entries_global_unique_idx" in sql
    assert "CREATE UNIQUE INDEX IF NOT EXISTS research_entries_global_unique_idx" in sql
    assert "ON research_entries (scope_key, title, type)" in sql
    assert "WHERE deleted_at IS NULL" in sql


def test_research_vector_match_excludes_soft_deleted_rows():
    sql = MIGRATION.read_text()
    function_sql = sql.split("CREATE OR REPLACE FUNCTION match_research_entries", 1)[1]

    assert "r.deleted_at IS NULL" in function_sql
