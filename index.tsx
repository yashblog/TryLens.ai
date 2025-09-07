/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, Modality } from "@google/genai";

type HistoryItem = {
  original: string;
  variants: string[];
};

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
    const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
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
  
  // Output elements
  const comparisonContainer = document.getElementById('comparison-container') as HTMLDivElement;
  const beforeImage = document.getElementById('before-image') as HTMLImageElement;
  const afterImage = document.getElementById('after-image') as HTMLImageElement;
  const comparisonSlider = document.getElementById('comparison-slider') as HTMLInputElement;
  const comparisonHandle = document.getElementById('comparison-handle') as HTMLDivElement;
  const variantsContainer = document.getElementById('variants-container') as HTMLDivElement;
  const downloadButton = document.getElementById('download-button') as HTMLButtonElement;

  // Preset buttons
  const lifestylePreset = document.getElementById('lifestyle-preset') as HTMLButtonElement;
  const subtlePreset = document.getElementById('subtle-preset') as HTMLButtonElement;
  
  // Camera elements
  const cameraModal = document.getElementById('camera-modal') as HTMLDivElement;
  const cameraVideo = document.getElementById('camera-video') as HTMLVideoElement;
  const cameraCanvas = document.getElementById('camera-canvas') as HTMLCanvasElement;
  const cameraCapture = document.getElementById('camera-capture') as HTMLButtonElement;
  const cameraConfirm = document.getElementById('camera-confirm') as HTMLButtonElement;
  const cameraCancel = document.getElementById('camera-cancel') as HTMLButtonElement;
  const cameraConfirmText = cameraConfirm.querySelector('.button-text');
  const cameraConfirmSpinner = cameraConfirm.querySelector('.spinner');
  
  // History elements
  const historyToggle = document.getElementById('history-toggle') as HTMLButtonElement;
  const historyContainer = document.getElementById('history-container') as HTMLDivElement;
  const historyEmptyMsg = document.querySelector('.history-empty');

  let activeCameraTarget: HTMLInputElement | null = null;
  let stream: MediaStream | null = null;
  
  let originalPhotoSrc = '';
  let currentGeneratedSources: string[] = [];
  let history: HistoryItem[] = [];
  
  const originalProductLabel = productLabel?.textContent || 'Upload Product';
  const originalPhotoLabel = photoLabel?.textContent || 'Upload Scene';

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

  const updateSliderValue = (slider: HTMLInputElement, valueEl: HTMLSpanElement, isFloat = false) => {
    valueEl.textContent = isFloat ? parseFloat(slider.value).toFixed(1) : `${slider.value}%`;
  }

  scaleSlider?.addEventListener('input', () => updateSliderValue(scaleSlider, scaleValue));
  shadowSlider?.addEventListener('input', () => updateSliderValue(shadowSlider, shadowValue, true));
  
  const applyPreset = (scale: number, shadow: number) => {
      scaleSlider.value = String(scale);
      shadowSlider.value = String(shadow);
      scaleSlider.dispatchEvent(new Event('input'));
      shadowSlider.dispatchEvent(new Event('input'));
  }
  
  lifestylePreset?.addEventListener('click', () => applyPreset(40, 0.6));
  subtlePreset?.addEventListener('click', () => applyPreset(15, 0.3));

  // --- Camera Logic ---
  const setCameraConfirmLoadingState = (isLoading: boolean) => {
    if (!cameraConfirm || !cameraConfirmText || !cameraConfirmSpinner) return;
    cameraConfirm.disabled = isLoading;
    cameraConfirmText.textContent = isLoading ? 'Saving...' : 'Use Photo';
    (cameraConfirmSpinner as HTMLElement).style.display = isLoading ? 'block' : 'none';
  };

  const openCamera = async (targetInput: HTMLInputElement) => {
    activeCameraTarget = targetInput;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      cameraVideo.srcObject = stream;
      cameraModal.style.display = 'flex';
      cameraConfirm.disabled = true;
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access the camera. Please ensure you have given permission.");
    }
  };
  
  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    cameraModal.style.display = 'none';
    activeCameraTarget = null;
  };
  
  document.querySelectorAll('.take-photo-button').forEach(button => {
    button.addEventListener('click', () => {
      const targetId = (button as HTMLElement).dataset.target;
      const targetInput = document.getElementById(targetId!) as HTMLInputElement;
      openCamera(targetInput);
    });
  });

  cameraCapture.addEventListener('click', () => {
    const context = cameraCanvas.getContext('2d');
    cameraCanvas.width = cameraVideo.videoWidth;
    cameraCanvas.height = cameraVideo.videoHeight;
    context?.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
    cameraConfirm.disabled = false;
  });

  cameraConfirm.addEventListener('click', () => {
    if (!activeCameraTarget) return;
    setCameraConfirmLoadingState(true);
    cameraCanvas.toBlob(blob => {
      if (blob) {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        activeCameraTarget!.files = dataTransfer.files;
        activeCameraTarget!.dispatchEvent(new Event('change')); // Trigger UI update
      }
      setCameraConfirmLoadingState(false);
      closeCamera();
    }, 'image/jpeg');
  });

  cameraCancel.addEventListener('click', closeCamera);
  // --- End Camera Logic ---


  const fileToGenerativePart = (file: File) => {
    return new Promise<{ mimeType: string, data: string, url: string }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(',')[1];
        resolve({ mimeType: file.type, data: base64Data, url: result });
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const setLoadingState = (isLoading: boolean) => {
    generateButton.disabled = isLoading;
    buttonText.textContent = isLoading ? 'Generating...' : 'Generate';
    spinner.style.display = isLoading ? 'block' : 'none';
    if (!isLoading) checkFormValidity();
  };

  const showLoadingPlaceholders = () => {
    outputContainer.style.display = 'block';
    downloadButton.style.display = 'none';
    comparisonContainer.classList.add('loading');
    variantsContainer.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const placeholder = document.createElement('div');
        placeholder.className = 'variant-placeholder';
        variantsContainer.appendChild(placeholder);
    }
  };

  const hideLoadingPlaceholders = () => {
    comparisonContainer.classList.remove('loading');
  };
  
  const showResult = (result: HistoryItem) => {
      beforeImage.src = result.original;
      currentGeneratedSources = result.variants;
      
      updateMainImage(currentGeneratedSources[0] || '', 0);
      createThumbnails(currentGeneratedSources);

      comparisonSlider.value = '50';
      comparisonSlider.dispatchEvent(new Event('input'));

      downloadButton.style.display = 'flex';
      outputContainer.style.display = 'block';
  }
  
  const updateMainImage = (src: string, index: number) => {
      afterImage.src = src;
      variantsContainer.querySelectorAll('.variant-thumbnail').forEach((thumb, i) => {
          thumb.classList.toggle('active', i === index);
      });
  }
  
  const createThumbnails = (sources: string[]) => {
      variantsContainer.innerHTML = '';
      sources.forEach((src, index) => {
          const img = document.createElement('img');
          img.src = src;
          img.className = 'variant-thumbnail';
          img.alt = `Variant ${index + 1}`;
          if(index === 0) img.classList.add('active');
          img.addEventListener('click', () => updateMainImage(src, index));
          variantsContainer.appendChild(img);
      });
  }

  // --- History Logic ---
  const renderHistory = () => {
    historyContainer.innerHTML = '';
    if (history.length === 0) {
      if(historyEmptyMsg) historyContainer.appendChild(historyEmptyMsg);
      return;
    }
    history.forEach((item, index) => {
      const img = document.createElement('img');
      img.src = item.variants[0];
      img.className = 'history-item';
      img.alt = `History item ${index + 1}`;
      img.addEventListener('click', () => showResult(item));
      historyContainer.appendChild(img);
    });
  }

  historyToggle.addEventListener('click', () => {
    const isOpen = historyContainer.style.display === 'grid';
    historyContainer.style.display = isOpen ? 'none' : 'grid';
    historyToggle.classList.toggle('open', !isOpen);
  });
  // --- End History Logic ---

  generateButton.addEventListener('click', async () => {
    if (!productUpload.files?.[0] || !photoUpload.files?.[0] || !process.env.API_KEY) {
      alert("Please provide both product and scene photos.");
      return;
    }
    setLoadingState(true);
    showLoadingPlaceholders();

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const productPart = await fileToGenerativePart(productUpload.files[0]);
      const photoPart = await fileToGenerativePart(photoUpload.files[0]);
      originalPhotoSrc = photoPart.url;

      const prompt = `Base image: The second image provided (the photo). Overlay image: The first image provided (the product).

Task: Insert the product from the overlay image into the base image at the ${placementSelect.value} area.
Scale the product to about ${scaleSlider.value}% of the photo's width.
Match the scene’s lighting, color temperature, and perspective.
Add realistic shadows with an intensity of about ${shadowSlider.value} (where 0.0 is none and 1.0 is dark).
Do not modify the person’s face or the background.
Output a natural-looking, high-resolution composite suitable for a premium ecommerce preview.
Generate 3 variants with slight rotation differences.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [{ inlineData: productPart }, { inlineData: photoPart }, { text: prompt }] },
        config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
      });

      hideLoadingPlaceholders();
      const imageParts = response.candidates?.[0]?.content?.parts?.filter(part => part.inlineData);
      
      if (imageParts && imageParts.length > 0) {
        const generatedSources = imageParts.map(part => `data:${part.inlineData!.mimeType};base64,${part.inlineData!.data}`);
        
        if (generatedSources.length > 0) {
            const newResult = { original: originalPhotoSrc, variants: generatedSources };
            showResult(newResult);

            // Update history
            history.unshift(newResult);
            if (history.length > 5) history.pop();
            renderHistory();
        }
      } else {
        alert("Could not generate an image. Model response: " + (response.text || "No text response."));
        outputContainer.style.display = 'none';
      }
    } catch (error) {
      console.error("Error generating image:", error);
      alert("An error occurred. Please check the console for details.");
      outputContainer.style.display = 'none';
    } finally {
      setLoadingState(false);
      hideLoadingPlaceholders();
    }
  });

  comparisonSlider?.addEventListener('input', (e) => {
    const value = (e.target as HTMLInputElement).value;
    afterImage.style.clipPath = `inset(0 ${100 - parseFloat(value)}% 0 0)`;
    comparisonHandle.style.left = `${value}%`;
  });

  downloadButton.addEventListener('click', () => {
      const link = document.createElement('a');
      link.href = afterImage.src;
      link.download = 'trylens-ai-result.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  });


  // Initial setup
  const preferredTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  applyTheme(preferredTheme as 'light' | 'dark');
  checkFormValidity();
  updateSliderValue(scaleSlider, scaleValue);
  updateSliderValue(shadowSlider, shadowValue, true);
  renderHistory(); // Initial render for empty state
});