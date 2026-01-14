const express = require('express');
const SftpClient = require('ssh2-sftp-client');

const app = express();
app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3000;

// SFTP Configuration
const SFTP_CONFIG = {
  host: 's-20628a7a7d07456a8.server.transfer.ap-south-1.amazonaws.com',
  port: 22,
  username: 'rzp-Variyaan-sftp',
  pathPrefix: '/automated/Rnp5iD5fwiYebZ/' // With leading slash
};

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'ok', service: 'Razorpay SFTP Uploader' });
});

// Upload invoice endpoint
app.post('/upload-invoice', async (req, res) => {
  try {
    const { invoiceNumber, pdfBase64, bookingId } = req.body;

    if (!invoiceNumber || !pdfBase64 || !bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: invoiceNumber, pdfBase64, bookingId'
      });
    }

    console.log(`Uploading invoice ${invoiceNumber} for booking ${bookingId}`);

    // Get private key from environment
    const privateKey = process.env.RAZORPAY_SFTP_PRIVATE_KEY;
    if (!privateKey) {
      return res.status(500).json({
        success: false,
        error: 'SFTP private key not configured'
      });
    }

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    console.log(`PDF size: ${pdfBuffer.length} bytes`);

    // Create date folder (YYYY-MM-DD)
    const now = new Date();
    const dateFolder = now.toISOString().split('T')[0];
    const filename = `${invoiceNumber}.pdf`;
    const remotePath = `${SFTP_CONFIG.pathPrefix}${dateFolder}/${filename}`;

    console.log(`Target path: ${remotePath}`);

    // Upload via SFTP
    const sftp = new SftpClient();

    try {
      await sftp.connect({
        host: SFTP_CONFIG.host,
        port: SFTP_CONFIG.port,
        username: SFTP_CONFIG.username,
        privateKey: privateKey
      });

      console.log('SFTP connected');

      // Skip mkdir - attempt direct upload (Razorpay may auto-create folders)
      console.log('Attempting direct upload without mkdir');

      // Upload the file directly
      console.log(`Uploading file to: ${remotePath}`);
      await sftp.put(pdfBuffer, remotePath);
      console.log('Upload successful');

      await sftp.end();

      res.json({
        success: true,
        message: 'Invoice uploaded successfully',
        remotePath,
        invoiceNumber,
        bookingId
      });

    } catch (sftpError) {
      console.error('SFTP error:', sftpError);
      await sftp.end();
      throw sftpError;
    }

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`SFTP uploader service running on port ${PORT}`);
});
