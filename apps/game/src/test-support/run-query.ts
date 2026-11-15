import type {
  FetchQueryOptions,
  MutationObserverOptions,
  QueryKey,
} from "@tanstack/react-query"
import { MutationObserver, QueryClient } from "@tanstack/react-query"

//runs query and mutation options the way react-query would, without react: a
//fresh client per call, no retries, so a failure surfaces on the first answer.

/** Fetches `options` once and resolves to the data, or rejects with the error. */
export function runQuery<Data, Key extends QueryKey>(
  options: FetchQueryOptions<Data, Error, Data, Key>,
): Promise<Data> {
  const client = new QueryClient()
  return client.fetchQuery({ ...options, retry: false })
}

/** Fires `options`' mutation function once with `variables`. */
export function runMutation<Data, Variables>(
  options: MutationObserverOptions<Data, Error, Variables>,
  variables: Variables,
): Promise<Data> {
  const client = new QueryClient()
  const observer = new MutationObserver(client, {
    ...options,
    retry: false,
  })
  return observer.mutate(variables)
}
