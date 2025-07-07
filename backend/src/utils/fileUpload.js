const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');
const { v4: uuidv4 } = require('uuid');

// Ensure upload directories exist
const uploadDirs = {
  graphs: 'uploads/graphs',
  exports: 'uploads/exports',
  temp: 'uploads/temp'
};

Object.values(uploadDirs).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    logger.info(`Created upload directory: ${dir}`);
  }
});

// File size limits
const FILE_SIZE_LIMITS = {
  dot: 5 * 1024 * 1024,      // 5MB for DOT files
  json: 10 * 1024 * 1024,    // 10MB for JSON exports
  image: 2 * 1024 * 1024,    // 2MB for images
  default: 1 * 1024 * 1024   // 1MB default
};

// Allowed file types
const ALLOWED_EXTENSIONS = {
  graphs: ['.dot', '.gv', '.json'],
  exports: ['.json', '.dot', '.gv', '.svg', '.png'],
  images: ['.png', '.jpg', '.jpeg', '.gif', '.svg']
};

/**
 * Create multer storage configuration
 */
const createStorage = (uploadType = 'temp') => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = uploadDirs[uploadType] || uploadDirs.temp;
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      // Generate unique filename with original extension
      const uniqueSuffix = uuidv4();
      const ext = path.extname(file.originalname);
      const filename = `${uniqueSuffix}${ext}`;
      cb(null, filename);
    }
  });
};

/**
 * File filter function
 */
const createFileFilter = (allowedExtensions = ALLOWED_EXTENSIONS.graphs) => {
  return (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed extensions: ${allowedExtensions.join(', ')}`), false);
    }
  };
};

/**
 * Graph file upload middleware
 */
const uploadGraphFile = multer({
  storage: createStorage('graphs'),
  fileFilter: createFileFilter(ALLOWED_EXTENSIONS.graphs),
  limits: {
    fileSize: FILE_SIZE_LIMITS.dot,
    files: 1
  }
}).single('graphFile');

/**
 * Export file upload middleware
 */
const uploadExportFile = multer({
  storage: createStorage('exports'),
  fileFilter: createFileFilter(ALLOWED_EXTENSIONS.exports),
  limits: {
    fileSize: FILE_SIZE_LIMITS.json,
    files: 1
  }
}).single('exportFile');

/**
 * Image upload middleware
 */
const uploadImage = multer({
  storage: createStorage('temp'),
  fileFilter: createFileFilter(ALLOWED_EXTENSIONS.images),
  limits: {
    fileSize: FILE_SIZE_LIMITS.image,
    files: 1
  }
}).single('image');

/**
 * Multiple files upload middleware
 */
const uploadMultipleFiles = multer({
  storage: createStorage('temp'),
  fileFilter: createFileFilter([...ALLOWED_EXTENSIONS.graphs, ...ALLOWED_EXTENSIONS.exports]),
  limits: {
    fileSize: FILE_SIZE_LIMITS.default,
    files: 10
  }
}).array('files', 10);

/**
 * Clean up uploaded file
 */
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      logger.info(`Cleaned up file: ${filePath}`);
      return true;
    }
  } catch (error) {
    logger.error('Error cleaning up file', { filePath, error: error.message });
    return false;
  }
  return false;
};

/**
 * Clean up old temporary files
 */
const cleanupOldTempFiles = (maxAge = 24 * 60 * 60 * 1000) => { // 24 hours default
  try {
    const tempDir = uploadDirs.temp;
    const files = fs.readdirSync(tempDir);
    const now = Date.now();
    
    let cleaned = 0;
    
    files.forEach(file => {
      const filePath = path.join(tempDir, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();
      
      if (age > maxAge) {
        if (cleanupFile(filePath)) {
          cleaned++;
        }
      }
    });
    
    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old temporary files`);
    }
    
    return cleaned;
  } catch (error) {
    logger.error('Error cleaning up old temp files', { error: error.message });
    return 0;
  }
};

/**
 * Read and validate DOT file content
 */
const readDotFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Basic validation
    if (!content.trim()) {
      throw new Error('File is empty');
    }
    
    // Check if it looks like DOT content
    const dotPattern = /(di)?graph\s+\w*\s*\{/i;
    if (!dotPattern.test(content)) {
      throw new Error('File does not appear to contain valid DOT syntax');
    }
    
    return {
      success: true,
      content,
      size: content.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Read and validate JSON file content
 */
const readJsonFile = (filePath) => {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    return {
      success: true,
      data,
      size: content.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get file information
 */
const getFileInfo = (filePath) => {
  try {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    
    return {
      exists: true,
      size: stats.size,
      extension: ext,
      created: stats.birthtime,
      modified: stats.mtime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory()
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
};

/**
 * Move file from temp to permanent location
 */
const moveFile = (sourcePath, destinationPath) => {
  try {
    // Ensure destination directory exists
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    
    // Move file
    fs.renameSync(sourcePath, destinationPath);
    
    logger.info(`File moved successfully`, {
      from: sourcePath,
      to: destinationPath
    });
    
    return {
      success: true,
      newPath: destinationPath
    };
  } catch (error) {
    logger.error('Error moving file', {
      from: sourcePath,
      to: destinationPath,
      error: error.message
    });
    
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Error handler middleware for multer
 */
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          error: 'File too large',
          code: 'FILE_TOO_LARGE',
          maxSize: error.field === 'graphFile' ? '5MB' : '1MB'
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          code: 'TOO_MANY_FILES',
          maxFiles: 10
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          error: 'Unexpected file field',
          code: 'UNEXPECTED_FILE'
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          code: 'UPLOAD_ERROR',
          details: error.message
        });
    }
  } else if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      code: 'INVALID_FILE_TYPE',
      details: error.message
    });
  }
  
  next(error);
};

// Schedule cleanup of old temp files every hour
setInterval(() => {
  cleanupOldTempFiles();
}, 60 * 60 * 1000);

module.exports = {
  // Middleware
  uploadGraphFile,
  uploadExportFile,
  uploadImage,
  uploadMultipleFiles,
  handleUploadError,
  
  // Utilities
  cleanupFile,
  cleanupOldTempFiles,
  readDotFile,
  readJsonFile,
  getFileInfo,
  moveFile,
  
  // Constants
  FILE_SIZE_LIMITS,
  ALLOWED_EXTENSIONS,
  uploadDirs
};
