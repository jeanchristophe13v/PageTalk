/**
 * PageTalk - Dynamic Content Rendering (Markdown, KaTeX, Mermaid)
 */

import { escapeHtml } from './utils.js';

let currentPanzoomInstance = null; // Store Panzoom instance for Mermaid modal
let mermaidWheelListener = null; // Store wheel listener for Mermaid modal

// --- Cache for Mermaid SVGs to support smooth streaming ---
// Key: `${messageId}-${index}`
// Value: { definition: string, svg: string, timestamp: number }
const mermaidCache = new Map();


/**
 * Renders KaTeX and Mermaid content within a given DOM element.
 * @param {HTMLElement} element - The container element to render within.
 * @param {object} elements - Reference to the main elements object (for modal access).
 * @param {string} [messageId=null] - Optional message ID for caching purposes (required for streaming stability).
 */
export function renderDynamicContent(element, elements, messageId = null) {

    // --- Render KaTeX ---
    if (typeof window.renderMathInElement === 'function') {
        try {
            window.renderMathInElement(element, {
                delimiters: [
                    { left: "$$", right: "$$", display: true },
                    { left: "\\[", right: "\\]", display: true },
                    { left: "$", right: "$", display: false },
                    { left: "\\(", right: "\\)", display: false }
                ],
                throwOnError: false // Don't stop rendering on single error
            });
        } catch (error) {
            console.error('KaTeX rendering error:', error);
        }
    } else {
        // console.warn('KaTeX renderMathInElement function not found.');
    }

    // --- Render Mermaid (Manual Iteration) ---
    if (typeof mermaid !== 'undefined') {
        const mermaidPreElements = element.querySelectorAll('pre.mermaid, div.mermaid[data-rendered="true"]');

        if (mermaidPreElements.length > 0) {
            // console.log(`Found ${mermaidPreElements.length} Mermaid elements to render.`);
            mermaidPreElements.forEach(async (el, index) => {
                // If it's already a div with data-rendered="true" (injected from cache), 
                // we might still want to re-verify or just attach listeners. 
                // For now, let's treat pre.mermaid as "needs render" and div.mermaid as "already rendered but maybe outdated".

                let definition = '';
                let container = null;

                if (el.tagName.toLowerCase() === 'pre') {
                    // It's a raw pre block (either new or cache miss)
                    definition = el.textContent || '';
                    if (!definition.trim()) return;

                    const renderId = `mermaid-render-${Date.now()}-${index}`;
                    container = document.createElement('div');
                    container.className = 'mermaid';
                    container.id = `${renderId}-container`;
                    container.dataset.mermaidDefinition = definition;

                    // Replace <pre> with <div>
                    if (el.parentNode) {
                        el.parentNode.replaceChild(container, el);
                    }
                } else {
                    // It's a cached div
                    container = el;
                    definition = container.dataset.mermaidDefinition;
                }

                if (!container || !definition) return;

                // Check cache if messageId is provided
                const cacheKey = messageId ? `${messageId}-${index}` : null;

                try {
                    // Optimization: If container already has SVG and definition matches cache, skip re-render
                    // This prevents flicker if the logic is called repeatedly on the same content
                    if (cacheKey && mermaidCache.has(cacheKey)) {
                        const cached = mermaidCache.get(cacheKey);
                        if (cached.definition === definition && container.querySelector('svg')) {
                            // Already up to date, just ensure listeners are attached
                            attachMermaidListeners(container, elements);
                            return;
                        }
                    }

                    const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, definition);
                    container.innerHTML = svg;
                    container.dataset.rendered = "true"; // Mark as successfully rendered

                    // Update Cache
                    if (cacheKey) {
                        mermaidCache.set(cacheKey, {
                            definition: definition,
                            svg: svg,
                            timestamp: Date.now()
                        });
                    }

                    attachMermaidListeners(container, elements);

                } catch (error) {
                    console.error(`Mermaid render error:`, error);

                    // IF we have a cached version for this specific block, revert to it (or keep it if it's currently showing)
                    if (cacheKey && mermaidCache.has(cacheKey)) {
                        const cached = mermaidCache.get(cacheKey);
                        console.log('Restoring cached mermaid due to syntax error in stream...');
                        // Keep the old definition in dataset so we know what we are trying to render, 
                        // but visually show the valid SVG
                        if (container.innerHTML === '' || !container.querySelector('svg')) {
                            container.innerHTML = cached.svg;
                        }
                        // Do NOT update custom error message, effectively "freezing" the last valid state
                    } else {
                        // No cache, show error (only if this is NOT a streaming intermediate state? 
                        // Hard to know for sure, but showing error is better than empty)

                        // For better UX during typing, maybe we show error only if it persists?
                        // But for now, standard error behavior:
                        container.innerHTML = `<div class="mermaid-error">Mermaid Render Error: ${escapeHtml(error.message)}</div>`;
                    }
                }
            });
        }
    } else {
        // console.warn('Mermaid library not found during renderDynamicContent.');
    }
}

/**
 * Pre-processes HTML content to inject cached Mermaid SVGs.
 * This MUST be called before setting innerHTML to prevent flashing.
 * @param {string} html - The raw HTML string (from markdown render).
 * @param {string} messageId - The ID of the message.
 * @returns {string} - The HTML with <pre> replaced by cached <div>.
 */
export function preProcessMermaidHTML(html, messageId) {
    if (!messageId || !mermaidCache.size) return html;

    // Regex to find <pre class="mermaid">...</pre> keys
    // We need to match efficiently. Since markdown-it renders as <pre class="mermaid">code</pre>,
    // we can iterate through the matches.
    const mermaidRegex = /<pre class="mermaid">([\s\S]*?)<\/pre>/g;

    let match;
    let index = 0;

    // We need to replace content. Using replace with callback ensures we handle global matches correctly.
    return html.replace(mermaidRegex, (match, definition) => {
        const cacheKey = `${messageId}-${index}`;
        index++; // Increment index for the next match

        if (mermaidCache.has(cacheKey)) {
            const cached = mermaidCache.get(cacheKey);
            // Verify if the *new* definition roughly matches or if we just fundamentally 
            // want to show the old valid one while the new one is invalid.
            // Actually, we ALWAYS want to show the old valid one immediately 
            // to prevent the "Text -> SVG" jump.
            // The async render will update it to the new version (or keep it if invalid).

            // We use the NEW definition in dataset, but OLD SVG in innerHTML.
            return `<div class="mermaid" data-mermaid-definition="${escapeHtml(definition)}" data-rendered="true">${cached.svg}</div>`;
        }

        // No cache, return original
        return match;
    });
}

function attachMermaidListeners(container, elements) {
    // Helper to reduce duplication
    // Remove old listeners to be safe (cloning node is cheaper but we have references)
    // Simple approach: just add new one, assuming old one is gone because we re-created innerHTML 
    // OR we are re-attaching to existing DOM. 

    // Actually, container.innerHTML = svg trashes internal listeners on SVG, 
    // but the click listener is on the CONTAINER.
    // So we might be adding multiple listeners if we are not careful.

    // Let's use a flag or remove property
    container.onclick = null; // Clear old "on" property if used, but we used addEventListener

    // Best way: Clone and replace to strip listeners? No, that kills state.
    // Just set a custom property?
    if (container.dataset.hasListener === 'true') return;

    container.addEventListener('click', (event) => {
        const svgElement = container.querySelector('svg');
        if (svgElement) {
            event.stopPropagation();
            showMermaidModal(svgElement.outerHTML, elements);
        }
    });
    container.dataset.hasListener = 'true';
}


/**
 * 重新渲染页面上所有已存在的 Mermaid 图表
 */
export async function rerenderAllMermaidCharts(elements) {
    if (typeof mermaid === 'undefined') {
        console.warn('Mermaid library not available for re-rendering.');
        return;
    }

    const containersToRerender = document.querySelectorAll('.mermaid[data-mermaid-definition]');
    console.log(`Found ${containersToRerender.length} Mermaid charts with definitions to re-render.`);

    if (containersToRerender.length === 0) {
        return;
    }

    const renderPromises = Array.from(containersToRerender).map(async (container, index) => {
        const definition = container.dataset.mermaidDefinition;
        if (!definition) {
            console.warn('Container found without definition, skipping re-render.', container);
            return;
        }

        const renderId = `mermaid-rerender-${Date.now()}-${index}`;
        container.innerHTML = ''; // Clear the old SVG content

        try {
            const { svg } = await mermaid.render(renderId, definition);
            container.innerHTML = svg;
            console.log(`Successfully re-rendered Mermaid chart ${index + 1}.`);

            // Re-attach click listener
            container.removeEventListener('click', handleMermaidContainerClick); // Remove old listener if any
            container.addEventListener('click', (event) => handleMermaidContainerClick(event, elements));

        } catch (error) {
            console.error(`Error re-rendering Mermaid chart ${index + 1}:`, error, 'Definition:', definition);
            container.innerHTML = `<div class="mermaid-error">Re-render Error: ${escapeHtml(error.message)}</div>`;
        }
    });

    try {
        await Promise.all(renderPromises);
        console.log('Finished re-rendering all Mermaid charts.');
    } catch (error) {
        console.error('An error occurred during the batch re-rendering process:', error);
    }
}

// Helper function to handle clicks on mermaid containers
function handleMermaidContainerClick(event, elements) {
    const container = event.currentTarget; // The container div itself
    const svgElement = container.querySelector('svg');
    if (svgElement) {
        event.stopPropagation();
        showMermaidModal(svgElement.outerHTML, elements);
    }
}


/**
 * 显示 Mermaid 图表放大预览模态框
 * @param {string} svgContent - 要显示的 SVG 图表内容 (outerHTML)
 * @param {object} elements - Reference to the main elements object.
 */
export function showMermaidModal(svgContent, elements) {
    console.log('showMermaidModal called. SVG content length:', svgContent?.length);
    if (!elements.mermaidModal || !elements.mermaidModalContent) return;

    if (currentPanzoomInstance) {
        currentPanzoomInstance.destroy();
        currentPanzoomInstance = null;
        console.log('Previous Panzoom instance destroyed.');
    }

    elements.mermaidModalContent.innerHTML = svgContent;
    const svgElement = elements.mermaidModalContent.querySelector('svg');

    if (svgElement && typeof Panzoom !== 'undefined') {
        try {
            currentPanzoomInstance = Panzoom(svgElement, {
                maxZoom: 5,
                minZoom: 0.5,
                bounds: true,
                boundsPadding: 0.1
            });
            console.log('Panzoom initialized on Mermaid SVG.');

            if (elements.mermaidModalContent) {
                mermaidWheelListener = (event) => {
                    if (currentPanzoomInstance) {
                        event.preventDefault();
                        currentPanzoomInstance.zoomWithWheel(event);
                    }
                };
                elements.mermaidModalContent.addEventListener('wheel', mermaidWheelListener, { passive: false });
                console.log('Wheel listener added to mermaid modal content.');
            }

        } catch (error) {
            console.error('Failed to initialize Panzoom:', error);
            currentPanzoomInstance = null;
        }
    } else if (!svgElement) {
        console.warn('Could not find SVG element in Mermaid modal to initialize Panzoom.');
    } else if (typeof Panzoom === 'undefined') {
        console.warn('Panzoom library not loaded, cannot initialize zoom/pan for Mermaid.');
    }

    elements.mermaidModal.style.display = 'block';
}

/**
 * 隐藏 Mermaid 图表预览模态框
 * @param {object} elements - Reference to the main elements object.
 */
export function hideMermaidModal(elements) {
    if (mermaidWheelListener && elements.mermaidModalContent) {
        elements.mermaidModalContent.removeEventListener('wheel', mermaidWheelListener);
        mermaidWheelListener = null;
        console.log('Wheel listener removed from mermaid modal content.');
    }

    if (!elements.mermaidModal) return;

    if (currentPanzoomInstance) {
        currentPanzoomInstance.destroy();
        currentPanzoomInstance = null;
        console.log('Panzoom instance destroyed.');
    }

    elements.mermaidModal.style.display = 'none';
    if (elements.mermaidModalContent) {
        elements.mermaidModalContent.innerHTML = '';
    }
}