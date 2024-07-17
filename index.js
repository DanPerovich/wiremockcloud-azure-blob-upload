const express = require('express');
const multer = require('multer');
const { BlobServiceClient, StorageSharedKeyCredential } = require('@azure/storage-blob');
require('dotenv').config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const AZURE_STORAGE_CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME;
const AZURE_STORAGE_CUSTOM_ENDPOINT = process.env.AZURE_STORAGE_CUSTOM_ENDPOINT;

let blobServiceClient;

if (AZURE_STORAGE_CUSTOM_ENDPOINT) {
    const accountName = AZURE_STORAGE_CONNECTION_STRING.match(/AccountName=([^;]+)/)[1];
    const accountKey = AZURE_STORAGE_CONNECTION_STRING.match(/AccountKey=([^;]+)/)[1];
    const sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
    
    blobServiceClient = new BlobServiceClient(AZURE_STORAGE_CUSTOM_ENDPOINT, sharedKeyCredential);
} else {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
}

const containerClient = blobServiceClient.getContainerClient(AZURE_STORAGE_CONTAINER_NAME);

app.get('/', (req, res) => {
    res.send(`
        <h2>Upload a file to Azure Blob Storage</h2>
        ${AZURE_STORAGE_CUSTOM_ENDPOINT ? '<h3 style="color:red">WireMock stubbing ENABLED</h3>':''}
        <form action="/upload" method="post" enctype="multipart/form-data">
            <input type="file" name="file" />
            <button type="submit">Upload</button>
        </form>
    `);
});

async function listBlobs(containerClient) {
    let blobs = [];
    for await (const blob of containerClient.listBlobsFlat()) {
        blobs.push(blob.name);
    }
    return blobs;
}

app.post('/upload', upload.single('file'), async (req, res) => {
    try {
        const blobName = req.file.originalname;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);

        await blockBlobClient.upload(req.file.buffer, req.file.size);

        const blobs = await listBlobs(containerClient);
        
        let responseHtml = `<p>File uploaded to Azure Blob Storage: ${blobName}</p>`;
        responseHtml += '<h3>List of files in container:</h3>';
        responseHtml += '<ul>';
        blobs.forEach(blob => {
            responseHtml += `<li>${blob}</li>`;
        });
        responseHtml += '</ul>';
        responseHtml += '<button onclick="window.location.href=\'/\'">New Upload</button>';
        
        res.send(responseHtml);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error uploading file to Azure Blob Storage');
    }
});

const port = process.env.PORT || 8011;
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});