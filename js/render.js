/**
 * Pagetalk - Dynamic Content Rendering (Markdown, KaTeX, Mermaid)
 */

import { escapeHtml } from './utils.js';

let currentPanzoomInstance = null; // Store Panzoom instance for Mermaid modal
let mermaidWheelListener = null; // Store wheel listener for Mermaid modal


/**
 * Renders KaTeX and Mermaid content within a given DOM element.
 * @param {HTMLElement} element - The container element to render within.
 * @param {object} elements - Reference to the main elements object (for modal access).
 */
export function renderDynamicContent(element, elements) {
    // --- Render KaTeX ---
    if (typeof window.renderMathInElement === 'function') {
        try {
            window.renderMathInElement(element, {
                delimiters: [
                    {left: "$$", right: "$$", display: true},
                    {left: "\\[", right: "\\]", display: true},
                    {left: "$", right: "$", display: false},
                    {left: "\\(", right: "\\)", display: false}
                ],
                throwOnError: false // Don't stop rendering on single error
            });
        } catch (error) {
            console.error('KaTeX rendering error:', error);
        }
    }

    // --- Render Mermaid (Manual Iteration) ---
    if (typeof mermaid !== 'undefined') {
        const mermaidPreElements = element.querySelectorAll('pre.mermaid');
        if (mermaidPreElements.length > 0) {
            console.log(`Found ${mermaidPreElements.length} Mermaid <pre> elements to render.`);
            mermaidPreElements.forEach(async (preElement, index) => {
                const definition = preElement.textContent || '';
                if (!definition.trim()) {
                    console.warn(`Skipping empty Mermaid <pre> element at index ${index}.`);
                    return; // Skip empty definitions
                }

                const renderId = `mermaid-render-${Date.now()}-${index}`;
                const container = document.createElement('div');
                container.className = 'mermaid';
                container.id = `${renderId}-container`;
                container.dataset.mermaidDefinition = definition;

                if (preElement.parentNode) {
                    preElement.parentNode.replaceChild(container, preElement);
                } else {
                    console.error('Cannot replace Mermaid <pre> element: parentNode is null.');
                    return;
                }

                try {
                    const { svg } = await mermaid.render(renderId, definition);
                    container.innerHTML = svg;
                    console.log(`Successfully rendered Mermaid chart ${index + 1} into container ${container.id}.`);

                    // Add click listener to the container (or SVG) to open modal
                    container.addEventListener('click', (event) => {
                        const svgElement = container.querySelector('svg');
                        if (svgElement) {
                            event.stopPropagation(); // Prevent potential parent listeners
                            showMermaidModal(svgElement.outerHTML, elements);
                        }
                    });

                } catch (error) {
                    console.error(`Error rendering Mermaid chart ${index + 1} (ID: ${renderId}):`, error, 'Definition:', definition);
                    container.innerHTML = `<div class="mermaid-error">Mermaid Render Error: ${escapeHtml(error.message)}</div>`;
                }
            });
        }
  }
}

/**
 * 重新渲染页面上所有已存在的 Mermaid 图表
 */
export function rerenderAllMermaidCharts(elements) {
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
        Promise.all(renderPromises);
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