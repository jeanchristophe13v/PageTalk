const vscode = require('vscode');
const { SidebarProvider } = require('./SidebarProvider');

function activate(context) {
    // 创建侧边栏提供者
    const sidebarProvider = new SidebarProvider(context.extensionUri);
    
    // 注册侧边栏
    const sidebarView = vscode.window.registerWebviewViewProvider(
        "pagetalk.sidebar",
        sidebarProvider
    );
    context.subscriptions.push(sidebarView);

    // 注册启动命令
    let startCommand = vscode.commands.registerCommand('pagetalk.start', async () => {
        try {
            // 聚焦到侧边栏
            await vscode.commands.executeCommand('workbench.view.extension.pagetalk');
        } catch (error) {
            console.error('启动失败:', error);
            vscode.window.showErrorMessage('启动 Pagetalk 失败');
        }
    });
    context.subscriptions.push(startCommand);

    // 注册清除上下文命令
    let clearContextCommand = vscode.commands.registerCommand('pagetalk.clearContext', () => {
        if (sidebarProvider) {
            sidebarProvider.clearContext();
            vscode.window.showInformationMessage('对话上下文已清除');
        }
    });
    context.subscriptions.push(clearContextCommand);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
