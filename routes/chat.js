const express = require('express');
const router = express.Router();
const { Conversation } = require('../models/models');
const myVerifyToken = require('../middleware/myVerifyToken');
const RequestLimitor = require('../middleware/requestLimitor')
const mongoose = require('mongoose');

router.get('/history/:from/:to', myVerifyToken, RequestLimitor, async (req, res) => {
  const { from, to } = req.params;
  
  try {
      const conversation = await Conversation.findOne({
        participants: { $all: [new mongoose.Types.ObjectId(from), new mongoose.Types.ObjectId(to)] }
      }).populate('participants', 'fullName avatar'); 

      if (conversation) {
          res.json({ success: true, messages: conversation.messages,participants: conversation.participants   
        });
      } else {
          res.json({ success: false, messages: [] });
      }
  } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ success: false, error: 'Erreur lors de la récupération des messages.' });
  }
});

router.get('/mychats',myVerifyToken, RequestLimitor, async (req, res) => {
  try {
      const userId = req.query.userId;

      if (!userId) {
          return res.json({ success: false, message: "userId est requis" });
      }

      let mychats = await Conversation.find({ 'participants': userId })
          .populate({
              path: 'participants',
              select: 'fullName avatar'
          });

      const uniqueUsers = {};
      mychats.forEach((chat) => {
          chat.participants.forEach((participant) => {
              if (participant._id.toString() !== userId) {
                  uniqueUsers[participant._id] = {
                      _id: participant._id,
                      fullName: participant.fullName,
                      avatar: participant.avatar
                  };
              }
          });
      });

      return res.json({
          success: true,
          message: "Les conversations ont été récupérées avec succès",
          data: Object.values(uniqueUsers)
      });

  } catch (error) {
      console.error(error);
      return res.json({ success: false, message: "Échec de la récupération des conversations" });
  }
});


module.exports = router;
