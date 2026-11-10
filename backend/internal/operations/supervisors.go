package operations

import (
	"context"
	"flora/internal/identity"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (r Repository) Supervised(ctx context.Context, tenant, user string) ([]string, error) {
	result := []string{}
	err := r.Store.InTenant(ctx, tenant, func(tx pgx.Tx) error {
		rows, err := tx.Query(ctx, "SELECT department FROM department_supervisors WHERE tenant_id=$1 AND user_id=$2 ORDER BY department", tenant, user)
		if err != nil {
			return err
		}
		result, err = pgx.CollectRows(rows, pgx.RowTo[string])
		return err
	})
	if result == nil {
		result = []string{}
	}
	return result, err
}

func (r Repository) Supervisor(ctx context.Context, a Actor, code, extension string, remove bool) error {
	if !codePattern.MatchString(code) || !identity.OwnsExtension(a.Tenant, extension) || (extension != "203" && extension != "213") {
		return ErrInvalid
	}
	return r.mutate(ctx, a, op("supervision", remove), code+"/"+extension, func(tx pgx.Tx) (pgconn.CommandTag, error) {
		if remove {
			return tx.Exec(ctx, `DELETE FROM department_supervisors WHERE tenant_id=$1 AND department=$2 AND user_id=(SELECT user_id FROM extensions WHERE tenant_id=$1 AND number=$3)`, a.Tenant, code, extension)
		}
		return tx.Exec(ctx, `INSERT INTO department_supervisors(tenant_id,department,user_id) SELECT tenant_id,$2,user_id FROM extensions WHERE tenant_id=$1 AND number=$3 ON CONFLICT DO NOTHING`, a.Tenant, code, extension)
	})
}
