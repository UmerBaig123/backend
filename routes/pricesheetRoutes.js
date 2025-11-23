import express from 'express';
import {
  getItems,
  getAllItems,
  addItem,
  updateItem,
  deleteItem,
  getItemById,
} from '../controllers/pricesheetController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// Route to get all items for authenticated user and add a new item
router.route('/')
  .get(requireAuth, getItems)
  .post(requireAuth, addItem);

// Route to get all items (public/admin view)
router.route('/all')
  .get(getAllItems);

// Route to get, update and delete a specific item by its ID
router.route('/:id')
  .get(requireAuth, getItemById)
  .put(requireAuth, updateItem)
  .delete(requireAuth, deleteItem);

export default router;
