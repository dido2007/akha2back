require('dotenv').config();
const express = require('express');
const router = express.Router();
const multer = require('multer');
const myVerifyToken = require("../middleware/myVerifyToken")
const verifyToken = require("../middleware/verifyToken")
const RequestLimitor = require('../middleware/requestLimitor')
const jwt = require('jsonwebtoken');
const { calculateDistance } = require('../utils/utils'); 
const { Offre, Demande , DemandeCorrespondance, OffreCorrespondance} = require('../models/models');

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
     
      router.post("/add",  upload.fields([{ name: 'images', maxCount: 3 }]), async (req, res) => {
        try {
            const data = JSON.parse(req.body.data);
             

            if(data.annonceType == 'Offre'){
                const offre = new Offre({
                    user: data.userId._id,
                    annonceType: data.annonceType,
                    metier: data.metier,
                    description: data.description,
                    disponibilite: data.disponibilite,
                    tarif: data.tarif,
                    images: req.files['images'] ? req.files['images'].map(file => file.path) : [],
                });
    
                await offre.save();

                const matchedDemandes = await Demande.find({ metier: data.metier });
                const matchingDemandeIds = matchedDemandes.map(demande => demande._id);
    
                const offreCorrespondance = new OffreCorrespondance({
                    user: offre.user,
                    demandes: matchingDemandeIds
                });
                await offreCorrespondance.save();
    
                res.json({success: true, fallback: "L'annonce a ete cree avec succes"});
            }
    
            if(data.annonceType == 'Demande'){
                const demande = new Demande({
                    user: data.userId._id,
                    annonceType: data.annonceType,
                    metier: data.metier,
                    description: data.description,
                    disponibilite: data.disponibilite,
                    tarif: data.tarif,
                    images: req.files['images'] ? req.files['images'].map(file => file.path) : [],
                });
    
                await demande.save();
    
            const matchedOffres = await Offre.find({ metier: data.metier });
            const matchingUserIds = matchedOffres.map(offre => offre.user);

            const demandeCorrespondance = new DemandeCorrespondance({
                annonce: demande._id,
                users: matchingUserIds
            });
            await demandeCorrespondance.save();
    
                res.json({success: true, fallback: "L'annonce a ete cree avec succes"});
            }
        } catch (error) {
            console.error(error);
            return res.json({ success: false, fallback: "An error occurred" });
        }
    });
    

    router.get('/filtregetoffres' , async (req, res) => {
      try {
          let offres;
          let token = req.cookies.guestToken || req.headers['authorization']; 

          if (token) {
              try {
                  jwt.verify(token, process.env.SECRET_KEY); 
              } catch (err) {
                  token = null; 
              }
          }
  
          
          if (req.query.userId) {
              offres = await Offre.find({ user: req.query.userId }).populate('user', 'fullName avatar position addressDetails');
          } else if (req.query.metier) {
              offres = await Offre.find({ metier: req.query.metier }).populate('user', 'fullName avatar position addressDetails');
          } else {
              offres = await Offre.find().populate('user', 'fullName avatar position addressDetails');
          }
          
          if (req.query.latitude && req.query.longitude) {
            offres = offres.map(offre => {
                offre._doc.distance = calculateDistance(
                    req.query.latitude,
                    req.query.longitude,
                    offre.user.position.latitude,
                    offre.user.position.longitude
                );
        
                return offre;
            });
        }
  
          return res.json({ success: true, fallback: "Les offres ont ete get avec succes", data: offres, guestToken: token });;
      } catch (error) {
          console.error(error);
          return res.json({ success: false, fallback: "Failed to get the annonces" });
      }
    });

    router.get('/filtregetdemandes', verifyToken, RequestLimitor , async (req, res ) => {
    try {
            let demandes;

            if (req.query.userId) {
              demandes = await Demande.find({ user: req.query.userId }).populate('user', 'fullName avatar position addressDetails ');
          } else if (req.query.metier) {
              demandes = await Demande.find({ metier: req.query.metier }).populate('user', 'fullName avatar position addressDetails');
          } else {
              demandes = await Demande.find().populate('user', 'fullName avatar position addressDetails');
          }

          if (req.query.latitude && req.query.longitude) {
            demandes = demandes.map(demande => {
                demande._doc.distance = calculateDistance(
                    req.query.latitude,
                    req.query.longitude,
                    demande.user.position.latitude,
                    demande.user.position.longitude
                );
        
                return demande;
            });
        }

          return res.json({ success: true, fallback: "Les offres ont ete get avec succes", data: demandes });
      } catch (error) {
          console.error(error);
          return res.json({ success: false, fallback: "Failed to get the annonces" });
      }
    });

      router.get('/annonce/:type/:id', RequestLimitor, verifyToken , async (req, res) => {
        const id = req.params.id;
        const annonceType = req.params.type;
    
        console.log("id " + id);
        console.log("annonceType " + annonceType);
    
        try {
            if (annonceType === 'offre') {
                const annonce = await Offre.findById(id).populate('user', 'fullName avatar position age bio');
                
                if (!annonce) {
                    return res.status(404).json({ error: 'Annonce not found' });
                }
                res.json(annonce);
            }
            if (annonceType === 'demande') {
                const annonce = await Demande.findById(id).populate('user', 'fullName avatar position age bio');
                
                if (!annonce) {
                    return res.status(404).json({ error: 'Annonce not found' });
                }
                res.json(annonce);
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    });

    router.get('/getMatchingAnnonces', async (req, res) => {
        const userId = req.query.userId;
    
        if (!userId) {
            return res.status(400).json({ success: false, fallback: 'UserId is required' });
        }
    
        try {
            const matchings = await Matching.find({ matchingUsers: userId });
            const offreIds = matchings.filter(m => m.onModel === 'Offre').map(m => m.annonceId);
            const demandeIds = matchings.filter(m => m.onModel === 'Demande').map(m => m.annonceId);
    
            const offres = await Offre.find({ '_id': { $in: offreIds } }).populate('user', 'fullName avatar position');
            const demandes = await Demande.find({ '_id': { $in: demandeIds } }).populate('user', 'fullName avatar position');
    
            return res.json({ success: true, offres: offres, demandes: demandes });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ success: false, fallback: 'Internal Server Error' });
        }
    });
    
    

    return router;
  };
