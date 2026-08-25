require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { Octokit } = require('@octokit/rest');
const cors = require('cors');

const app = express();
app.use(cors());

const upload = multer({ storage: multer.memoryStorage() });

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

const OWNER = process.env.GITHUB_USERNAME; 
const REPO = process.env.GITHUB_REPO;
const BRANCH = 'main';

// Hàm hỗ trợ lấy đường dẫn chuẩn từ req.params
const getCleanPath = (params) => {
  const rawPath = params.filePath || params[0];
  if (Array.isArray(rawPath)) {
    return rawPath.join('/');
  }
  return rawPath;
};

// 1. Endpoint Upload File
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file' });
    }

    const folder = req.file.mimetype.startsWith('image/') ? 'images' : 'storage';
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `${folder}/${fileName}`;
    const fileContentBase64 = req.file.buffer.toString('base64');

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      message: `Upload ${fileName} to ${folder} via API`,
      content: fileContentBase64,
      branch: BRANCH,
    });

    const proxyUrl = `${req.protocol}://${req.get('host')}/files/${filePath}`;

    res.json({
      success: true,
      folder: folder,
      url: proxyUrl,
      githubUrl: response.data.content.html_url
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi upload file lên GitHub' });
  }
});

// 2. Endpoint Lấy / Xem File
app.get('/files/{*filePath}', async (req, res) => {
  try {
    const filePath = getCleanPath(req.params);

    if (!filePath) {
      return res.status(400).json({ error: 'Thiếu đường dẫn file cần lấy' });
    }

    const response = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      ref: BRANCH,
    });

    const fileBuffer = Buffer.from(response.data.content, 'base64');

    if (filePath.endsWith('.png')) res.setHeader('Content-Type', 'image/png');
    else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) res.setHeader('Content-Type', 'image/jpeg');
    else if (filePath.endsWith('.webp')) res.setHeader('Content-Type', 'image/webp');
    else if (filePath.endsWith('.gif')) res.setHeader('Content-Type', 'image/gif');
    else if (filePath.endsWith('.pdf')) res.setHeader('Content-Type', 'application/pdf');
    else if (filePath.endsWith('.mp3')) res.setHeader('Content-Type', 'audio/mpeg');

    res.send(fileBuffer);
  } catch (error) {
    console.error(error);
    if (error.status === 404) {
      return res.status(404).json({ error: 'File không tồn tại' });
    }
    res.status(500).json({ error: 'Lỗi khi tải file từ GitHub' });
  }
});

// 3. Endpoint Xóa File
app.delete('/delete/{*filePath}', async (req, res) => {
  try {
    const filePath = getCleanPath(req.params);

    if (!filePath) {
      return res.status(400).json({ error: 'Thiếu đường dẫn file cần xóa' });
    }

    const { data: fileData } = await octokit.rest.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      ref: BRANCH,
    });

    await octokit.rest.repos.deleteFile({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      message: `Delete ${filePath} via API`,
      sha: fileData.sha,
      branch: BRANCH,
    });

    res.json({
      success: true,
      message: `Đã xóa file ${filePath} thành công!`,
    });
  } catch (error) {
    console.error(error);
    if (error.status === 404) {
      return res.status(404).json({ error: 'File không tồn tại trên GitHub' });
    }
    res.status(500).json({ error: 'Lỗi khi xóa file trên GitHub' });
  }
});

// 4. Khởi chạy Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});