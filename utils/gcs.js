const { Storage } = require('@google-cloud/storage')
const path = require('path')
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
    const originalFilename = file.originalname
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

/*

const { Storage } = require('@google-cloud/storage')
const path = require('path')
const serviceAccount = require('../gcp-service-account.json')

const storage = new Storage({
  projectId: serviceAccount.project_id,
  credentials: {
    client_email: serviceAccount.client_email,
    private_key: serviceAccount.private_key,
  },
})

const bucket = storage.bucket(process.env.GCP_BUCKET_NAME)

const uploadToGCS = async (file, destination) => {
  try {
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

*/
