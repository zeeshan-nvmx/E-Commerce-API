const { Storage } = require('@google-cloud/storage')
require('dotenv').config()

const storage = new Storage({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
})

const bucket = storage.bucket(process.env.GCP_BUCKET_NAME)

const uploadToGCS = async (file) => {
  try {
    const originalFilename = file.originalname.replace(/\s+/g, '_')
    const timestamp = Date.now()
    const destination = `${timestamp}_${originalFilename}`
    const fileUpload = bucket.file(destination)
    const blobStream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
      },
    })

    blobStream.on('error', (err) => {
      console.error('Error uploading file to GCS:', err)
      throw err
    })

    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${destination}`
      console.log(`Uploaded file to GCS: ${publicUrl}`)
    })

    blobStream.end(file.buffer)
    const publicUrl = `https://storage.googleapis.com/${process.env.GCP_BUCKET_NAME}/${destination}`
    return publicUrl
  } catch (err) {
    console.error('Error uploading file to GCS:', err)
    throw err
  }
}

const deleteFromGCS = async (fileName) => {
  try {
    await bucket.file(fileName).delete()
    console.log(`Deleted file from GCS: ${fileName}`)
  } catch (err) {
    console.error('Error deleting file from GCS:', err)
    throw err
  }
}

module.exports = { uploadToGCS, deleteFromGCS }

