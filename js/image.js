/**
 * Pagetalk - Image Handling Functions
 */
import { generateUniqueId, escapeHtml } from './utils.js';

/** Helper function to get translation string */
function _(key, replacements = {}, translations) {
  let translation = translations[key] || key;
  for (const placeholder in replacements) {
    translation = translation.replace(`{${placeholder}}`, replacements[placeholder]);
  }
  return translation;
}

/**
 * 设置图片粘贴功能
 * @param {object} elements - DOM elements reference
 * @param {function} handleImageFileCallback - Callback to process the file
 */
export function setupImagePaste(elements, handleImageFileCallback) {
    if (!elements.userInput) return;
    elements.userInput.addEventListener('paste', async (e) => {
        const items = (e.clipboardData || e.originalEvent.clipboardData).items;
        let imageFound = false;
        for (const item of items) {
            if (item.type.indexOf('image') === 0) {
                e.preventDefault();
                const blob = item.getAsFile();
                if (blob) {
                    handleImageFileCallback(blob); // Use callback
                    imageFound = true;
                    break; // Handle first image found
                }
            }
        }
        // Visual feedback
        if (imageFound) {
             elements.userInput.classList.add('paste-highlight');
             setTimeout(() => {
                 elements.userInput.classList.remove('paste-highlight');
             }, 500);
        }
    });
}

/**
 * 处理图片文件选择 (from input)
 * @param {Event} e - File selection event
 * @param {function} handleImageFileCallback - Callback to process files
 * @param {object} elements - DOM elements reference
 */
export function handleImageSelect(e, handleImageFileCallback, elements) {
    const files = e.target.files;
    if (files && files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (file && file.type.startsWith('image/')) {
                handleImageFileCallback(file); // Use callback
            }
        }
    }
    if (elements.fileInput) {
        elements.fileInput.value = ''; // Reset input
    }
}

/**
 * 处理图片文件 (核心逻辑)
 * @param {File} file - 图片文件
 * @param {object} state - Global state reference
 * @param {function} updateImagesPreviewCallback - Callback to update UI
 */
export function handleImageFile(file, state, updateImagesPreviewCallback) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const imageData = {
            file: file,
            mimeType: file.type,
            dataUrl: e.target.result,
            id: generateUniqueId()
        };
        state.images.push(imageData);
        updateImagesPreviewCallback(); // Use callback
    };
    reader.readAsDataURL(file);
}

/**
 * 更新图片预览区域
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} removeImageByIdCallback - Callback
 */
export function updateImagesPreview(state, elements, currentTranslations, removeImageByIdCallback) {
    if (!elements.imagesGrid || !elements.imagePreviewContainer || !elements.userInput) return;

    elements.imagesGrid.innerHTML = '';

    if (state.images.length === 0) {
        elements.imagePreviewContainer.style.display = 'none';
        elements.userInput.parentElement.classList.remove('has-image');
        return;
    }

    elements.imagePreviewContainer.style.display = 'block';
    elements.userInput.parentElement.classList.add('has-image');

    state.images.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.id = image.id;

        const img = document.createElement('img');
        img.src = escapeHtml(image.dataUrl);
        img.alt = escapeHtml(_('imageAlt', { index: index + 1 }, currentTranslations));
        img.addEventListener('click', () => showFullSizeImage(image.dataUrl, elements));

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'image-actions';

        // View Button
        const viewBtn = document.createElement('button');
        viewBtn.className = 'image-action-button';
        viewBtn.title = _('viewImageTitle', {}, currentTranslations);
        viewBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
            </svg>
        `;
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showFullSizeImage(image.dataUrl, elements);
        });

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'image-action-button';
        deleteBtn.title = _('deleteImageTitle', {}, currentTranslations);
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeImageByIdCallback(image.id); // Use callback
        });

        actionsDiv.appendChild(viewBtn);
        actionsDiv.appendChild(deleteBtn);
        imageItem.appendChild(img);
        imageItem.appendChild(actionsDiv);
        elements.imagesGrid.appendChild(imageItem);
    });
}

/**
 * 通过ID删除图片
 * @param {string} imageId - 要删除的图片ID
 * @param {object} state - Global state reference
 * @param {function} updateImagesPreviewCallback - Callback
 */
export function removeImageById(imageId, state, updateImagesPreviewCallback) {
    state.images = state.images.filter(img => img.id !== imageId);
    updateImagesPreviewCallback(); // Use callback
}

/**
 * 清除所有图片
 * @param {object} state - Global state reference
 * @param {function} updateImagesPreviewCallback - Callback
 */
export function clearImages(state, updateImagesPreviewCallback) {
    state.images = [];
    updateImagesPreviewCallback(); // Use callback
}

/**
 * 显示图片的大图预览
 * @param {string} imageUrl - 图片URL
 * @param {object} elements - DOM elements reference
 */
export function showFullSizeImage(imageUrl, elements) {
    if (!elements.modalImage || !elements.imageModal) return;
    elements.modalImage.src = escapeHtml(imageUrl); // Escape URL just in case
    elements.imageModal.style.display = 'block';
}

/**
 * 隐藏图片预览模态框
 * @param {object} elements - DOM elements reference
 */
export function hideImageModal(elements) {
    if (!elements.imageModal) return;
    elements.imageModal.style.display = 'none';
}