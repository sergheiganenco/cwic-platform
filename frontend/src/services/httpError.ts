// Extract a human message from Axios/Fetch/backend errors
export function toUserMessage(err: any): string {
  // Axios shape
  if (err?.response) {
    const d = err.response.data;
    // Accept common shapes: { error: { message } }, { error: '...' }, { message: '...' }
    const strError = typeof d?.error === 'string' ? d.error : undefined;
    return (
      d?.error?.message ||
      strError ||
      d?.message ||
      err.message ||
      'Request failed'
    );
  }
  // Fetch/unknown
  return err?.message || 'Network error';
}

export function statusCode(err: any): number | undefined {
  return err?.response?.status;
}
