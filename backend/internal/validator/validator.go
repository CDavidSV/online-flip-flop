package validator

import (
	"fmt"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

type CustomValidator struct {
	v *validator.Validate
}

type ValidationError struct {
	Field string `json:"field"`
	Msg   string `json:"error"`
}

func New() *CustomValidator {
	validator := validator.New()

	validator.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.SplitN(fld.Tag.Get("json"), ",", 2)[0]

		// skip if tag key says it should be ignored
		if name == "-" {
			return ""
		}

		return name
	})

	return &CustomValidator{v: validator}
}

func getErrorMsg(tag, param string) string {
	switch tag {
	case "required":
		return "This field is required"
	case "min":
		return fmt.Sprintf("Minimum length is %s", param)
	case "max":
		return fmt.Sprintf("Maximum length is %s", param)
	case "oneof":
		return fmt.Sprintf("Value must be one of the following: %s", param)
	default:
		return fmt.Sprintf("Failed on the '%s' validation tag", tag)
	}
}

func (cv *CustomValidator) Validate(i any) (bool, []ValidationError) {
	if err := cv.v.Struct(i); err != nil {
		validationErrors := err.(validator.ValidationErrors)

		errorsResponse := make([]ValidationError, len(validationErrors))
		for i, ve := range validationErrors {
			errorsResponse[i] = ValidationError{
				Field: ve.Field(),
				Msg:   getErrorMsg(ve.Tag(), ve.Param()),
			}
		}

		return false, errorsResponse
	}

	return true, nil
}
