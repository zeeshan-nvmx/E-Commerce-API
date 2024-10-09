const fs = require('fs')
const path = require('path')

const uploadDir = path.join(__dirname, '..', 'uploads')

// Ensure the uploads directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const uploadToLocal = (file, filename) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(uploadDir, filename)
    fs.writeFile(filePath, file.buffer, (err) => {
      if (err) {
        console.error('Error uploading file locally:', err)
        reject(err)
      } else {
        console.log('Upload successful:', filePath)
        const publicUrl = `/uploads/${filename}`
        resolve(publicUrl)
      }
    })
  })
}

const deleteFromLocal = (filename) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(uploadDir, filename)
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error('Error deleting file locally:', err)
        reject(err)
      } else {
        console.log('File deleted successfully:', filePath)
        resolve()
      }
    })
  })
}

module.exports = {
  uploadToLocal,
  deleteFromLocal,
}
