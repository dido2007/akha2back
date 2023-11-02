const express = require('express');
const router = express.Router();
const { User } = require('../models/models');
const verifyToken = require('../middleware/verifyToken');
const myVerifyToken = require("../middleware/myVerifyToken")
const RequestLimitor = require('../middleware/requestLimitor')
const multer = require('multer');

module.exports = (db) => {  

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
       cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
       cb(null, Date.now() + '-' + file.originalname);
    }
  });

  const upload = multer({
    storage: storage
  });


    router.get('/:id', RequestLimitor, async (req, res) => {
        const userId = req.params.id;
        try {
          const user = await User.findById(userId);
          if (!user) {
            return res.status(404).json({ error: 'User not found' });
          }
          res.json(user);
        } catch (error) {
          console.error(error);
          res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.post("/update",myVerifyToken, RequestLimitor, upload.fields([{ name: 'avatar', maxCount  : 1 }, { name: 'images', maxCount: 3 }]), async (req, res) => {
      try {
  
        const data = JSON.parse(req.body.data); 
  
        const user = await User.findOne({ _id: data.userId });
        user.phoneNumber = data.phoneNumber;
        user.fullName = data.fullName;
        user.age = data.age;
        user.userType = data.userType;
        user.bio = data.bio;
        user.position = {
          latitude: data.position[0],
          longitude: data.position[1],
        };

        if (req.files['avatar']) {
          user.avatar = req.files['avatar'][0].path;
        }

        if (req.files['images']) {
          user.images = req.files['images'].map(file => file.path);
        }
  
        await user.save()
  
        res.json({
          data: user,
          success: true, 
          fallback: "Le profil a été mis à jour avec succès"
        })
  
      } catch(error) {
        console.log("Échec de la mise à jour du profil :" + error + " \n ")
        res.json({ success: false, error: "Échec de la mise à jour du profil" });
      }
    }); 

    return router;
};