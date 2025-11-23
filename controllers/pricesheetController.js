import PriceSheet from '../models/pricesheet.js';

const getItems = async (req, res) => {
  try {
    const items = await PriceSheet.find({ createdBy: req.session.userId })
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};


const getAllItems = async (req, res) => {
  try {
    const items = await PriceSheet.find({})
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

const addItem = async (req, res) => {
  try {
    const { name, price,  category } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Please enter an item name.' });
    }

    if (!req.session.userId) {
      return res.status(401).json({ message: 'User not authenticated.' });
    }

    const newItem = new PriceSheet({
      name,
      price: price || 0,
      
      category,
      
      createdBy: req.session.userId,
    });

    const savedItem = await newItem.save();
    await savedItem.populate('createdBy', 'email');
    res.status(201).json(savedItem);
  } catch (error) {
    res.status(500).json({ message: 'Server Error: ' + error.message });
  }
};

const updateItem = async (req, res) => {
    try {
        const { name, price,  category } = req.body;
        const item = await PriceSheet.findOne({ 
          _id: req.params.id, 
          createdBy: req.session.userId 
        });

        if (item) {
            item.name = name || item.name;
            item.price = price !== undefined ? price : item.price;
            // item.description = description !== undefined ? description : item.description;
            item.category = category || item.category;
            // item.unit = unit || item.unit;

            const updatedItem = await item.save();
            await updatedItem.populate('createdBy', 'email');
            res.status(200).json(updatedItem);
        } else {
            res.status(404).json({ message: 'Item not found or you do not have permission to update it.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};


const deleteItem = async (req, res) => {
    try {
        const item = await PriceSheet.findOne({ 
          _id: req.params.id, 
          createdBy: req.session.userId 
        });

        if (item) {
            await item.deleteOne();
            res.status(200).json({ message: 'Item removed successfully.' });
        } else {
            res.status(404).json({ message: 'Item not found or you do not have permission to delete it.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};



const getItemById = async (req, res) => {
    try {
        const item = await PriceSheet.findOne({ 
          _id: req.params.id, 
          createdBy: req.session.userId 
        }).populate('createdBy', 'email');

        if (item) {
            res.status(200).json(item);
        } else {
            res.status(404).json({ message: 'Item not found or you do not have permission to view it.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server Error: ' + error.message });
    }
};

export {
  getItems,
  getAllItems,
  addItem,
  updateItem,
  deleteItem,
  getItemById,
};
