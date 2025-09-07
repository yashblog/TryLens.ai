/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from "@google/genai";

document.addEventListener('DOMContentLoaded', () => {

  // Theme switcher
  const themeToggle = document.getElementById('theme-toggle') as HTMLButtonElement;
  const body = document.body;

  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      body.classList.add('dark-mode');
    } else {
      body.classList.remove('dark-mode');
    }
  };

  themeToggle.addEventListener('click', () => {
    const currentThemeIsDark = body.classList.contains('dark-mode');
    const newTheme = currentThemeIsDark ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  });
  
  // App elements
  const productUpload = document.getElementById('product-upload') as HTMLInputElement;
  const photoUpload = document.getElementById('photo-upload') as HTMLInputElement;
  const productLabel = document.getElementById('product-label')?.querySelector('strong');
  const photoLabel = document.getElementById('photo-label')?.querySelector('strong');
  const scaleSlider = document.getElementById('scale-slider') as HTMLInputElement;
  const scaleValue = document.getElementById('scale-value') as HTMLSpanElement;
  const shadowSlider = document.getElementById('shadow-slider') as HTMLInputElement;
  const shadowValue = document.getElementById('shadow-value') as HTMLSpanElement;
  const placementSelect = document.getElementById('placement-select') as HTMLSelectElement;
  const generateButton = document.getElementById('generate-button') as HTMLButtonElement;
  const buttonText = generateButton.querySelector('.button-text') as HTMLSpanElement;
  const spinner = generateButton.querySelector('.spinner') as HTMLDivElement;
  const outputContainer = document.getElementById('output-container') as HTMLDivElement;
  const outputGrid = document.getElementById('output-grid') as HTMLDivElement;

  const originalProductLabel = productLabel?.textContent || 'Upload Product';
  const originalPhotoLabel = photoLabel?.textContent || 'Upload Photo';

  const checkFormValidity = () => {
    const isProductUploaded = productUpload.files && productUpload.files.length > 0;
    const isPhotoUploaded = photoUpload.files && photoUpload.files.length > 0;
    generateButton.disabled = !(isProductUploaded && isPhotoUploaded);
  };

  const handleFileChange = (input: HTMLInputElement, label: HTMLElement | null | undefined, originalText: string) => {
    if (!input || !label) return;
    if (input.files && input.files.length > 0) {
      label.textContent = input.files[0].name;
    } else {
      label.textContent = originalText;
    }
    checkFormValidity();
  };

  productUpload?.addEventListener('change', () => handleFileChange(productUpload, productLabel, originalProductLabel));
  photoUpload?.addEventListener('change', () => handleFileChange(photoUpload, photoLabel, originalPhotoLabel));

  if (scaleSlider && scaleValue) {
    scaleValue.textContent = `${scaleSlider.value}%`;
    scaleSlider.addEventListener('input', () => {
      scaleValue.textContent = `${scaleSlider.value}%`;
    });
  }

  if (shadowSlider && shadowValue) {
    shadowValue.textContent = `${shadowSlider.value}%`;
    shadowSlider.addEventListener('input', () => {
      shadowValue.textContent = `${shadowSlider.value}%`;
    });
  }

  const fileToGenerativePart = (file: File) => {
    return new Promise<{ mimeType: string, data: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          return reject(new Error("Failed to read file as string"));
        }
        const base64Data = reader.result.split(',')[1];
        resolve({
          mimeType: file.type,
          data: base64Data,
        });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const setLoadingState = (isLoading: boolean) => {
    generateButton.disabled = isLoading;
    if (isLoading) {
      buttonText.textContent = 'Generating...';
      spinner.style.display = 'block';
    } else {
      buttonText.textContent = 'Generate Try-On';
      spinner.style.display = 'none';
      checkFormValidity(); // Re-check validity to set disabled state correctly
    }
  };

  generateButton.addEventListener('click', async () => {
    if (!productUpload.files?.[0] || !photoUpload.files?.[0] || !process.env.API_KEY) {
      alert("Please upload both a product and a photo, and ensure the API key is set.");
      return;
    }

    setLoadingState(true);
    outputGrid.innerHTML = '';
    outputContainer.style.display = 'none';

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const productPart = await fileToGenerativePart(productUpload.files[0]);
      const photoPart = await fileToGenerativePart(photoUpload.files[0]);

      const scale = scaleSlider.value;
      const placement = placementSelect.value;
      const shadow = shadowSlider.value;

      const prompt = `Base image: The second image provided (the photo). Overlay image: The first image provided (the product).

Task: Insert the product from the overlay image into the base image at the ${placement} area.
Scale the product to about ${scale}% of the photo's width.
Match the scene’s lighting, color temperature, and perspective.
Add realistic shadows with an intensity of about ${shadow}%.
Do not modify the person’s face or the background.
Output a natural-looking, high-resolution composite suitable for a premium ecommerce preview.
Generate 3 variants with slight rotation differences.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: [
            { inlineData: productPart },
            { inlineData: photoPart },
            { text: prompt },
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      const imageParts = response.candidates?.[0]?.content?.parts?.filter(part => part.inlineData);
      
      if (imageParts && imageParts.length > 0) {
        imageParts.forEach(part => {
          if (part.inlineData) {
            const base64ImageBytes: string = part.inlineData.data;
            const mimeType = part.inlineData.mimeType;
            const img = document.createElement('img');
            img.src = `data:${mimeType};base64,${base64ImageBytes}`;
            img.alt = 'Generated try-on variant';
            outputGrid.appendChild(img);
          }
        });
        outputContainer.style.display = 'block';
      } else {
        const textResponse = response.text;
        alert("Could not generate an image. Model response: " + (textResponse || "No text response."));
      }

    } catch (error) {
      console.error("Error generating image:", error);
      alert("An error occurred while generating the image. Please check the console for details.");
    } finally {
      setLoadingState(false);
    }
  });

  // Initial setup
  const preferredTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferredTheme as 'light' | 'dark');
  checkFormValidity();
});