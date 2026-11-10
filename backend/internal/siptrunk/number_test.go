package siptrunk

import "testing"

func TestClassifyBrazil(t *testing.T) {
	for _, tc := range []struct{ input, normalized, class string }{
		{"(11) 2345-6789", "+551123456789", "fixed"},
		{"+55 (21) 91234-5678", "+5521912345678", "mobile"},
		{"90912345678", "", "invalid"},
		{"1101234567", "", "invalid"},
		{"1191234567", "", "invalid"},
		{"5541912345678", "", "invalid"},
		{"011912345678", "", "invalid"},
		{"0021123456789", "0021123456789", "international"},
		{"+351212345678", "+351212345678", "international"},
		{"190", "190", "emergency"},
		{"1 92", "192", "emergency"},
		{"09001234567", "09001234567", "special"},
		{"08001234567", "08001234567", "special"},
		{"03031234567", "03031234567", "special"},
		{"1191234;5678", "", "invalid"},
		{"sip:11912345678@localhost", "", "invalid"},
		{"+5511912345678@carrier", "", "invalid"},
		{"１１９１２３４５６７８", "", "invalid"},
	} {
		t.Run(tc.input, func(t *testing.T) {
			n, c := Classify(tc.input)
			if n != tc.normalized || c != tc.class {
				t.Fatalf("got (%q,%q), want (%q,%q)", n, c, tc.normalized, tc.class)
			}
		})
	}
}
