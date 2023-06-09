const path = require('path')

const { app, BrowserWindow } = require('electron')
const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
       preload: path.join(__dirname, 'src', 'js', 'preload.js') 
    }
  });

  win.loadFile('index.html');

  win.webContents.openDevTools();

}
app.whenReady().then(() => {
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})