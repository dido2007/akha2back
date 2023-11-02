require('dotenv').config();
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {

  const bearerHeader = req.headers['authorization'];
  
  if (typeof bearerHeader !== 'undefined') {
    const bearerToken = bearerHeader.split(' ')[1];
    
    jwt.verify(bearerToken, process.env.SECRET_KEY, (err, authData) => {
      if (err) {
        res.status(403).json({ success: false, fallback: "Token invalide" });
      } else {
        req.userId = authData.id;  
        next();  
      }
    });
    
  } else {
    res.status(403).json({ success: false, fallback: "Token manquant" });
  }
}
module.exports = verifyToken;
