// Chroma key background removal utility

export function removeChromaBackground(
  imageUrl: string,
  chromaColor: { r: number; g: number; b: number },
  threshold: number = 50
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      // Remove chroma key color
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate color distance
        const distance = Math.sqrt(
          Math.pow(r - chromaColor.r, 2) +
          Math.pow(g - chromaColor.g, 2) +
          Math.pow(b - chromaColor.b, 2)
        );
        
        // If close to chroma color, make transparent
        if (distance < threshold) {
          data[i + 3] = 0; // Set alpha to 0
        } else if (distance < threshold * 1.5) {
          // Feather edges
          const alpha = ((distance - threshold) / (threshold * 0.5)) * 255;
          data[i + 3] = Math.min(255, alpha);
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = imageUrl;
  });
}
