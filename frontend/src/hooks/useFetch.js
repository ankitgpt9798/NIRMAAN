import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { getErrorMessage } from '../services/api';

/**
 * Loads data with `load()` whenever `key` changes or `reload()` is called.
 * While reloading, the previous data stays visible so lists do not flash empty.
 * `initialData` (optional) is shown immediately while the first load runs.
 *
 *   const { data, loading, error, errorStatus, reload, mutate } = useFetch(`product:${id}`, () => getProduct(id));
 */
export function useFetch(key, load, { initialData } = {}) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState(() => ({ doneKey: null, data: initialData, error: '', errorStatus: null, failure: null }));
  const requestKey = `${key}#${version}`;
  const runLoad = useEffectEvent(() => load());

  useEffect(() => {
    let active = true;
    runLoad().then(
      (data) => active && setState({ doneKey: requestKey, data, error: '', errorStatus: null, failure: null }),
      (error) =>
        active &&
        setState((previous) => ({
          doneKey: requestKey,
          data: previous.data,
          error: getErrorMessage(error),
          errorStatus: error?.response?.status ?? null,
          failure: error,
        })),
    );
    return () => {
      active = false;
    };
  }, [requestKey]);

  const reload = useCallback(() => setVersion((n) => n + 1), []);
  /** Updates the loaded data locally (e.g. after a successful save) without refetching. */
  const mutate = useCallback((update) => setState((previous) => ({ ...previous, data: update(previous.data) })), []);

  const loading = state.doneKey !== requestKey;
  return {
    data: state.data,
    error: loading ? '' : state.error,
    errorStatus: loading ? null : state.errorStatus,
    /** The original error object (for translated messages), or null. */
    failure: loading ? null : state.failure,
    loading,
    reload,
    mutate,
  };
}
