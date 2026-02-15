/**
 * PageTalk - YouTube Video Handling Functions
 */
import { generateUniqueId, escapeHtml } from './utils.js';
import { tr as _ } from './utils/i18n.js';

// 使用 utils/i18n.js 提供的 tr 作为翻译函数

/**
 * 处理YouTube URL
 * @param {string} url - YouTube URL
 * @param {object} state - Global state reference
 * @param {function} updateVideosPreviewCallback - Callback to update UI
 * @param {object} currentTranslations - Translations object
 */
export function handleYouTubeUrl(url, state, updateVideosPreviewCallback, currentTranslations = {}) {
    if (!url) return;

    // 验证YouTube URL格式
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    if (!youtubeRegex.test(url)) {
        alert(_('invalidYouTubeUrl', {}, currentTranslations) || '请输入有效的YouTube链接');
        return;
    }

    // 提取视频ID用于缩略图
    const videoId = extractYouTubeVideoId(url);
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    const videoData = {
        url: url,
        id: generateUniqueId(),
        type: 'youtube',
        videoId: videoId,
        thumbnailUrl: thumbnailUrl,
        name: `YouTube Video: ${videoId}`
    };

    state.videos.push(videoData);
    updateVideosPreviewCallback(); // Use callback
}

/**
 * 从YouTube URL中提取视频ID
 * @param {string} url - YouTube URL
 * @returns {string} - Video ID
 */
function extractYouTubeVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : '';
}

/**
 * 更新视频预览区域 (仅YouTube)
 * @param {object} state - Global state reference
 * @param {object} elements - DOM elements reference
 * @param {object} currentTranslations - Translations object
 * @param {function} removeVideoByIdCallback - Callback
 */
export function updateVideosPreview(state, elements, currentTranslations, removeVideoByIdCallback) {
    if (!elements.videosGrid || !elements.videoPreviewContainer || !elements.userInput) return;

    elements.videosGrid.innerHTML = '';

    if (state.videos.length === 0) {
        elements.videoPreviewContainer.style.display = 'none';
        return;
    }

    elements.videoPreviewContainer.style.display = 'block';

    state.videos.forEach((video, index) => {
        const videoItem = document.createElement('div');
        videoItem.className = 'video-item';
        videoItem.dataset.id = video.id;

        // YouTube 视频缩略图
        const thumbnailElement = document.createElement('img');
        thumbnailElement.src = video.thumbnailUrl;
        thumbnailElement.alt = `YouTube video thumbnail`;
        thumbnailElement.className = 'video-thumbnail';
        thumbnailElement.onerror = function () {
            // 如果缩略图加载失败，使用默认缩略图
            this.src = `https://img.youtube.com/vi/${video.videoId}/hqdefault.jpg`;
        };

        const overlayDiv = document.createElement('div');
        overlayDiv.className = 'video-overlay';

        const playIcon = document.createElement('div');
        playIcon.className = 'video-play-icon';
        playIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M6.271 5.055a.5.5 0 0 1 .52.038L11 7.055a.5.5 0 0 1 0 .89L6.791 9.907a.5.5 0 0 1-.791-.39V5.604a.5.5 0 0 1 .271-.549z"/>
            </svg>
        `;

        const infoDiv = document.createElement('div');
        infoDiv.className = 'video-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'video-name';
        nameSpan.textContent = video.name;
        infoDiv.appendChild(nameSpan);

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'video-actions';

        // Delete Button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'video-action-button';
        deleteBtn.title = _('deleteVideoTitle', {}, currentTranslations) || '删除视频';
        deleteBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
            </svg>
        `;
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeVideoByIdCallback(video.id); // Use callback
        });

        overlayDiv.appendChild(playIcon);
        actionsDiv.appendChild(deleteBtn);

        videoItem.appendChild(thumbnailElement);
        videoItem.appendChild(overlayDiv);
        videoItem.appendChild(infoDiv);
        videoItem.appendChild(actionsDiv);

        elements.videosGrid.appendChild(videoItem);
    });
}

/**
 * 通过ID删除视频
 * @param {string} videoId - 要删除的视频ID
 * @param {object} state - Global state reference
 * @param {function} updateVideosPreviewCallback - Callback
 */
export function removeVideoById(videoId, state, updateVideosPreviewCallback) {
    state.videos = state.videos.filter(video => video.id !== videoId);
    updateVideosPreviewCallback(); // Use callback
}

/**
 * 清除所有视频
 * @param {object} state - Global state reference
 * @param {function} updateVideosPreviewCallback - Callback
 */
export function clearVideos(state, updateVideosPreviewCallback) {
    state.videos = [];
    updateVideosPreviewCallback(); // Use callback
}

/**
 * 显示YouTube URL输入对话框
 * @param {object} elements - DOM elements reference
 */
export function showYouTubeDialog(elements) {
    if (!elements.youtubeUrlDialog) return;
    elements.youtubeUrlDialog.style.display = 'flex'; // 使用 flex 以启用居中布局
    if (elements.youtubeUrlInput) {
        elements.youtubeUrlInput.value = '';
        setTimeout(() => elements.youtubeUrlInput.focus(), 100); // 延迟聚焦确保动画完成
    }
}

/**
 * 隐藏YouTube URL输入对话框
 * @param {object} elements - DOM elements reference
 */
export function hideYouTubeDialog(elements) {
    if (!elements.youtubeUrlDialog) return;
    elements.youtubeUrlDialog.style.display = 'none';
    if (elements.youtubeUrlInput) {
        elements.youtubeUrlInput.value = '';
    }
}