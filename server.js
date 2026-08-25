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

// Thay đổi thông tin Username và Repo của bạn tại đây
const OWNER = process.env.GITHUB_USERNAME; 
const REPO = process.env.GITHUB_REPO;
const BRANCH = 'main';

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file' });
    }

    // Đặt tên file bằng Timestamp để tránh trùng
    const fileName = `${Date.now()}-${req.file.originalname}`;
    const filePath = `uploads/${fileName}`;
    const fileContentBase64 = req.file.buffer.toString('base64');

    const response = await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: filePath,
      message: `Upload ${fileName} via API`,
      content: fileContentBase64,
      branch: BRANCH,
    });

    // Link CDN tốc độ cao qua jsDelivr
    const cdnUrl = `https://cdn.jsdelivr.net/gh/${OWNER}/${REPO}@${BRANCH}/${filePath}`;

    res.json({
      success: true,
      url: cdnUrl,
      githubUrl: response.data.content.html_url
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi upload file lên GitHub' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});