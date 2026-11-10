package siptrunk

import (
	"regexp"
	"strings"
)

var (
	ddd         = regexp.MustCompile(`^(1[1-9]|2[12478]|3[1-578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9])$`)
	labNumber   = regexp.MustCompile(`^880[0-9]{7}$`)
	dialChars   = regexp.MustCompile(`^\+?[0-9(][0-9 ()-]*$`)
	shortNumber = regexp.MustCompile(`^1[0-9]{2}$`)
	e164        = regexp.MustCompile(`^\+[1-9][0-9]{6,14}$`)
)

// Classify distinguishes syntax and destination classes. It never grants permission.
func Classify(input string) (number, category string) {
	input = strings.TrimSpace(input)
	if len(input) > 40 || !dialChars.MatchString(input) {
		return "", "invalid"
	}
	number = strings.NewReplacer(" ", "", "(", "", ")", "", "-", "").Replace(input)
	for _, n := range []string{"190", "191", "192", "193", "194", "197", "198", "199"} {
		if number == n {
			return number, "emergency"
		}
	}
	if shortNumber.MatchString(number) {
		return number, "special"
	}
	for _, prefix := range []string{"0300", "0303", "0500", "0800", "0900"} {
		if strings.HasPrefix(number, prefix) {
			return number, "special"
		}
	}
	if strings.HasPrefix(number, "00") {
		return number, "international"
	}
	if strings.HasPrefix(number, "+") && !strings.HasPrefix(number, "+55") {
		if e164.MatchString(number) {
			return number, "international"
		}
		return "", "invalid"
	}
	local := strings.TrimPrefix(number, "+55")
	if (len(local) == 10 || len(local) == 11) && ddd.MatchString(local[:2]) {
		if len(local) == 10 && strings.ContainsRune("2345", rune(local[2])) {
			return "+55" + local, "fixed"
		}
		if len(local) == 11 && local[2] == '9' {
			return "+55" + local, "mobile"
		}
	}
	return "", "invalid"
}
