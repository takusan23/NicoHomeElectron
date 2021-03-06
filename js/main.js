"use strict";
exports.__esModule = true;
var electron_1 = require("electron");
var path = require("path");
var localShortcut = require("electron-localshortcut");
//メイン
var mainWindow;
//ログイン画面
var loginWindow;
//設定画面
var settingWindow;
function createWindow() {
    // Create the browser window.
    mainWindow = new electron_1.BrowserWindow({
        height: 600,
        webPreferences: {
            nodeIntegration: true //trueにしておく。preload使ってもいいけど今回はパス。
        },
        width: 800
    });
    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, "../src/index.html")); //index.htmlはsrcフォルダ（main.jsはjsフォルダ）なのでパス気をつけて。
    // Open the DevTools.
    // mainWindow.webContents.openDevTools();
    electron_1.Menu.setApplicationMenu(null);
    // Emitted when the window is closed.
    mainWindow.on("closed", function () {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
    //ショートカットキーで開発者モード開く
    localShortcut.register(mainWindow, 'F12', function () {
        mainWindow.webContents.openDevTools();
    });
    //ショートカットキーでリロード
    localShortcut.register(mainWindow, 'F5', function () {
        mainWindow.reload();
    });
    //WindowsMediaPlayerの用にタスクバーから音声コントロールできるようにする
    mainWindow.setThumbarButtons([
        {
            tooltip: '一時停止・再生',
            icon: electron_1.nativeImage.createFromPath(__dirname.replace('js', '') + 'src\\img\\outline_audiotrack_white_18dp.png'),
            click: function () {
                mainWindow.webContents.send('playstate', 'playstate');
            }
        }
    ]);
}
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
electron_1.app.on("ready", createWindow);
// Quit when all windows are closed.
electron_1.app.on("window-all-closed", function () {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        electron_1.app.quit();
    }
});
electron_1.app.on("activate", function () {
    // On OS X it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});
// In this file you can include the rest of your app"s specific main process
// code. You can also put them in separate files and require them here.
//IPC受け取り
//ログイン画面を表示しろと来たら表示させる。別にメインプロセスじゃなくてリモートでも使える。
electron_1.ipcMain.on('login', function (event, arg) {
    if (arg === 'show') {
        //ログイン画面表示
        loginWindow = new electron_1.BrowserWindow({
            height: 600,
            webPreferences: {
                nodeIntegration: true //trueにしておく。preload使ってもいいけど今回はパス。
            },
            width: 800
        });
        loginWindow.loadFile(path.join(__dirname, "../src/html/login.html")); //index.htmlはsrcフォルダ（main.jsはjsフォルダ）なのでパス気をつけて。
        loginWindow.on("closed", function () {
            loginWindow = null;
        });
    }
});
//設定画面表示。のIPC通信
electron_1.ipcMain.on('setting', function (event, arg) {
    if (arg === 'show') {
        //設定画面表示。
        settingWindow = new electron_1.BrowserWindow({
            height: 600,
            webPreferences: {
                nodeIntegration: true //trueにしておく。preload使ってもいいけど今回はパス。
            },
            width: 800
        });
        settingWindow.loadFile(path.join(__dirname, "../src/html/settings.html")); //index.htmlはsrcフォルダ（main.jsはjsフォルダ）なのでパス気をつけて。
        settingWindow.on("closed", function () {
            settingWindow = null;
        });
    }
});
//# sourceMappingURL=main.js.map