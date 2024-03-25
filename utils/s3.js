const AWS = require('aws-sdk')

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
})

const uploadToS3 = async (file, key) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }

  try {
    const uploadResult = await s3.upload(params).promise()
    return uploadResult.Location
  } catch (err) {
    console.error('Error uploading file to S3:', err)
    throw err
  }
}

const deleteFromS3 = async (key) => {
  const params = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: key,
  }

  try {
    await s3.deleteObject(params).promise()
  } catch (err) {
    console.error('Error deleting file from S3:', err)
    throw err
  }
}

module.exports = {
  uploadToS3,
  deleteFromS3,
}
