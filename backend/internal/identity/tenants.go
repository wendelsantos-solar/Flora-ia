package identity

import "slices"

const SecondTenant = "33333333-3333-4333-8333-333333333333"
const EmptyTenant = "22222222-2222-4222-8222-222222222222"

func Extensions(tenant string) []string {
	switch tenant {
	case DevelopmentTenant:
		return []string{"201", "202", "203"}
	case SecondTenant:
		return []string{"211", "212", "213"}
	default:
		return nil
	}
}
func OwnsExtension(tenant, extension string) bool {
	return slices.Contains(Extensions(tenant), extension)
}
