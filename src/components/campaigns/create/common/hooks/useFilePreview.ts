import { useState, useEffect } from 'react';

export function useFilePreview(files: any) {
  const [filePreview, setFilePreview] = useState([]);

  useEffect(() => {
    // if (!files || files.length === 0) {
    //   setFilePreview([]);
    //   return;
    // }

    // const previews = [];
    
    // Array.from(files).forEach(file => {
    //   const reader = new FileReader();
    //   reader.onloadend = () => {
    //     if (typeof reader.result === 'string') {
    //       previews.push(reader.result);
    //       setFilePreview([...previews]);
    //     }
    //   };
    //   reader.readAsDataURL(file);
    // });
  }, [files]);

  return filePreview;
}