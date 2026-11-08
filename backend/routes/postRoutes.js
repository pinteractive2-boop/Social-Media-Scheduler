const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const uploadImage = require('../middleware/uploadImage');

router.post('/', uploadImage.single('image'), postController.createPost);
router.get('/', postController.getAllPosts);
router.get('/:id', postController.getPost);
router.put('/:id', uploadImage.single('image'), postController.updatePost);
router.delete('/:id', postController.deletePost);

module.exports = router;
