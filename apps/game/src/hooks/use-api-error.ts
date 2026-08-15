import { useTranslation } from "react-i18next"
import { apiErrorKey } from "@/i18n/api-errors"

/**
 * Turns whatever a query or mutation threw into a sentence the player reads.
 *
 * Returns a function rather than a string so one call at the top of a screen
 * covers every request on it, and so a null error can stay null — an empty
 * error slot is not the same as one holding "Something went wrong".
 */
export function useApiError(): (error: unknown) => string {
  const { t } = useTranslation()
  return (error: unknown) => t(apiErrorKey(error))
}
