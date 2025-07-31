import { useState, useEffect } from 'react';

export function useFilePreview(files: File[] | null | undefined) {
  const [filePreview, setFilePreview] = useState<string[]>([]);

  useEffect(() => {
    if (files && files.length > 0) {
      const newPreviews = Array.from(files).map(file =>
        URL.createObjectURL(file)
      );
      setFilePreview(newPreviews);

      return () => {
        // Clean up the URL objects
        newPreviews.forEach(url => URL.revokeObjectURL(url));
      };
    } else {
      setFilePreview([]);
    }
  }, [files]);

  const handleFilesChange = (newFiles: File[]) => {
    // Clean up old previews
    filePreview.forEach(url => URL.revokeObjectURL(url));

    // Create new previews
    const newPreviews = Array.from(newFiles).map(file =>
      URL.createObjectURL(file)
    );
    setFilePreview(newPreviews);
  };

  return { filePreview, handleFilesChange };
}