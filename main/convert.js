const { ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const ffmpegPath = require('ffmpeg-static');

function registerConvertHandlers() {
  ipcMain.handle('recording:save', async (_event, { buffer, format }) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'step-recorder-'));
    const inputPath = path.join(tmpDir, 'recording.webm');
    fs.writeFileSync(inputPath, Buffer.from(buffer));

    try {
      if (format === 'webm') {
        const { canceled, filePath } = await dialog.showSaveDialog({
          defaultPath: 'recording.webm',
          filters: [{ name: 'WebM Video', extensions: ['webm'] }],
        });
        if (canceled || !filePath) return { canceled: true };
        fs.copyFileSync(inputPath, filePath);
        return { canceled: false, filePath };
      }

      const ext = ['mp4', 'mov', 'gif'].includes(format) ? format : 'mp4';
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `recording.${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
      if (canceled || !filePath) return { canceled: true };

      const outputPath = path.join(tmpDir, `recording.${ext}`);
      const args =
        ext === 'gif'
          ? ['-y', '-i', inputPath, '-vf', 'fps=12,scale=720:-1:flags=lanczos', outputPath]
          : ['-y', '-i', inputPath, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', outputPath];

      await new Promise((resolve, reject) => {
        const proc = spawn(ffmpegPath, args);
        let stderr = '';
        proc.stderr.on('data', (d) => {
          stderr += d.toString();
        });
        proc.on('error', reject);
        proc.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
        });
      });

      fs.copyFileSync(outputPath, filePath);
      return { canceled: false, filePath };
    } finally {
      fs.rm(tmpDir, { recursive: true, force: true }, () => {});
    }
  });
}

module.exports = { registerConvertHandlers };
