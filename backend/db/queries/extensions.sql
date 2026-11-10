-- name: ListExtensions :many
SELECT id::text, number, registered, updated_at FROM extensions WHERE tenant_id = $1 ORDER BY number;
-- name: GetExtension :one
SELECT id::text, number, registered, updated_at FROM extensions WHERE tenant_id=$1 AND id=$2;
