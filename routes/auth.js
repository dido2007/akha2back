require('dotenv').config();
const express = require('express');
const router = express.Router();
const multer = require('multer');
const { User, VerifCode } = require('../models/models');
const axios = require('axios');
const {reverseGeocoding} = require('../utils/utils')
const jwt = require('jsonwebtoken');


module.exports = (db) => {  
  
  let verification_code = null;

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
 
  console.log("Valeur de depart du verification code : " + verification_code)

  const getToken = async () => {
    const result = await axios
    .post("https://api.orange.com/oauth/v3/token", {
        grant_type: "client_credentials",
      }, {
        headers: {
          Authorization: process.env.TOKEN_AUTH,
          Accept: 'application/json',
          "content-type": "application/x-www-form-urlencoded",
        }
      }
    ).then((res) => res.data);
    return result.access_token;
  }

  async function sendVerificationSMS(phone_number) {
    const verification_code = Math.floor(100000 + Math.random() * 900000);
  
    console.log("Code de verification : " + verification_code);

    const token = await getToken();
    const devPhoneNumber = process.env.NUMBER_DEV
  
    try {  
      axios.post(`https://api.orange.com/smsmessaging/v1/outbound/tel%3A%2B${devPhoneNumber}/requests`,
      {
          "outboundSMSMessageRequest": {
              "address": [
                  `tel:+216${phone_number}`
              ],
              "senderAddress": `tel:+${devPhoneNumber}`,
              "outboundSMSTextMessage": {
                  "message": `Bienvenue sur DJOBY. Votre code de vérification est : ${verification_code}`
              },
          }
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        }
      }
      )
      return verification_code;
    } catch (error) {
      console.error('Une erreur s\'est produite lors de l\'envoi du SMS :', error);
      return false;
    }
  }

  
  async function verificationSystem(phone_number) {
    try {
      const verificationSent = await sendVerificationSMS(phone_number);
      console.log("Contenu de la variable verification sent : " + verificationSent + " \n ")
      if (verificationSent) {
        console.log(verificationSent);
        const verificationCodePost = new VerifCode({
          phoneNumber: phone_number,
          verificationCode: parseInt(verificationSent), 
        })
        await verificationCodePost.save();
        console.log("verification_code ajoute avec success : ", verificationCodePost + " \n ");
        return true
      } else {
        console.log("Echec lors de l'ajout du code de verification dans la base de donne." + " \n ")
        return false 
      }
    }
    catch(error) {
      console.error(error);
      return { success: false, fallback: "Une erreur est survenue : " + error }
    }
  };
  

  router.post("/login", async (req, res) => {
    try {
      const { phone_number } = req.body;

      console.log("La varibale phone_number est egale a : " + phone_number + " \n ")

      const user = await db.collection('users').findOne({
        phoneNumber: phone_number,
      });

      console.log("Le resultat de la requete a la blase de donnee : " + user + " \n ")

      console.log("Phone :" + user.phoneNumber)

      if (!user) {
        console.log("Numero de telephone pas trouve a la base de donnee" + " \n ");
        return res.json({
          success: false,
          fallback: "Ce numero n'existe pas, veuillez en essayer un autre ou veuillez creer un compte."
        });
      }
      
      

      if(verificationSystem(phone_number)){
        res.json({ success: true, fallback: "Le code de verification a ete envoye avec succes" });
      } else {
        res.json({ success: false, fallback: "Une erreur est survenue lors de l envoi du code de verification" }); 
      }      
    } catch (error) {
      console.error(error);
      return res.json({ success: false, fallback: "Une erreur est survenue : " + error });
    }
  });

  router.post("/signup-verification", async (req, res) => {
    try {
      const { phone_number } = req.body;

      console.log("La varibale phone_number est egale a : " + phone_number + " \n ")
    
      const user = await db.collection('users').findOne({
        phoneNumber: phone_number,
      });

      if(user){
        res.json({ success: false, fallback: "l'utilisateur existe deja" });
      } else {
        // res.json({ success: true, fallback: "Le code de verification a ete envoye avec succes." });
        res.json({ success: verificationSystem(phone_number), fallback: "Le code de verification a ete envoye avec succes." });
      }

    } catch (error) {
      console.error(error);
      return res.json({ success: false, error: "An error occurred" });
    }

  });

  router.post("/signup", upload.fields([{ name: 'avatar', maxCount  : 1 }, { name: 'images', maxCount: 3 }]), async (req, res) => {
    try {

      const data = JSON.parse(req.body.data); 

      console.log("Uploaded Images:", req.files['images']);

      const user = new User({
        phoneNumber: data.phoneNumber,
        fullName: data.fullName,
        age: data.age,
        avatar: req.files['avatar'] ? req.files['avatar'][0].path : null,
        rating: data.rating,
        userType: data.userType,
        interestedServices: data.interestedServices,
        bio: data.bio,
        images: req.files['images'] ? req.files['images'].map(file => file.path) : [],
        position: {
          latitude: data.position.lat,
          longitude: data.position.lng,
        }

      });
      const addressDetails = await reverseGeocoding(user.position.latitude, user.position.longitude);
      if (addressDetails) {
        console.log("Détails de l'adresse:", addressDetails);
        user.addressDetails = {
          street: addressDetails.route || '',
          city: addressDetails.locality || '',
          state: addressDetails.administrative_area_level_1 || '',
          country: addressDetails.country || '',
          postalCode: addressDetails.postal_code || '',
        };
      } else {
        console.log("Aucune adresse trouvée pour ces coordonnées.");
      }

      await user.save()

      const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: '30d' });
      console.log(token)


      res.json({
        token: token,
        data: user,
        success: true, 
        fallback: "L'utilisateur a ete ajoute avec succes dans la base de donne"
      })

    } catch(error) {
      console.log("Echec lors de l'ajout du user dans la base de donne." + error + " \n ")
      res.json({ success: false, error: "Error sending user" });
    }
  }); 

  router.post("/verification", async (req, res) => {
    try {
      console.log("Request Body : " + req.body + "\n");

      console.log("Request Body phone_number : " + req.body.phone_number + "\n");

      console.log("Request Body verification_code  : " + req.body.verification_code + "\n");

      const { code, phone } = req.body


      console.log("Type Numero de tel obtenu du front : " + typeof phone + "\n");
      
      console.log("Type Code de verification obtenue du front : " + typeof code + "\n");
      
      console.log("Numero de tel obtenu du front : " + phone + "\n");
      
      console.log("Code de verification obtenue du front : " + code + "\n");

      console.log("Type Code de verification obtenue du front parseInt : " + typeof parseInt(code) + "\n");

      const new_code = parseInt(code)

      const verifCode = await VerifCode.findOne({
        phoneNumber: phone,
        verificationCode: new_code,
      });

      console.log("Cherche des donnes du front dans la database : " + verifCode + '\n' + '-------------------------------' + '\n');

      const user = await db.collection('users').findOne({
        phoneNumber: phone,
      });

      
      if (!verifCode) {
        return res.json({
          success: false,
          fallback: "The verification code is wrong"
        });
      } else{
        const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, { expiresIn: '30d' });
        console.log(token)

        if(user){
          return res.json({
            data: user,
            token: token,
            success: true,
            fallback: "Session initialisee avec succes!"
          });
        }
        res.json({ success: true, token: token, fallback: "Le code de verification est juste" });
      } 

      const suppressionDuCode = await db.collection('verifcodes').deleteOne({
        phoneNumber: phone,
        verificationCode: new_code,
      });

      if (suppressionDuCode) {
        console.log("Le code a ete supprime avec succes");
      } else{
        console.log("Erreur lors de la suppression du code");
      }
    }
    catch (error) {
      console.error('Une erreur s\'est produite lors de la verification du code de verification :', error);
      throw error;
    }
  });
  // Pour signup
  router.post("/verificationSignup", async (req, res) => {
    try {
      console.log("Request Body : " + req.body + "\n");

      console.log("Request Body phone_number : " + req.body.phone_number + "\n");

      console.log("Request Body verification_code  : " + req.body.verification_code + "\n");

      const { code, phone } = req.body


      console.log("Type Numero de tel obtenu du front : " + typeof phone + "\n");
      
      console.log("Type Code de verification obtenue du front : " + typeof code + "\n");
      
      console.log("Numero de tel obtenu du front : " + phone + "\n");
      
      console.log("Code de verification obtenue du front : " + code + "\n");

      console.log("Type Code de verification obtenue du front parseInt : " + typeof parseInt(code) + "\n");

      const new_code = parseInt(code)

      const verifCode = await VerifCode.findOne({
        phoneNumber: phone,
        verificationCode: new_code,
      });

      console.log("Cherche des donnes du front dans la database : " + verifCode + '\n' + '-------------------------------' + '\n');

      const user = await db.collection('users').findOne({
        phoneNumber: phone,
      });

      
      if (!verifCode) {
        return res.json({
          success: false,
          fallback: "The verification code is wrong"
        });
      } else{


        if(user){
          return res.json({
            data: user,
            success: true,
            fallback: "Session initialisee avec succes!"
          });
        }
        res.json({ success: true, fallback: "Le code de verification est juste" });
      } 

      const suppressionDuCode = await db.collection('verifcodes').deleteOne({
        phoneNumber: phone,
        verificationCode: new_code,
      });

      if (suppressionDuCode) {
        console.log("Le code a ete supprime avec succes");
      } else{
        console.log("Erreur lors de la suppression du code");
      }
    }
    catch (error) {
      console.error('Une erreur s\'est produite lors de la verification du code de verification :', error);
      throw error;
    }
  });

  // Generez un token lorsque pas connecte 
  router.get('/generateGuestToken', (req, res) => {
    const guestToken = jwt.sign({ guest: true }, process.env.SECRET_KEY, { expiresIn: '1h' });
    res.json({ guestToken });
});


  return router;
};