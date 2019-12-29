import { app, BrowserWindow, Menu, MenuItem, IpcMain, ipcMain } from "electron";
import * as path from "path";

let mainWindow: Electron.BrowserWindow;

let loginWindow: Electron.BrowserWindow

function createWindow() {
    // Create the browser window.
    mainWindow = new BrowserWindow({
        height: 600,
        webPreferences: {
            nodeIntegration: true //trueにしておく。preload使ってもいいけど今回はパス。
        },
        width: 800,
    });

    // and load the index.html of the app.
    mainWindow.loadFile(path.join(__dirname, "../src/index.html"));　//index.htmlはsrcフォルダ（main.jsはjsフォルダ）なのでパス気をつけて。

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    Menu.setApplicationMenu(null)

    // Emitted when the window is closed.
    mainWindow.on("closed", () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
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
ipcMain.on('login', function (event, arg) {
    if (arg === 'show') {
        //ログイン画面表示
        loginWindow = new BrowserWindow({
            height: 600,
            webPreferences: {
                nodeIntegration: true //trueにしておく。preload使ってもいいけど今回はパス。
            },
            width: 800,
        });
        loginWindow.loadFile(path.join(__dirname, "../src/html/login.html"));　//index.htmlはsrcフォルダ（main.jsはjsフォルダ）なのでパス気をつけて。
        loginWindow.webContents.openDevTools();
        loginWindow.on("closed", () => {
            loginWindow = null;
        });
    }
})