/**
 * PageTalk - 动态库加载管理器
 * 
 * 这个模块负责按需加载第三方库，减少页面初始化时的性能影响
 */

// 库加载状态缓存
const loadedLibraries = new Map();
const loadingPromises = new Map();

// 库配置
const LIBRARY_CONFIG = {
    // 核心库 - 这些会立即加载
    core: {
        readability: {
            path: 'js/lib/Readability.js',
            global: 'Readability'
        },
        lucide: {
            path: 'js/lib/lucide.js',
            global: 'lucide'
        }
    },
    
    // 功能库 - 按需加载
    features: {
        markdown: {
            path: 'js/lib/markdown-it.min.js',
            global: 'markdownit',
            dependencies: []
        },
        highlight: {
            path: 'js/lib/highlight.min.js',
            global: 'hljs',
            dependencies: []
        },
        katex: {
            path: 'js/lib/katex.min.js',
            global: 'katex',
            dependencies: ['auto-render']
        },
        'auto-render': {
            path: 'js/lib/auto-render.min.js',
            global: 'renderMathInElement',
            dependencies: []
        },
        mermaid: {
            path: 'js/lib/mermaid.min.js',
            global: 'mermaid',
            dependencies: ['panzoom']
        },
        panzoom: {
            path: 'js/lib/panzoom.min.js',
            global: 'panzoom',
            dependencies: []
        },
        pdf: {
            path: 'js/lib/pdf.mjs',
            global: null, // ES模块，没有全局变量
            dependencies: [],
            isModule: true
        },
        'pdf-worker': {
            path: 'js/lib/pdf.worker.mjs',
            global: null,
            dependencies: [],
            isModule: true
        },
        // 语法高亮语言包
        python: {
            path: 'js/lib/python.min.js',
            global: null,
            dependencies: ['highlight']
        },
        r: {
            path: 'js/lib/r.min.js',
            global: null,
            dependencies: ['highlight']
        },
        sql: {
            path: 'js/lib/sql.min.js',
            global: null,
            dependencies: ['highlight']
        },
        json: {
            path: 'js/lib/json.min.js',
            global: null,
            dependencies: ['highlight']
        },
        java: {
            path: 'js/lib/java.min.js',
            global: null,
            dependencies: ['highlight']
        },
        javascript: {
            path: 'js/lib/javascript.min.js',
            global: null,
            dependencies: ['highlight']
        }
    }
};

/**
 * 动态加载单个库
 * @param {string} libraryName - 库名称
 * @param {string} category - 库类别 ('core' 或 'features')
 * @returns {Promise<void>}
 */
async function loadLibrary(libraryName, category = 'features') {
    const config = LIBRARY_CONFIG[category][libraryName];
    if (!config) {
        throw new Error(`Library ${libraryName} not found in configuration`);
    }

    // 检查是否已加载
    if (loadedLibraries.has(libraryName)) {
        return loadedLibraries.get(libraryName);
    }

    // 检查是否正在加载
    if (loadingPromises.has(libraryName)) {
        return loadingPromises.get(libraryName);
    }

    // 创建加载Promise
    const loadPromise = (async () => {
        try {
            // 先加载依赖
            if (config.dependencies) {
                for (const dep of config.dependencies) {
                    await loadLibrary(dep, category);
                }
            }

            // 加载主库
            const libraryUrl = chrome.runtime.getURL(config.path);
            
            if (config.isModule) {
                // ES模块加载
                const module = await import(libraryUrl);
                loadedLibraries.set(libraryName, module);
                console.log(`[LibraryLoader] Module ${libraryName} loaded successfully`);
                return module;
            } else {
                // 传统脚本加载
                await loadScript(libraryUrl, 10000);
                
                // 验证全局变量是否加载成功
                if (config.global && !window[config.global]) {
                    throw new Error(`Global variable ${config.global} not found after loading ${libraryName}`);
                }
                
                const result = window[config.global] || true;
                loadedLibraries.set(libraryName, result);
                console.log(`[LibraryLoader] Library ${libraryName} loaded successfully`);
                return result;
            }
        } catch (error) {
            console.error(`[LibraryLoader] Failed to load library ${libraryName}:`, error);
            loadedLibraries.delete(libraryName);
            throw error;
        }
    })();

    loadingPromises.set(libraryName, loadPromise);
    
    try {
        const result = await loadPromise;
        loadingPromises.delete(libraryName);
        return result;
    } catch (error) {
        loadingPromises.delete(libraryName);
        throw error;
    }
}

/**
 * 动态加载脚本
 * @param {string} url - 脚本URL
 * @param {number} timeout - 超时时间（毫秒），默认10秒
 * @returns {Promise<void>}
 */
function loadScript(url, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        
        // 成功加载
        script.onload = () => {
            clearTimeout(timeoutId);
            resolve();
        };
        
        // 加载失败
        script.onerror = () => {
            clearTimeout(timeoutId);
            reject(new Error(`Failed to load script: ${url}`));
        };
        
        // 超时处理
        const timeoutId = setTimeout(() => {
            // 清理脚本标签
            if (script.parentNode) {
                script.parentNode.removeChild(script);
            }
            reject(new Error(`Library loading timeout: ${url} (>${timeout}ms)`));
        }, timeout);
        
        document.head.appendChild(script);
    });
}

/**
 * 批量加载库
 * @param {string[]} libraryNames - 库名称数组
 * @param {string} category - 库类别
 * @returns {Promise<void>}
 */
async function loadLibraries(libraryNames, category = 'features') {
    const loadPromises = libraryNames.map(name => loadLibrary(name, category));
    return Promise.all(loadPromises);
}

/**
 * 检查库是否已加载
 * @param {string} libraryName - 库名称
 * @returns {boolean}
 */
function isLibraryLoaded(libraryName) {
    return loadedLibraries.has(libraryName);
}

/**
 * 获取已加载的库
 * @param {string} libraryName - 库名称
 * @returns {any}
 */
function getLibrary(libraryName) {
    return loadedLibraries.get(libraryName);
}

/**
 * 预加载核心库
 * @returns {Promise<void>}
 */
async function preloadCoreLibraries() {
    const coreLibraries = Object.keys(LIBRARY_CONFIG.core);
    return loadLibraries(coreLibraries, 'core');
}

/**
 * 根据功能需求加载相应的库
 * @param {string} feature - 功能名称
 * @returns {Promise<void>}
 */
async function loadFeatureLibraries(feature) {
    const featureMap = {
        'markdown': ['markdown', 'highlight'],
        'latex': ['katex', 'auto-render'],
        'diagram': ['mermaid', 'panzoom'],
        'pdf': ['pdf', 'pdf-worker'],
        'code': ['highlight'],
        'all': Object.keys(LIBRARY_CONFIG.features)
    };

    const libraries = featureMap[feature] || [];
    return loadLibraries(libraries, 'features');
}

/**
 * 加载语法高亮语言包
 * @param {string[]} languages - 语言列表
 * @returns {Promise<void>}
 */
async function loadHighlightLanguages(languages) {
    const languagePromises = languages.map(lang => {
        if (LIBRARY_CONFIG.features[lang]) {
            return loadLibrary(lang, 'features');
        }
        return Promise.resolve();
    });
    return Promise.all(languagePromises);
}

// 导出API
window.LibraryLoader = {
    loadLibrary,
    loadLibraries,
    isLibraryLoaded,
    getLibrary,
    preloadCoreLibraries,
    loadFeatureLibraries,
    loadHighlightLanguages
};

// 自动预加载核心库
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', preloadCoreLibraries);
} else {
    preloadCoreLibraries();
}

console.log('[LibraryLoader] Dynamic library loader initialized');