package validator

import (
	"fmt"
	"net/http"
	"reflect"
	"strings"

	"github.com/CDavidSV/online-flip-flop/internal/apperrors"
	"github.com/go-playground/validator/v10"
	"github.com/labstack/echo/v4"
)

type CustomValidator struct {
	v *validator.Validate
}

type ValidationErrorDTO struct {
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

func (cv *CustomValidator) Validate(i any) error {
	if err := cv.v.Struct(i); err != nil {
		validationErrors := err.(validator.ValidationErrors)

		errorsResponse := make([]ValidationErrorDTO, len(validationErrors))
		for i, ve := range validationErrors {
			errorsResponse[i] = ValidationErrorDTO{
				Field: ve.Field(),
				Msg:   getErrorMsg(ve.Tag(), ve.Param()),
			}
		}

		return echo.NewHTTPError(http.StatusBadRequest, apperrors.New(apperrors.ErrValidationFailed, errorsResponse))
	}

	return nil
}
