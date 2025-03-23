const vscode = require('vscode');

class SidebarProvider {
    constructor(extensionUri) {
        this._extensionUri = extensionUri;
        this._view = undefined;
        this.messages = [];
    }

    resolveWebviewView(webviewView) {
        this._view = webviewView;
        
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        
        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
        
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'send-message':
                    await this.handleUserMessage(data.value);
                    break;
                case 'clear-context':
                    this.clearContext();
                    break;
            }
        });
    }

    async handleUserMessage(message) {
        try {
            // 添加用户消息
            this.messages.push({
                role: 'user',
                parts: [{ text: message }]
            });

            // 发送处理中提示
            this._view.webview.postMessage({
                type: 'add-message',
                value: {
                    sender: 'ai',
                    message: '思考中...',
                    pending: true
                }
            });

            // 调用 Gemini API
            const answer = await this.sendToGemini(message);

            // 添加 AI 回复
            this.messages.push({
                role: 'model',
                parts: [{ text: answer }]
            });

            // 更新 UI
            this._view.webview.postMessage({
                type: 'update-message',
                value: {
                    sender: 'ai',
                    message: answer
                }
            });

        } catch (error) {
            console.error('消息处理错误:', error);
            this._view.webview.postMessage({
                type: 'update-message',
                value: {
                    sender: 'ai',
                    message: `错误: ${error.message}`
                }
            });
        }
    }

    async sendToGemini(prompt) {
        try {
            // 构建历史消息数组（最多保留最近5条消息）
            const recentMessages = this.messages.slice(-5);

            // 准备请求体
            const requestBody = {
                contents: recentMessages,
                generationConfig: {
                    temperature: vscode.workspace.getConfiguration('pagetalk').get('temperature') || 0.7,
                    topP: vscode.workspace.getConfiguration('pagetalk').get('topP') || 0.95,
                    maxOutputTokens: vscode.workspace.getConfiguration('pagetalk').get('maxOutputTokens') || 8192
                }
            };

            const apiKey = await vscode.workspace.getConfiguration('pagetalk').get('apiKey');
            const model = await vscode.workspace.getConfiguration('pagetalk').get('model') || 'gemini-2.0-flash';
            
            if (!apiKey) {
                throw new Error('请先设置 API 密钥');
            }

            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                }
            );

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || '请求失败');
            }

            const result = await response.json();
            return result.candidates[0]?.content?.parts[0]?.text || '无法获取回答';

        } catch (error) {
            console.error("Gemini API 调用错误:", error);
            throw error;
        }
    }

    clearContext() {
        this.messages = [];
        if (this._view) {
            this._view.webview.postMessage({
                type: 'clear-chat'
            });
        }
    }

    _getHtmlForWebview(webview) {
        const mainScriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "webview", "main.js")
        );

        return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Pagetalk</title>
            </head>
            <body>
                <div id="app"></div>
                <script src="${mainScriptUri}"></script>
            </body>
            </html>
        `;
    }
}
