import { api } from './client';

// Shared upload endpoint (backend: Shared/Storage/UploadsController.cs) —
// used by the Submission item form today, and later by Collection's
// completion-photo flow. Any logged-in user may call it.
export const uploadApi = {
  uploadImage: (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    return api
      .post<{ url: string }>('/api/v1/uploads', formData, {
        // `api` defaults every request to Content-Type: application/json.
        // Overriding it to undefined here lets the browser set its own
        // multipart/form-data header, boundary included — a plain string
        // value would omit the boundary and the server couldn't parse the body.
        headers: { 'Content-Type': undefined },
      })
      .then((r) => r.data.url);
  },
};
