// Extract a human message from Axios/Fetch/backend errors
export function toUserMessage(err: any): string {
  // Axios shape
  if (err?.response) {
    const d = err.response.data;
    return (
      d?.error?.message ||     // { error: { message: "..."} }
      d?.message ||            // { message: "..." }
      err.message ||           // Axios error message
      'Request failed'
    );
  }
  // Fetch/unknown
  return err?.message || 'Network error';
}

export function statusCode(err: any): number | undefined {
  return err?.response?.status;
}
