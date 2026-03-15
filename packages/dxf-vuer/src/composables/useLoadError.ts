import { ref } from "vue";

export function useLoadError() {
  const errorMessage = ref<string | null>(null);

  const setError = (error: unknown, fallbackMsg: string): string => {
    const msg = error instanceof Error ? error.message : fallbackMsg;
    errorMessage.value = msg;
    return msg;
  };

  const clearError = () => {
    errorMessage.value = null;
  };

  return { errorMessage, setError, clearError };
}
