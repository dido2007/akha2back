require('dotenv').config();
const jwt = require('jsonwebtoken');

function myVerifyToken(req, res, next) {
    // Récupérer le token du header 'Authorization'
    const bearerHeader = req.headers['authorization'];
    const data = JSON.parse(req.body.data || '{}');
    const requestBodyUserId = data.userId;
    
  
    if (typeof bearerHeader !== 'undefined') {
      const bearerToken = bearerHeader.split(' ')[1];
      
      jwt.verify(bearerToken, process.env.SECRET_KEY, (err, authData) => {
        if (err) {
          return res.status(403).json({ success: false, fallback: "Token invalide" });
        }
        
        req.userId = authData.id;  // stocker l'ID de l'utilisateur dans la requête pour une utilisation ultérieure
  
       // Si un userId est fourni dans la requête, vérifiez qu'il correspond à l'ID de l'utilisateur du token.
       if (req.query.userId && String(req.query.userId) !== String(authData.id)) {
        return res.status(403).json({ success: false, fallback: "Accès non autorisé" });
      }

      if (requestBodyUserId && String(requestBodyUserId) !== String(authData.id)) {
        return res.status(403).json({ success: false, fallback: "Accès non autorisé" });
      }

      // Si from ou to sont présents, vérifiez que l'utilisateur actuel est soit from soit to
      if (req.params.from || req.params.to) {
        if (!(String(req.params.from) === String(authData.id) || String(req.params.to) === String(authData.id))) {
          return res.status(403).json({ success: false, fallback: "Accès non autorisé" });
        }
      }

      next();
    });
  } else {
    res.status(403).json({ success: false, fallback: "Token manquant" });
  }
}
  
module.exports = myVerifyToken;
