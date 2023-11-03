const { Conversation } = require('../models/models');
const geolib = require('geolib');
const mongoose = require('mongoose');
const axios = require('axios');


function calculateDistance(userLat, userLon, offerLat, offerLon) {
    const distance = geolib.getDistance(
        { latitude: userLat, longitude: userLon },
        { latitude: offerLat, longitude: offerLon }
    );

    // Convertit la distance en kilomètres et la retourne
    const distanceInKm = distance / 1000;

    // Retourne la distance avec un chiffre après la virgule
    return parseFloat(distanceInKm.toFixed(1));
}

const saveMessage = async (message) => {
    const { from, to, content } = message;

    let conversation = await Conversation.findOne({
        participants: { $all: [new mongoose.Types.ObjectId(from), new mongoose.Types.ObjectId(to)] }
    });

    if (!conversation) {
        conversation = new Conversation({
            participants: [ new mongoose.Types.ObjectId(from), new mongoose.Types.ObjectId(to)],
            messages: [],
        });
    }

    conversation.messages.push({
        content,
        from: new mongoose.Types.ObjectId(from),
        to: new mongoose.Types.ObjectId(to),
    });

    await conversation.save();
};

async function reverseGeocoding(latitude, longitude) {
  try {
    const apiKey = 'AIzaSyCs_KXiaEmUbd50_uSuCKnZ7YDsQ3b9UTY';
    const response = await axios.get(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`);
    const results = response.data.results;
    if (results.length > 0) {
      const addressComponents = results[0].address_components;
      return addressComponents.reduce((acc, current) => {
        acc[current.types[0]] = current.long_name;
        return acc;
      }, {});
    } else {
      return null;
    }
  } catch (error) {
    console.error("Erreur lors du reverse geocoding:", error);
    return null;
  }
}



module.exports = { saveMessage, calculateDistance, reverseGeocoding };
